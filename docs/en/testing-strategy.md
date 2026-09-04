# Comprehensive Testing Strategy & Test Case Matrix
## Factory Data & Production Line Platform

This document outlines the entire testing strategy, architecture layers, and detailed 5-phase test case matrix for the Factory Data & Production Line Platform, strictly complying with **Rule 60** and **Rule 80**.

---

## 1. Testing Philosophy & Architecture Layers

The system adheres to the Testing Pyramid model with maximum domain isolation:
1. **Domain & UseCase Unit Tests (Base Layer - 30 Test Cases across 7 suites)**:
   - 100% isolated verification of core business rules: Deduplication, Conflict resolution, Ingestion pipeline with metadata-only materialization and cross-run dedup, Furthest station rule, Late event invariance, State precedence, Append-only audit trail, and Pre-flight connection health checks.
   - Ultra-fast execution (~9s), zero dependency on external databases.
2. **Integration & E2E Tests (Middle Layer - 3 Integrated Scenarios)**:
   - End-to-end multi-source workflow (`test/e2e/workflow.spec.ts`): Registers, discovers schema, selects data contracts, collects from all three sources (Crawler, PostgreSQL, REST), verifies cross-run deduplication and line/station projection.
3. **Docker Compose Test Runner (Top Layer - CI/CD Container)**:
   - Dedicated configuration file `infrastructure/docker-compose.test.yml` spins up clean container environments with fresh test databases and executes `npm test && npm run test:e2e` via:
     ```bash
     docker compose -f infrastructure/docker-compose.test.yml up --build --abort-on-container-exit --exit-code-from backend-test
     ```

---

## 2. 5-Phase Detailed Test Case Matrix

### Phase 1: Ingestion & Collector Resilience

| ID | Group | Test Case Name | Scenario Description | Expected Outcome | Code Location |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **TC-1.1** | Crawler | Pagination Loop Detection | Page 1 links to Page 2, Page 2 links back to Page 1 | Crawler detects visited URL, safely terminates with `PAGINATION_LOOP_DETECTED`. | `test/unit/crawler-resilience.spec.ts` |
| **TC-1.2** | Crawler | Malformed Row Isolation | HTML table contains 2 valid rows and 1 row with `quantity = "NOT_A_NUMBER"` | Collects 2 valid rows, isolates the malformed row with `MALFORMED_QUANTITY_ROW`. | `test/unit/crawler-resilience.spec.ts` |
| **TC-1.3** | Crawler | Stable Source Record ID | HTML includes `<tr data-source-record-id="SUPP-101">` | Accurately extracts `sourceRecordId` for end-to-end provenance. | `test/unit/crawler-resilience.spec.ts` |
| **TC-1.4** | REST API | Transient 503 Failure Retry | Endpoint `/dispatch-records?failureMode=transient` returns 503 on attempts 1-2 | Automatically retries with exponential backoff and succeeds on attempt 3. | `test/e2e/workflow.spec.ts` |
| **TC-1.5** | REST API | Multi-resource Paginated Ingestion | Synchronous ingestion of `/batches`, `/work-orders`, `/dispatch-records`, `/receiving-records` | Fully ingests and assigns source record identifiers. | `test/e2e/workflow.spec.ts` |
| **TC-1.6** | Postgres | Schema Discovery | PostgreSQL connection pointing to `production_events` | Returns table list and columns (`batch_id`, `station`, `quantity`,...). | `test/e2e/workflow.spec.ts` |
| **TC-1.7** | Security | AES-256-GCM Encryption & Secret Masking | Registers PostgreSQL source with plaintext credentials | Password encrypted with AES-256. API responses only return `hasSecret: true`. | `test/unit/preflight-and-security.spec.ts` |
| **TC-1.8** | Pre-flight | Pre-flight Connection Ping Check | Ingestion triggered on an unreachable or misconfigured source | Safely aborts before scraping, marks source as `ERROR`, emits `PREFLIGHT_CONNECTION_FAILED`. | `test/unit/preflight-and-security.spec.ts` |

---

### Phase 2: Normalization & Deduplication

| ID | Group | Test Case Name | Scenario Description | Expected Outcome | Code Location |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **TC-2.1** | Normalization | UTC Timestamp Normalization | Raw payload contains local time string `2026-09-01 15:30:00` | Normalized to UTC Date `2026-09-01T08:30:00.000Z` (+07:00 to UTC). | `test/unit/provenance-and-normalization.spec.ts` |
| **TC-2.2** | Deduplication | Identical Observation Deduplication | Ingesting duplicate event `PROD-EVT-008` (FOLDING station, quantity 80) | Record 1 is `ACCEPTED`. Record 2 is `DUPLICATE`. Quantity stays 80 (not 160). | `test/unit/deduplication-resolver.spec.ts` |
| **TC-2.3** | Conflict | Source Authority Hierarchy | `RECEIVING` station: Crawler (120 units) vs API (100 units) | Crawler has higher authority at Station 1 ➔ Crawler is `ACCEPTED`, API is `CONFLICT`. | `test/unit/deduplication-resolver.spec.ts` |
| **TC-2.4** | Conflict | Observed Quantity $> 0$ Preference | `RECEIVING` station: `API-REC-001` (120 units) vs `batches-BATCH-001` (0 units) | Record with observed quantity $> 0$ wins ➔ `ACCEPTED`, placeholder 0 becomes `CONFLICT`. | `test/unit/deduplication-resolver.spec.ts` |

