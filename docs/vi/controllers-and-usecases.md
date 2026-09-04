# Hướng dẫn Bộ Điều khiển (Controllers) và Các Trường hợp Sử dụng (UseCases)

Tài liệu này mô tả chi tiết danh sách tất cả các Controller, Endpoint HTTP, DTOs, UseCase được gọi và phân tích logic nghiệp vụ từng bước.

---

## 1. `SourcesController` — `/api/v1/sources`

### 1.1 `POST /api/v1/sources` (Đăng ký Nguồn Dữ Liệu Mới)
* **UseCase được gọi:** `RegisterSourceUseCase`
* **DTO Đầu vào:** `RegisterSourceDto` (`name`, `type`, `config`, `secret?`, `selectedSchema?`)
* **Logic Nghiệp vụ:**
  1. Tạo mã định danh nguồn `sourceId`.
  2. Nếu có `secret` (mật khẩu/token), mã hóa chuẩn **AES-256-GCM** trước khi lưu.
  3. **Tự động xác thực kết nối tức thì (Pre-registration Verification):** Hệ thống lập tức thực hiện ping kiểm tra cổng kết nối/database tương ứng.
  4. Nếu kết nối thành công: Gán trạng thái ban đầu `VERIFIED` (`lastVerifiedAt = now()`); nếu thất bại: gán `UNVERIFIED`.
  5. Lưu thực thể vào bảng `sources` trong Database hệ thống và trả về đối tượng an toàn (đã che secret).

### 1.2 `GET /api/v1/sources` (Lấy Danh Sách Nguồn)
* **UseCase được gọi:** `ListSourcesUseCase`
* **Logic Nghiệp vụ:**
  1. Truy vấn toàn bộ nguồn thuộc tổ chức `organizationId`.
  2. Tầng Interceptor tự động ẩn chuỗi mật khẩu và thay thế bằng cờ `hasSecret: true/false`.

### 1.3 `POST /api/v1/sources/:sourceId/test` (Kiểm Tra Lại Kết Nối / Re-test)
* **UseCase được gọi:** `TestSourceConnectionUseCase`
* **Logic Nghiệp vụ:**
  1. Tìm nguồn theo `sourceId`.
  2. Giải mã `encryptedSecret` trong bộ nhớ (nếu có).
  3. Chọn Adapter tương ứng (`PostgresDbCollectorAdapter`, `CheerioWebCrawlerAdapter`, `AxiosRestClientAdapter`, `MosquittoMqttAdapter`).
  4. Thực hiện ping/kết nối thử nghiệm đến nguồn với timeout tối đa 5000ms.
  5. Nếu thành công: cập nhật `status = VERIFIED` và `lastVerifiedAt = now()`.
  6. Nếu thất bại: cập nhật `status = ERROR` và trả về thông báo lỗi đã được khử thông tin nhạy cảm.

### 1.4 `POST /api/v1/sources/:sourceId/discover` (Khám Phá Schema / Cấu Trúc)
* **UseCase được gọi:** `DiscoverSourceSchemaUseCase`
* **Logic Nghiệp vụ:**
  1. Đối với PostgreSQL: Truy vấn `information_schema.tables` và `information_schema.columns` để lấy danh sách bảng và kiểu dữ liệu từng cột.
  2. Đối với Web Crawler: Cào trang đầu tiên và trích xuất danh sách tiêu đề bảng (`<th>`).
  3. Đối với REST API: Trả về danh sách endpoints và trường chuẩn.

### 1.5 `PUT /api/v1/sources/:sourceId/selection` (Lưu Cấu Hình Chọn Bảng/Trường)
* **UseCase được gọi:** `SaveSourceSelectionUseCase`
* **Logic Nghiệp vụ:** Kiểm tra và lưu contract theo loại nguồn: PostgreSQL có `selectedTable` và `selectedColumns` tùy chọn; REST có `resources`; crawler có `headers`. Collection chỉ dùng selection đã lưu và bị từ chối nếu chưa có selection.

### 1.6 `POST /api/v1/sources/:sourceId/runs` (Kích Hoạt Thu Thập Dữ Liệu)
* **UseCase được gọi:** `RunCollectionUseCase` $\rightarrow$ `IngestionPipelineService`
* **Logic Nghiệp vụ Chi Tiết:**
  1. Bắt buộc có selection đã lưu, sau đó chạy pre-flight connection check. Nếu thất bại, dừng với `PREFLIGHT_CONNECTION_FAILED` và đánh dấu source lỗi.
  2. Tạo `CollectionRun` ở trạng thái `RUNNING` và chạy đúng contract collector đã chọn.
  3. **Raw Observation:** Lưu mọi item vào `source_observations` theo append-only.
  4. **Materialize REST metadata:** Upsert `/work-orders` và `/batches` vào bảng metadata, không tạo sự kiện trạm; batch chỉ có metadata vẫn là `PLANNED`.
  5. **Chuẩn hóa sự kiện vận hành:** Bóc tách `workOrderId`, `batchId` bắt buộc, station, quantity, timestamp và quality; record lỗi được cách ly nhưng vẫn có bằng chứng audit.
  6. **Persisted observation identity:** So sánh `(organizationId, sourceId, sourceRecordId, sourceRevision)` với lịch sử normalized. Cùng nội dung nghiệp vụ là `DUPLICATE`; thay đổi nội dung là `CONFLICT`. Các trường transport không tham gia so sánh semantic.
  7. **Canonical slot:** Các identity khác nhau trong `(organizationId, batchId, station)` là ứng viên cạnh tranh. Source authority, revision, occurrence time và source/record identity ổn định chọn một winner `ACCEPTED`; loser là `CONFLICT`, không phải duplicate.
  8. Tạo/cập nhật đúng một `CanonicalEvent`, tính lại tổng duplicate/conflict và lưu cả winner cũ nếu bị hạ xuống conflict.
  9. Đóng run với counter chỉ thuộc run hiện tại và trạng thái `SUCCEEDED`, `PARTIAL_SUCCESS` hoặc `FAILED`.

