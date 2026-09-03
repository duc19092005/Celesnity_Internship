# Tài liệu Kiến trúc Hệ thống (System Architecture)

Hệ thống được thiết kế theo mô hình **Clean Architecture (Domain-Driven Design)** ở Backend và **Feature-First Layered Architecture** ở Frontend.

---

## 1. Sơ đồ Kiến trúc Tổng thể

```mermaid
flowchart TD
    subgraph Sources ["Nguồn Dữ Liệu Cục Bộ (Local Fixtures)"]
        S1["🌐 Supplier Portal HTML (Trạm 1: RECEIVING)"]
        S2["🗄️ PostgreSQL Production DB (Trạm 2-5: SORTING - FOLDING)"]
        S3["🔌 Application Core REST API (Trạm 6: DISPATCH & Work Orders)"]
        S4["📡 Mosquitto MQTT (Tùy chọn: Telemetry)"]
    end

    subgraph Backend ["Backend NestJS 11 - Clean Architecture"]
        subgraph Presentation ["Tầng Presentation"]
            C1["SourcesController"]
            C2["ProductionLinesController"]
            C3["BatchesController"]
            C4["FixturesController"]
        end

        subgraph Application ["Tầng Application"]
            UC1["Source UseCases"]
            UC2["RunCollectionUseCase"]
            UC3["IngestionPipelineService"]
            UC4["GetProductionLinesUseCase"]
            UC5["ManagementAction UseCases"]
        end

        subgraph Domain ["Tầng Domain - Pure TypeScript"]
            D1["Entities: Source, Batch, CanonicalEvent..."]
            D2["ProductionStateEvaluator Service"]
            D3["DeduplicationResolver Service"]
            D4["Enums & Domain Exceptions"]
        end

        subgraph Infrastructure ["Tầng Infrastructure"]
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

## 2. Các Quy tắc Bất biến trong Kiến trúc
1. **Quy tắc Phụ thuộc (Dependency Rule):** Tầng Domain không bao giờ import từ các tầng ngoài. Tầng Application chỉ phụ thuộc vào Domain.
2. **Quy tắc Bảo mật:** Mật khẩu kết nối được mã hóa AES-256 trong Database và không bao giờ xuất hiện ở API response hay Log.
3. **Quy tắc Kiểm tra Sức khỏe (Pre-flight & Pre-registration):** Mọi nguồn đều được kiểm tra kết nối ngay khi đăng ký và tự động kiểm tra trước mỗi đợt cào dữ liệu để phòng ngừa sự cố đường ống.
4. **Bảo vệ Lô Hàng Đã Xuất Xưởng (Plant Manager Invariance):** Lô hàng đã xuất xưởng tại Trạm 6 (`COMPLETED`) không thể bị tạm dừng (BLOCK) hay can thiệp vận hành; sản phẩm đã hoàn thành có tính bất biến tuyệt đối.
5. **Thứ Tự Dòng Dữ Liệu Tất Định (1 ➔ 6):** Bảng truy vết (Provenance) luôn sắp xếp công đoạn tăng dần từ Trạm 01 đến 06, trực quan hóa rõ ràng các công đoạn thiếu dữ liệu (`⚠️ Thiếu Dữ Liệu`).
6. **Quy tắc Trạng thái Dây chuyền:**
   - Lô hàng không bao giờ bị lùi trạm (`Never move backwards`).
   - Thứ tự ưu tiên trạng thái: `COMPLETED` $\rightarrow$ `BLOCKED` $\rightarrow$ `IN_PROGRESS` $\rightarrow$ `PLANNED`.
   - Khử trùng lặp sản lượng hoàn thành (`Deduplicated completed quantity`).
   - Đồng bộ ngầm 30 giây với lưu vết khử trùng lặp minh bạch.