---

### Phase 3: Production State Engine & Invariants

| ID | Group | Test Case Name | Scenario Description | Expected Outcome | Code Location |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **TC-3.1** | State | Default PLANNED Status | Batch exists in Work Order but has no canonical events | `status = PLANNED`, `currentStation = null`, `completedQuantity = 0`. | `test/unit/production-state-evaluator.spec.ts` |
| **TC-3.2** | Station | Furthest Station Reached | Events present at Station 1 (RECEIVING) and Station 3 (WASHING) | `status = IN_PROGRESS`, `currentStation = WASHING`, `hasMissingData = true` (missing Station 2). | `test/unit/production-state-evaluator.spec.ts` |
| **TC-3.3** | Invariance | Late Event Invariance (No backward movement) | Current station is DRYING (Rank 4), receives late SORTING (Rank 2) event | Batch stays at DRYING. Missing data gap is resolved. | `test/unit/production-state-evaluator.spec.ts` |
| **TC-3.4** | Precedence | State Precedence: COMPLETED Overrides All | Batch has accepted DISPATCH event but manager applied a BLOCK | `status = COMPLETED`. Active block is ignored because linen has left factory. | `test/unit/production-state-evaluator.spec.ts` |
| **TC-3.5** | Precedence | BLOCKED State Halts Progression | In progress at Station 3 (WASHING), manager applies BLOCK | `status = BLOCKED`, `indicators.isBlocked = true`, `activeBlockReason = "Torn linen"`. | `test/unit/management-actions.spec.ts` |
| **TC-3.6** | Precedence | RESUME Restores Pipeline | Following a BLOCK, manager records RESUME action | `status = IN_PROGRESS`, `indicators.isBlocked = false`, clears active block reason. | `test/unit/management-actions.spec.ts` |
| **TC-3.7** | Invariance | Dispatch Invariance Protection | Attempting to BLOCK or RESUME a `COMPLETED` batch | Throws `InvalidOperationException` (HTTP 409 Conflict), protecting dispatched batches. | `test/unit/management-actions.spec.ts` |
| **TC-3.8** | Stale | Configurable Stale Detection | Last event occurred 20 mins ago (Default threshold 15 mins) | `indicators.isStale = true`. Dynamically raising threshold to 30 mins clears warning. | `test/unit/production-state-evaluator.spec.ts` |

---

### Phase 4: Management Actions & Provenance

| ID | Group | Test Case Name | Scenario Description | Expected Outcome | Code Location |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **TC-4.1** | Audit | Append-Only Management Audit Trail | Manager creates a NOTE and ACKNOWLEDGES an exception | Inserts new entry in `management_events` table with actor and timestamp. Never overwrites raw records. | `test/unit/management-actions.spec.ts` |
| **TC-4.2** | Provenance | Deterministic Station Order 1 ➔ 6 | Ingestion arrival order: Station 4 ➔ Station 1 ➔ Station 3 | Lineage is strictly sorted in chronological 6-station order (1 ➔ 6). | `test/unit/provenance-and-normalization.spec.ts` |
| **TC-4.3** | Provenance | Missing Intermediate Gap Indicator | Batch `BATCH-003` has Station 1 and 3, but skips Station 2 | `hasMissingData = true`, displayed with missing data warning badge. | `test/unit/provenance-and-normalization.spec.ts` |

---

### Phase 5: End-to-End Workflow & Docker Test Runner

| ID | Group | Test Case Name | Scenario Description | Expected Outcome | Code Location |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **TC-5.1** | E2E | Ingest 3 Sources & Generate 6-Station Board | Ingest Supplier Crawler ➔ PostgreSQL DB ➔ REST API | All 6 batches (`BATCH-001` to `BATCH-006`) mapped to 3 lines (`LINE-A`, `LINE-B`, `LINE-C`). | `test/e2e/workflow.spec.ts` |
| **TC-5.2** | E2E | Date ISO UTC Serialization Invariance | Calling API for `CollectionRun` and `Source` | All date fields (`startedAt`, `finishedAt`, `lastRunAt`) are valid ISO UTC strings, never `{}`. | `test/unit/preflight-and-security.spec.ts` |
| **TC-5.3** | Docker | Automated Docker Compose Test Runner | Execute `docker compose -f infrastructure/docker-compose.test.yml up` | Clean container spun up, runs all 30 test cases, exits with code 0 without MQTT dependency. | `infrastructure/docker-compose.test.yml` |

---

## 3. Test Execution Guide

### Running via local Jest runner:
```bash
cd backend
# Execute all 30 test cases:
npm test

# Run Unit Tests only:
npx jest --config ./test/jest.config.js test/unit

# Run E2E Tests only:
npx jest --config ./test/jest.config.js test/e2e
```

### Running via Docker Compose Test Runner:
```bash
docker compose -f infrastructure/docker-compose.test.yml up --build --abort-on-container-exit --exit-code-from backend-test
```
