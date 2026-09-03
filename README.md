# Factory Data & Production Line Platform

> **Track:** Software Track — Factory Data and Production Line  
> **Framework:** TypeScript, Node.js 22+, NestJS 11 (Clean Architecture), Next.js 16 (React 19), PostgreSQL, Docker Compose.

---

## 🌟 Overview & Objectives
An industrial laundry operational platform that connects fragmented factory data across local sources, normalizes it into a traceable operational dataset, and visualizes/manages the production-line status across six fixed stations:
1. `RECEIVING` (Supplier Web Crawler)
2. `SORTING` (Production Database)
3. `WASHING` (Production Database / Optional MQTT)
4. `DRYING` (Production Database / Optional MQTT)
5. `FOLDING` (Production Database)
6. `DISPATCH` (Application REST API)

---

## 🧭 Routes & Endpoints Reference

### 1. Frontend Web Interfaces:
* **Overview Dashboard:** `http://localhost:3000/`
* **Data Sources Management:** `http://localhost:3000/data-sources`
* **Production Lines 6-Station Board:** `http://localhost:3000/production-lines`

### 2. Backend REST API Endpoints (`http://localhost:4000`):
* `POST /api/v1/sources`: Register new data source (encrypted secret)
* `GET  /api/v1/sources`: List registered sources (masked credentials)
* `POST /api/v1/sources/:sourceId/test`: Test source connectivity & measure latency
* `POST /api/v1/sources/:sourceId/discover`: Discover available tables/columns/headers
* `PUT  /api/v1/sources/:sourceId/selection`: Save selected production table/fields
* `POST /api/v1/sources/:sourceId/runs`: Trigger manual collection run
* `GET  /api/v1/sources/:sourceId/runs`: View run history & logs
* `PATCH /api/v1/sources/:sourceId/auto-sync`: Configure background auto-sync
* `GET  /api/v1/collection-runs/:runId`: Get run breakdown (observed, accepted, duplicates, errors)
* `GET  /api/v1/collection-runs/:runId/records`: Preview normalized records with provenance
* `GET  /api/v1/production-lines`: Get 6-station line status, WIP, completed qty, indicators
* `GET  /api/v1/batches/:batchId`: Get batch detail and 6-station timeline
* `GET  /api/v1/batches/:batchId/provenance`: End-to-end lineage tracing to raw source observations
* `POST /api/v1/batches/:batchId/management-events/blocks`: Block batch with reason (Append-only)
* `POST /api/v1/batches/:batchId/management-events/resumes`: Resume batch (Append-only)
* `POST /api/v1/batches/:batchId/management-events/acknowledgements`: Acknowledge exception
* `POST /api/v1/batches/:batchId/management-events/notes`: Add operator note
* `GET  /api/v1/settings/stale-threshold`: Get current stale alert threshold
* `PUT  /api/v1/settings/stale-threshold`: Update stale alert threshold (minutes)

### 3. Local Fixtures & Simulators:
* `GET /fixtures/supplier/deliveries?page=1`: Paginated HTML Supplier Portal
* `GET /fixtures/application-api/work-orders`: Work orders resource
* `GET /fixtures/application-api/batches`: Batch to work order & line mapping
* `GET /fixtures/application-api/receiving-records`: Receiving records
* `GET /fixtures/application-api/dispatch-records`: Station 6 Dispatch records (supports `?failureMode=transient`)

---

## ⚖️ Assumptions, Design Decisions & Trade-offs

The assessment specification explicitly states:
> *"Where the requirements leave implementation choices open, document your assumptions, design decisions, and trade-offs in the README. We will assess whether your chosen approach is deterministic, internally consistent, appropriately tested, and clearly explained."*

Here is our documented design rationale:

### 1. Deterministic Deduplication & Conflict Policy
* **Decision:** Group records by natural identity key `(organizationId, batchId, station, sourceRecordId)`.
* **Deduplication:** Identical payload -> `DUPLICATE`. The first accepted canonical event retains the quantity; duplicates are retained as raw observations for provenance but **do not multiply the completed quantity**.
* **Conflict Resolution:** Different payload for the same identity -> `CONFLICT`. Winner chosen deterministically via a 4-tier tuple:
  1. *Station Source Authority:* `RECEIVING` (Crawler > API > DB), `SORTING`-`FOLDING` (DB > API > MQTT), `DISPATCH` (API > DB).
  2. *Source Revision:* Higher revision number wins.
  3. *Occurred Time:* More recent timestamp wins.
  4. *Deterministic Tie-breaker:* Lexical sort of Record ID.
