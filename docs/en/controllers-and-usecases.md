# Controllers and Use Cases Documentation

This document provides a detailed mapping of all Controllers, HTTP Endpoints, Request/Response DTOs, invoked UseCases, and business logic execution steps.

---

## 1. `SourcesController` — `/api/v1/sources`

### 1.1 `POST /api/v1/sources` (Register Source)
* **Invoked UseCase:** `RegisterSourceUseCase`
* **Input DTO:** `RegisterSourceDto` (`name`, `type`, `config`, `secret?`, `selectedSchema?`)
* **Business Logic:**
  1. Generates a unique `sourceId`.
  2. Encrypts sensitive secrets using **AES-256-GCM** if provided.
  3. Pre-registration verification: Automatically tests connectivity against target endpoint/database.
  4. If handshake succeeds, sets initial status to `VERIFIED` (`lastVerifiedAt = now()`); if connection fails, initializes as `UNVERIFIED`.
  5. Saves entity to `sources` table in Platform DB and returns a sanitized response (without secret).

### 1.2 `GET /api/v1/sources` (List Sources)
* **Invoked UseCase:** `ListSourcesUseCase`
* **Business Logic:** Queries all sources for the active organization. Logging & Redaction interceptor replaces raw credentials with `hasSecret: true/false`.

### 1.3 `POST /api/v1/sources/:sourceId/test` (Test Connection / Re-test)
* **Invoked UseCase:** `TestSourceConnectionUseCase`
* **Business Logic:**
  1. Retrieves source and decrypts secret in-memory.
  2. Dispatches to matching Collector Adapter (`PostgresDbCollectorAdapter`, `CheerioWebCrawlerAdapter`, `AxiosRestClientAdapter`, `MosquittoMqttAdapter`).
  3. Pings target endpoint/database with a 5000ms timeout.
  4. If connected: updates `status = VERIFIED` and `lastVerifiedAt = now()`.
  5. If failed: updates `status = ERROR` and returns a sanitized error message.

### 1.4 `POST /api/v1/sources/:sourceId/discover` (Discover Schema)
* **Invoked UseCase:** `DiscoverSourceSchemaUseCase`
* **Business Logic:**
  1. For PostgreSQL: Queries `information_schema.tables` and `information_schema.columns` to list all tables and column types.
  2. For Web Crawler: Fetches the first page and parses table headers (`<th>`).
  3. For REST API: Returns available resource endpoints and schema models.

### 1.5 `PUT /api/v1/sources/:sourceId/selection` (Save Selection)
* **Invoked UseCase:** `SaveSourceSelectionUseCase`
* **Business Logic:** Updates `selectedSchema` (e.g. selected table `production_events`).

### 1.6 `POST /api/v1/sources/:sourceId/runs` (Trigger Manual Collection)
* **Invoked UseCase:** `RunCollectionUseCase` $\rightarrow$ `IngestionPipelineService`
* **Business Logic:**
  1. **Pre-flight Health Check:** Performs an automated connection test prior to collection. If endpoint is down, halts immediately with `PREFLIGHT_CONNECTION_FAILED`, sets `status = ERROR`, and saves run as `FAILED`, protecting the pipeline.
  2. Creates `CollectionRun` in `RUNNING` status.
  3. Executes collector adapter to fetch raw items.
  4. **Raw Observation Store:** Persists all raw observations into `source_observations` table (Append-only).
  5. **Normalization:** Parses `workOrderId`, `batchId`, `station`, `quantity`, `occurredAt`, `qualityStatus`. Isolates malformed rows into run error logs without failing the collection run.
  6. **Deduplication & Conflict Resolution (DeduplicationResolver):**
     - Clusters records by `(batchId, station)`.
     - Exact duplicates $\rightarrow$ marked `DUPLICATE` (does not multiply completed quantity).
     - Conflicting records $\rightarrow$ marked `CONFLICT` (winner chosen deterministically by source authority and revision).
     - Creates or updates `CanonicalEvent`.
  7. **Production State Recalculation:** Re-evaluates furthest station and status for all affected batches.
  8. Finalizes run duration, counters, and status (`SUCCEEDED` or `PARTIAL_SUCCESS`).