### 1.7 `PATCH /api/v1/sources/:sourceId/auto-sync` (Cấu Hình Tự Động Thu Thập)
* **UseCase được gọi:** `ConfigureAutoSyncUseCase`
* **Logic Nghiệp vụ:** Bật/tắt cờ `autoSync` và chu kỳ `syncIntervalSeconds` (mặc định 30 giây). `AutoSyncSchedulerService` âm thầm quét các nguồn định kỳ và khử trùng lặp dữ liệu qua hàng trăm đợt chạy.

---

## 2. `ProductionLinesController` — `/api/v1/production-lines`

### 2.1 `GET /api/v1/production-lines` (Lấy Toàn Bộ Dây Chuyền & Trạng Thái 6 Trạm)
* **UseCase được gọi:** `GetProductionLinesUseCase`
* **Logic Nghiệp vụ:**
  1. Lấy ngưỡng cảnh báo trễ `staleThresholdMinutes` (mặc định 15 phút).
  2. Lấy toàn bộ `batches`, `work_orders`, `canonical_events`, `management_events`.
  3. Dùng `ProductionStateEvaluator` tính toán trạng thái cho từng lô hàng:
     - **Trạm xa nhất (`Furthest Station Reached`):** Trạm có rank cao nhất trong các sự kiện canonical.
     - **Không lùi trạm (`Never Move Backwards`):** Sự kiện cũ không bao giờ làm lùi trạm hiện tại.
     - **Thứ tự ưu tiên trạng thái:** `COMPLETED` $\rightarrow$ `BLOCKED` $\rightarrow$ `IN_PROGRESS` $\rightarrow$ `PLANNED`.
     - **Cảnh báo:** `STALE` (>15 phút), `MISSING_DATA` (nhảy cóc trạm), `QUALITY` (lỗi chất lượng).
  4. Tính toán **WIP** và **Sản lượng hoàn thành (Completed Qty)** cho từng trạm.
  5. Nhóm kết quả theo từng Line (`LINE-A`, `LINE-B`, `LINE-C`).

---

## 3. `BatchesController` — `/api/v1/batches`

### 3.1 `GET /api/v1/batches/:batchId` (Chi Tiết Lô Hàng)
* **UseCase được gọi:** `GetBatchDetailUseCase`
* **Logic Nghiệp vụ:** Trả về chi tiết đơn hàng, timeline đầy đủ 6 trạm và toàn bộ nhật ký quản lý.

### 3.2 `GET /api/v1/batches/:batchId/provenance` (Truy Vết Nguồn Gốc Toàn Diện)
* **UseCase được gọi:** `GetBatchProvenanceUseCase`
* **Logic Nghiệp vụ:**
  1. Với từng trạm của lô hàng, tìm Canonical Event và các bản ghi đóng góp.
  2. **Sắp xếp thứ tự 6 trạm tất định:** Dùng `getStationRank` để sắp xếp mảng `lineage` chuẩn xác từ Trạm 01 `RECEIVING` đến Trạm 06 `DISPATCH`.
  3. Bản ghi nguồn chiến thắng (Verified Record) luôn được đưa lên đầu.
  4. Các công đoạn trung gian bị khuyết dữ liệu được gắn thẻ cảnh báo `⚠️ Thiếu Dữ Liệu (Missing Data Gap)` trực quan.

### 3.3 `POST /api/v1/batches/:batchId/management-events/blocks` (Tạm Dừng Lô Hàng)
* **UseCase được gọi:** `BlockBatchUseCase`
* **Logic Nghiệp vụ:**
  1. Kiểm tra điều kiện bất biến: Nếu lô hàng đã xuất xưởng (`COMPLETED` tại Trạm 6 `DISPATCH`), ném lỗi `InvalidOperationException` (409 Conflict) để bảo vệ sản phẩm đã hoàn tất.
  2. Lưu sự kiện `BLOCK` append-only kèm `actorName`, `reason`, `timestamp`.
  3. Đồng bộ hóa trường `status = BLOCKED` và các thông tin tạm dừng trực tiếp vào bảng `batches`.

### 3.4 `POST /api/v1/batches/:batchId/management-events/resumes` (Mở Lại Lô Hàng)
* **UseCase được gọi:** `ResumeBatchUseCase`
* **Logic Nghiệp vụ:**
  1. Kiểm tra lô hàng không phải `COMPLETED`. Nếu là `COMPLETED`, ném lỗi 409 Conflict.
  2. Lưu sự kiện `RESUME` append-only, đưa lô hàng quay lại trạng thái `IN_PROGRESS` và đồng bộ vào bảng `batches`.

### 3.5 `POST /api/v1/batches/:batchId/management-events/notes` (Thêm Ghi Chú)
* **UseCase được gọi:** `AddBatchNoteUseCase`
* **Logic Nghiệp vụ:** Thêm ghi chú vào nhật ký vận hành (Append-only). Quản đốc có thể thêm ghi chú kiểm toán bất kỳ lúc nào kể cả khi lô hàng đã hoàn thành.