* **Trade-off:** Calculating canonical winners in memory during ingestion is deterministic and fast for batch processing, avoiding nondeterministic database locking order.

### 2. Dual Isolated PostgreSQL Containers (Platform DB vs Production Source DB)
* **Decision:** We provision two distinct PostgreSQL services in Docker Compose:
  - `platform-db` (Port 5432): Stores system tables (`sources`, `runs`, `observations`, `normalized_records`, `canonical_events`, `management_events`).
  - `production-db` (Port 5433): Simulates existing factory machine database.
* **Trade-off:** Increases Docker Compose memory slightly compared to a single DB with multiple schemas, but provides 100% faithful network separation, allowing true database discovery, connection verification, and isolated credential testing.

### 3. Append-Only Management Audit Stream vs Mutable State
* **Decision:** The platform never modifies historical raw observations or deletes previous management actions. Management actions (`BLOCK`, `RESUME`, `ACKNOWLEDGE`, `NOTE`) are stored in an append-only table with actor and timestamp.
* **Batch Projection:** Current batch status and station position are dynamically projected from the stream of canonical events and management events.
* **Trade-off:** Dynamic evaluation requires a domain evaluator run, but guarantees auditability, zero risk of data loss, and eliminates race conditions.

### 4. Zero Credential Exposure
* **Decision:** Passwords and connection secrets are encrypted with **AES-256-GCM** using an environment key (`SOURCE_SECRET_ENCRYPTION_KEY`).
* **Masking:** API responses and UI forms never return or redisplay the password. The API returns `hasSecret: true/false`. Global interceptors redact `password`, `secret`, `authorization`, and `token` from all logs and error messages.

### 5. Optional MQTT Isolation
* **Decision:** Mosquitto MQTT is packaged under an optional Compose profile (`mqtt`). Backend does not depend on Mosquitto at startup.
* **Trade-off:** Prevents MQTT broker startup failures from breaking core factory visibility or CI/CD test runners.

### 6. Pre-Registration Verification & Pre-Flight Health Check on Collection
* **Decision:** The specification requires that users can *"Register and verify the database connection before use"* and *"Register and test a source"*. Rather than a fragmented experience where users save an unverified source and must manually locate the card to test it, the registration flow automatically verifies connectivity (`testConnection`) upon creation, saving new sources in `VERIFIED` status (`● Verified`).
* **Pre-flight Health Check:** In `RunCollectionUseCase`, an automated pre-flight connectivity check tests the endpoint prior to scraping. If the target service is unreachable, it halts immediately with `PREFLIGHT_CONNECTION_FAILED`, marking the source in error and preventing corrupted collection runs.
* **Trade-off:** Adds an instantaneous pre-flight ping (~10-25ms) before scraping, but guarantees zero aborted collection runs caused by network blips or bad credentials.

### 7. Deterministic 6-Station Provenance Order & Visual Missing Data Gap
* **Decision:** In lineage tracing (`GetBatchProvenanceUseCase`), canonical events are sorted strictly in ascending station rank (Station 1 `RECEIVING` ➔ Station 6 `DISPATCH`), regardless of asynchronous collection order or database insertion timestamps.
* **Missing-Data Indicator:** Per the assessment rule (*"A later-station event may place a batch in progress even when an earlier event is missing, but the batch must display a missing-data indicator"*), the Provenance tab detects missing intermediate stages (such as Station 02 `SORTING` on `BATCH-003`) and explicitly renders an amber warning card: `⚠️ Thiếu Dữ Liệu (Missing Data Gap)` with a full explanation.
* **Provenance KPI Strip:** A 4-metric strip at the top of the Provenance drawer summarizes Stages Reached (e.g. 4/6), Verified Stations (3/4), Missing Stations (1), and Total Raw Observations across all sync cycles.

### 8. Plant Manager Dispatch Invariance (Completed Batch Immutability)
* **Decision:** Once a batch has completed Station 6 (`DISPATCH`) and entered `COMPLETED` status, domain use cases (`BlockBatchUseCase`, `ResumeBatchUseCase`) deterministically reject blocking or modifying operations with a 409 Conflict, preserving production immutability.
* **Audit Trail:** Operators can still append audit notes, but physical production blocks on dispatched goods are strictly prohibited.

