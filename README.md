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
* **Observation identity:** Raw observations are always appended. A normalized observation identity is `(organizationId, sourceId, sourceRecordId, sourceRevision)` and is checked against persisted history, so manual and auto-sync runs behave identically.
* **Canonical business slot:** Operational records compete within `(organizationId, batchId, station)`. REST `/work-orders` and `/batches` are metadata upserts only; they never create a zero-quantity `RECEIVING` event.
* **Deduplication:** The same observation identity with the same canonical business content becomes `DUPLICATE`. Semantic comparison recursively sorts payload keys and ignores transport/provenance fields (`row_id`, `recorded_at`, `sourceTable`, `sourcePage`, `resourceType`). Raw and normalized evidence remains queryable, while quantity is counted once.
* **Conflict Resolution:** A repeated identity with changed business content, or competing content in the same canonical slot, becomes `CONFLICT`. The winner is selected by:
  1. *Station Source Authority:* `RECEIVING` (Crawler > API > DB), `SORTING`-`FOLDING` (DB > API > MQTT), `DISPATCH` (API > DB).
  2. *Source Revision:* Higher revision wins.
  3. *Occurred Time:* More recent timestamp wins.
  4. *Stable tie-breaker:* Lexical `(sourceId, sourceRecordId)`, then normalized record ID.
* **Trade-off:** Persisted identity lookups cost database I/O, but correctness survives restarts and multiple collection runs. A unique database index protects each canonical business slot.

### 2. Explicit Discovery & Collection Selection
* PostgreSQL requires an explicitly selected table, validates identifiers and discovered columns, retains required normalization plus primary-key/source identity columns internally, and rejects tables without a stable identity.
* REST collects only saved resources; the crawler emits only saved headers while retaining its stable row identity independently.
* Collection is rejected when no saved selection exists. This makes discovery and selection functional controls rather than informational UI.

### 3. Dual Isolated PostgreSQL Containers (Platform DB vs Production Source DB)
* **Decision:** We provision two distinct PostgreSQL services in Docker Compose:
  - `platform-db` (Port 5432): Stores system tables (`sources`, `runs`, `observations`, `normalized_records`, `canonical_events`, `management_events`).
  - `production-db` (Port 5433): Simulates existing factory machine database.
* **Trade-off:** Increases Docker Compose memory slightly compared to a single DB with multiple schemas, but provides faithful network separation, allowing true database discovery, connection verification, and isolated credential testing.

### 4. Append-Only Management Audit Stream vs Mutable State
* **Decision:** The platform never modifies historical raw observations or deletes previous management actions. Management actions (`BLOCK`, `RESUME`, `ACKNOWLEDGE`, `NOTE`) are stored in an append-only table with actor and timestamp.
* **Batch Projection:** Current batch status and station position are dynamically projected from the stream of canonical events and management events.
* **Trade-off:** Dynamic evaluation requires a domain evaluator run, but guarantees auditability and deterministic reconstruction.

### 5. Zero Credential Exposure
* **Decision:** Passwords and connection secrets are encrypted with **AES-256-GCM** using `SOURCE_SECRET_ENCRYPTION_KEY`. Runtime database passwords and this key must be supplied through environment variables; Compose and `.env.example` contain no usable credential defaults.
* **Masking:** API responses and UI forms never return or redisplay passwords. The API returns `hasSecret: true/false`; global interception and exception handling redact passwords, connection strings, authorization tokens, API keys, client secrets, and private keys.
* **Local setup:** Copy `.env.example` to an untracked `.env`, generate distinct random values, and never commit it. If earlier repository history was shared with real secrets, rotate them; this working-tree fix does not rewrite Git history.

### 6. Optional MQTT Isolation
* **Decision:** Mosquitto MQTT is packaged under an optional Compose profile (`mqtt`). Backend does not depend on Mosquitto at startup.
* **Trade-off:** Prevents MQTT broker startup failures from breaking core factory visibility or CI/CD test runners.

### 7. Pre-Registration Verification & Pre-Flight Health Check on Collection
* **Decision:** The specification requires that users can *"Register and verify the database connection before use"* and *"Register and test a source"*. Rather than a fragmented experience where users save an unverified source and must manually locate the card to test it, the registration flow automatically verifies connectivity (`testConnection`) upon creation, saving new sources in `VERIFIED` status (`● Verified`).
* **Pre-flight Health Check:** In `RunCollectionUseCase`, an automated pre-flight connectivity check tests the endpoint prior to scraping. If the target service is unreachable, it halts immediately with `PREFLIGHT_CONNECTION_FAILED`, marking the source in error and preventing corrupted collection runs.
* **Trade-off:** Adds an instantaneous pre-flight ping (~10-25ms) before scraping, but guarantees zero aborted collection runs caused by network blips or bad credentials.