### 1.7 `PATCH /api/v1/sources/:sourceId/auto-sync` (Configure Auto-Sync)
* **Invoked UseCase:** `ConfigureAutoSyncUseCase`
* **Business Logic:** Enables/disables `autoSync` flag and sets `syncIntervalSeconds` (default 30s). `AutoSyncSchedulerService` polls background sources every 30s and records deduplicated runs.

---

## 2. `ProductionLinesController` — `/api/v1/production-lines`

### 2.1 `GET /api/v1/production-lines` (Get 6-Station Pipeline State)
* **Invoked UseCase:** `GetProductionLinesUseCase`
* **Business Logic:**
  1. Fetches configured `staleThresholdMinutes` (default 15m).
  2. Retrieves all batches, work orders, canonical events, and management events.
  3. Evaluates batch state using `ProductionStateEvaluator`:
     - **Furthest Station Reached:** Highest station rank among accepted canonical events.
     - **Never Move Backwards:** Late events from earlier stations do not decrease current station.
     - **State Precedence:** `COMPLETED` $\rightarrow$ `BLOCKED` $\rightarrow$ `IN_PROGRESS` $\rightarrow$ `PLANNED`.
     - **Indicators:** `STALE` (>15m), `MISSING_DATA` (gap in station sequence), `QUALITY` (quality failure).
  4. Calculates **Station WIP** and **Completed Quantity** per station.
  5. Groups by Line (`LINE-A`, `LINE-B`, `LINE-C`).

---

## 3. `BatchesController` — `/api/v1/batches`

### 3.1 `GET /api/v1/batches/:batchId` (Batch Detail)
* **Invoked UseCase:** `GetBatchDetailUseCase`
* **Business Logic:** Returns batch details, 6-station timeline, and management audit log.

### 3.2 `GET /api/v1/batches/:batchId/provenance` (End-to-End Provenance)
* **Invoked UseCase:** `GetBatchProvenanceUseCase`
* **Business Logic:**
  1. Traces full lineage for each station: Canonical Event $\rightarrow$ Contributing Normalized Records $\rightarrow$ Raw Source Observations $\rightarrow$ Source Name & Collection Run IDs.
  2. **Deterministic Station Order:** Sorts `lineage` strictly in ascending station rank (Station 1 `RECEIVING` ➔ Station 6 `DISPATCH`).
  3. Winner record is sorted to the top with verified badge.
  4. Missing intermediate stations render the amber `⚠️ Thiếu Dữ Liệu (Missing Data Gap)` indicator card.

### 3.3 `POST /api/v1/batches/:batchId/management-events/blocks` (Block Batch)
* **Invoked UseCase:** `BlockBatchUseCase`
* **Business Logic:**
  1. Verifies batch is not already `COMPLETED` (Station 6 Dispatch invariant). If completed, throws `InvalidOperationException` (409 Conflict).
  2. Appends `BLOCK` management event with `actorName`, `reason`, and `timestamp`.
  3. Synchronizes `batch.status = BLOCKED`, `activeBlockReason`, `activeBlockActor`, and `activeBlockTimestamp` in the database.

### 3.4 `POST /api/v1/batches/:batchId/management-events/resumes` (Resume Batch)
* **Invoked UseCase:** `ResumeBatchUseCase`
* **Business Logic:**
  1. Verifies batch is not `COMPLETED`. If completed, throws `InvalidOperationException` (409 Conflict).
  2. Appends `RESUME` management event, clearing block metadata and restoring batch state to `IN_PROGRESS`.

### 3.5 `POST /api/v1/batches/:batchId/management-events/notes` (Add Note)
* **Invoked UseCase:** `AddBatchNoteUseCase`
* **Business Logic:** Appends note to management audit stream. Operators can add notes at any time regardless of batch state.