### 9. 30-Second Background Auto-Sync & Deduplication Provenance
* **Decision:** `AutoSyncSchedulerService` periodically scrapes enabled sources every 30 seconds. Duplicate observations over hundreds of sync runs are deduplicated into a single canonical event without inflating completed quantities, and are auditable in Provenance as `"Observed N times via Auto-Sync (Deduplicated)"`.

---

## 🚀 Quick Start with Docker Compose

### 1. Start Full Application (All Services + UI):
```bash
docker compose -f infrastructure/docker-compose.yml up --build
```
* **Frontend Web App:** [http://localhost:3000](http://localhost:3000)
* **Backend REST API:** [http://localhost:4000](http://localhost:4000)
* **Supplier Portal HTML Fixture:** [http://localhost:4000/fixtures/supplier/deliveries](http://localhost:4000/fixtures/supplier/deliveries)

### 2. Run Automated Backend Tests in Isolation (No Frontend, No MQTT required):
```bash
docker compose -f infrastructure/docker-compose.test.yml up --build --abort-on-container-exit --exit-code-from backend-test
```

---

## 🔬 Performance Benchmark Summary: 128-Bit In-Memory Fingerprint vs Bloom Filter vs Database Query

To address the I/O bottleneck of continuous 30-second polling (`Auto-Sync`) across high-throughput factory sources without risking the false-positive data loss of Bloom Filters, we designed and implemented a **128-Bit In-Memory Fingerprint Engine** (`FingerprintCacheService`).

### Key Highlights:
* **2,680x Speedup Over Database:** Processes 50,000 records in **175 ms** (~285,000 ops/s) vs 459 seconds (~109 ops/s) for direct PostgreSQL queries.
* **100% Deterministic Accuracy:** 0% False Positives with an address space of 2¹²⁸ (approx. 3.4 × 10³⁸).
* **Zero Database Load:** Ingests and filters raw observations entirely in memory.

![Deduplication Benchmark Comparison](benchmark/benchmark_results_en.png)

👉 **[Read the Full In-Depth Benchmark Report & Detailed Trade-Offs Analysis](benchmark/README.md)**
*(Includes raw measurement JSON datasets, methodology, Python visualization scripts, and reproducible Docker runners).*

---

## 🧪 Comprehensive 5-Phase Testing Strategy (30 Tests, 100% Pass)

The platform is backed by a rigorous, automated testing suite adhering to **Rule 60** and **Rule 80**, covering every operational stage across 5 phases:

| Phase | Test Scope & Invariants Covered | Test Count | Pass Rate |
| :--- | :--- | :---: | :---: |
| **Phase 1: Ingestion & Resilience** | Pagination loops, Malformed row isolation, 503 retry, Pre-flight ping, AES-256 secret masking | 8 Tests | 100% |
| **Phase 2: Normalization & Deduplication** | UTC normalization, 0-quantity tie-breaker, Identical deduplication, Source authority hierarchy | 4 Tests | 100% |
| **Phase 3: Production State Engine** | State precedence (COMPLETED > BLOCKED > IN_PROGRESS), Furthest station rule, Late event invariance, Dispatch lock | 8 Tests | 100% |
| **Phase 4: Management Actions & Provenance** | Append-only audit trail (BLOCK, RESUME, ACKNOWLEDGE, NOTE), Deterministic 1 ➔ 6 station lineage order, Missing data detection | 4 Tests | 100% |
| **Phase 5: E2E Workflow & Container Runner** | 3-source fixture ingestion, 3-line board generation, Date ISO UTC preservation, Docker Test Runner | 6 Tests | 100% |
| **Total Automated Tests** | **Unit & E2E Suites** | **30 Tests** | **100% Pass** |

### Run Tests:
```bash
# Run all tests locally via Jest:
cd backend && npm test

# Run isolated tests in Docker container:
docker compose -f infrastructure/docker-compose.test.yml up --build --abort-on-container-exit --exit-code-from backend-test
```

👉 **[Read the Full 5-Phase Testing Strategy & Detailed Test Matrix Document](docs/en/testing-strategy.md)**