### 8. Deterministic 6-Station Provenance Order & Visual Missing Data Gap
* **Decision:** In lineage tracing (`GetBatchProvenanceUseCase`), canonical events are sorted strictly in ascending station rank (Station 1 `RECEIVING` ➔ Station 6 `DISPATCH`), regardless of asynchronous collection order or database insertion timestamps.
* **Missing-Data Indicator:** Per the assessment rule (*"A later-station event may place a batch in progress even when an earlier event is missing, but the batch must display a missing-data indicator"*), the Provenance tab detects missing intermediate stages (such as Station 02 `SORTING` on `BATCH-003`) and explicitly renders an amber warning card: `⚠️ Thiếu Dữ Liệu (Missing Data Gap)` with a full explanation.
* **Provenance KPI Strip:** A 4-metric strip at the top of the Provenance drawer summarizes Stages Reached (e.g. 4/6), Verified Stations (3/4), Missing Stations (1), and Total Raw Observations across all sync cycles.

### 9. Plant Manager Dispatch Invariance (Completed Batch Immutability)
* **Decision:** Once a batch has completed Station 6 (`DISPATCH`) and entered `COMPLETED` status, domain use cases (`BlockBatchUseCase`, `ResumeBatchUseCase`) deterministically reject blocking or modifying operations with a 409 Conflict, preserving production immutability.
* **Audit Trail:** Operators can still append audit notes, but physical production blocks on dispatched goods are strictly prohibited.

### 10. 30-Second Background Auto-Sync & Deduplication Provenance
* **Decision:** `AutoSyncSchedulerService` periodically scrapes enabled sources every 30 seconds. Duplicate observations over hundreds of sync runs are deduplicated into a single canonical event without inflating completed quantities, and are auditable in Provenance as `"Observed N times via Auto-Sync (Deduplicated)"`.

---

## 🚀 Quick Start with Docker Compose

### 1. Start Full Application (All Services + UI):
```bash
# 1. Create your local untracked .env file from the template:
cp .env.example .env

# 2. Start all services:
docker compose --env-file .env -f infrastructure/docker-compose.yml up --build
```
* **Frontend Web App:** [http://localhost:3000](http://localhost:3000)
* **Backend REST API:** [http://localhost:4000](http://localhost:4000)
* **Supplier Portal HTML Fixture:** [http://localhost:4000/fixtures/supplier/deliveries](http://localhost:4000/fixtures/supplier/deliveries)

### 2. Run Automated Backend Tests in Isolation (No .env required, No Frontend, No MQTT):
```bash
docker compose -f infrastructure/docker-compose.test.yml up --build --abort-on-container-exit --exit-code-from backend-test
```

---

## 🔬 Performance Benchmark Note

The repository retains comparative benchmark material under [`benchmark/`](benchmark/) as design research. The production ingestion correctness path deliberately uses persisted observation history rather than the benchmark `FingerprintCacheService`: persistence is slower than a process-local cache, but survives restarts and supports deterministic cross-run auditability without cache-loss false negatives.

---

## 🧪 Verified Test & Build Status

The following commands were verified in the current working tree:

| Command | Result |
| :--- | :--- |
| `cd backend && npm run build` | Passed |
| `cd backend && npm test` | 7 unit suites, 30 tests passed |
| `cd frontend && npm run build` | Passed on Next.js 16.3.4 / React 19 |
| Docker Compose Test Runner | Passed (30 unit tests + 3 integrated E2E tests, exit code 0) |

The database-backed E2E suite is separate from the unit command and does not swallow bootstrap failures. Run it through the isolated Docker runner:

```bash
# Fast infrastructure-independent unit suite
cd backend && npm test

# Database-backed E2E/full container verification
docker compose -f infrastructure/docker-compose.test.yml up --build --abort-on-container-exit --exit-code-from backend-test
```

See [`docs/en/testing-strategy.md`](docs/en/testing-strategy.md) for the exact verified matrix and remaining environment-dependent checks.
