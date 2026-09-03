# System Architecture Documentation

The platform is designed following **Clean Architecture (Domain-Driven Design)** principles on the Backend and a **Feature-First Layered Architecture** on the Frontend.

---

## 1. System Architecture Diagram

```mermaid
flowchart TD
    subgraph Sources ["Local Source Fixtures"]
        S1["🌐 Supplier Portal HTML (Station 1: RECEIVING)"]
        S2["🗄️ PostgreSQL Production DB (Stations 2-5: SORTING - FOLDING)"]
        S3["🔌 Application Core REST API (Station 6: DISPATCH & Work Orders)"]
        S4["📡 Mosquitto MQTT (Optional: Telemetry)"]
    end

    subgraph Backend ["Backend NestJS 11 - Clean Architecture"]
        subgraph Presentation ["Presentation Layer"]
            C1["SourcesController"]
            C2["ProductionLinesController"]
            C3["BatchesController"]
            C4["FixturesController"]
        end

        subgraph Application ["Application Layer"]
            UC1["Source UseCases"]
            UC2["RunCollectionUseCase"]
            UC3["IngestionPipelineService"]
            UC4["GetProductionLinesUseCase"]
            UC5["ManagementAction UseCases"]
        end

        subgraph Domain ["Domain Layer - Pure TypeScript"]
            D1["Entities: Source, Batch, CanonicalEvent..."]
            D2["ProductionStateEvaluator Service"]
            D3["DeduplicationResolver Service"]
            D4["Enums & Domain Exceptions"]
        end

        subgraph Infrastructure ["Infrastructure Layer"]
            I1["TypeORM Repositories"]
            I2["Collector Adapters: Cheerio, Postgres, Axios, MQTT"]
            I3["AES-256-GCM Encryption Service"]
            I4["Auto-Sync Task Scheduler"]
        end
    end

    subgraph PlatformDB ["PostgreSQL Platform Database"]
        DB1[("sources, collection_runs, source_observations")]
        DB2[("normalized_records, canonical_events")]
        DB3[("batches, work_orders, management_events")]
    end

    subgraph Frontend ["Frontend Next.js 16 / React 19"]
        UI1["🖥️ Data Sources Management (/data-sources)"]
        UI2["🏭 Production Lines 6-Station Board (/production-lines)"]
        UI3["🗂️ Collapsible Sidebar + Dark/Light Theme + i18n"]
    end

    S1 --> I2
    S2 --> I2
    S3 --> I2
    S4 --> I2
    I2 --> UC3
    UC3 --> D3
    D3 --> I1
    I1 --> DB1
    I1 --> DB2
    I1 --> DB3
    Presentation --> Application
    Application --> Domain
    Infrastructure --> Application
    Frontend <--> Presentation
```

---

## 2. Architectural Layers Breakdown

### Backend Clean Architecture Layers:
1. **Domain Layer (`src/domain`):**
   - Pure TypeScript entities (`Source`, `Batch`, `CanonicalEvent`, `NormalizedRecord`, `SourceObservation`, `ManagementEvent`).
   - Domain services (`ProductionStateEvaluator`, `DeduplicationResolver`).
   - Pure Domain Exceptions (`SourceNotFoundException`, `BatchNotFoundException`, `InvalidOperationException`).
   - Repository interfaces (`ISourceRepository`, `IBatchRepository`, `ICanonicalEventRepository`).
2. **Application Layer (`src/application`):**
   - Single-responsibility UseCases with a single concise `execute()` method.
   - Core orchestration service (`IngestionPipelineService`).
   - Ports & DTOs (`ICollectorAdapter`, `IEncryptionService`).
3. **Infrastructure Layer (`src/infrastructure`):**
   - Collector adapters (`CheerioWebCrawlerAdapter`, `PostgresDbCollectorAdapter`, `AxiosRestClientAdapter`, `MosquittoMqttAdapter`).
   - TypeORM repositories & PostgreSQL entity mappings.
   - `Aes256EncryptionService` for encryption at rest.
   - `AutoSyncSchedulerService` for dynamic background polling.
4. **Presentation Layer (`src/presentation`):**
   - NestJS REST Controllers with request validation DTOs.
   - `GlobalExceptionFilter` mapping domain exceptions to safe sanitized HTTP error responses.
   - `LoggingAndRedactionInterceptor` stripping passwords and sensitive tokens from API payloads.

---

## 3. Invariant Business Rules
1. **Dependency Rule:** Domain layer never imports from outer layers. Application layer depends only on Domain.
2. **Security Rule:** Secrets are encrypted using AES-256-GCM at rest and never exposed in logs or API responses.
3. **Pre-flight & Pre-registration Health Checks:** Endpoints are verified during registration and tested before collection runs to prevent pipeline failures.
4. **Plant Manager Dispatch Invariance:** Dispatched batches at Station 6 (`COMPLETED`) cannot be blocked or resumed; physical production actions are prohibited.
5. **Deterministic Lineage Sorting (1 -> 6):** Lineage tracing strictly ascends from Station 01 to 06, visually indicating missing intermediate data gaps (`⚠️ Thiếu Dữ Liệu`).
6. **State Precedence:** `COMPLETED` $\rightarrow$ `BLOCKED` $\rightarrow$ `IN_PROGRESS` $\rightarrow$ `PLANNED`.
7. **Furthest Station Reached:** Current station is the highest station rank achieved by an accepted canonical event. Late events from earlier stations update history without moving the batch backwards.
8. **Deduplication Policy:** Exact duplicate source observations do not multiply completed quantities. Conflicting records are resolved deterministically based on source authority and revision.
