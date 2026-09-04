# Chiến Lược Kiểm Thử & Ma Trận Test Cases Toàn Diện
## Factory Data & Production Line Platform

Tài liệu này trình bày toàn bộ chiến lược kiểm thử, cấu trúc các tầng test và ma trận test case chi tiết 5 giai đoạn cho hệ thống Factory Data & Production Line Platform, tuân thủ nghiêm ngặt **Rule 60** và **Rule 80**.

---

## 1. Triết Lý & Mô Hình Kiểm Thử (Testing Philosophy)

Hệ thống áp dụng mô hình kim tự tháp kiểm thử (Testing Pyramid) với nguyên tắc cô lập tối đa:
1. **Domain & UseCase Unit Tests (Tầng đáy - 30 Test Cases qua 7 suites)**:
   - Kiểm thử độc lập 100% logic nghiệp vụ: Khử trùng lặp, giải quyết tranh chấp, pipeline nạp metadata và dedup xuyên nhiều run, trạm xa nhất, không lùi trạm, ma trận ưu tiên trạng thái, append-only audit, và kiểm tra pre-flight connection.
   - Thời gian chạy siêu nhanh (~9s), không phụ thuộc database ngoài.
2. **Integration & E2E Tests (Tầng giữa - 3 Kịch bản luồng tích hợp)**:
   - Kịch bản luồng đa nguồn đầu cuối (`test/e2e/workflow.spec.ts`): Đăng ký, khám phá schema, chọn hợp đồng dữ liệu, thu thập từ 3 nguồn (Crawler, PostgreSQL, REST), kiểm chứng deduplication xuyên các lần chạy và trạng thái 6 trạm dây chuyền.
3. **Docker Compose Test Runner (Tầng đỉnh - CI/CD Container)**:
   - File cấu hình `infrastructure/docker-compose.test.yml` dựng môi trường container độc lập hoàn toàn, khởi tạo database sạch và thực thi chuỗi lệnh `npm test && npm run test:e2e` với:
     ```bash
     docker compose -f infrastructure/docker-compose.test.yml up --build --abort-on-container-exit --exit-code-from backend-test
     ```

---

## 2. Ma Trận Test Cases Chi Tiết Theo 5 Giai Đoạn

### Giai Đoạn 1: Thu Thập Dữ Liệu & Khả Năng Chịu Lỗi (Ingestion & Resilience)

| ID | Nhóm | Tên Test Case | Mô Tả Kịch Bản | Kết Quả Kỳ Vọng | Vị Trí Code |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **TC-1.1** | Crawler | Chống lặp vô hạn (Pagination Loop) | Trang 1 trỏ sang Trang 2, Trang 2 trỏ ngược về Trang 1 | Crawler phát hiện URL trùng, dừng an toàn với mã `PAGINATION_LOOP_DETECTED`. | `test/unit/crawler-resilience.spec.ts` |
| **TC-1.2** | Crawler | Cách ly dòng lỗi (Malformed Row) | Bảng HTML chứa 2 dòng hợp lệ và 1 dòng có `quantity = "NOT_A_NUMBER"` | Thu thập thành công 2 dòng, cách ly dòng lỗi với mã `MALFORMED_QUANTITY_ROW`. | `test/unit/crawler-resilience.spec.ts` |
| **TC-1.3** | Crawler | Trích xuất ID ổn định (Stable ID) | HTML có thẻ `<tr data-source-record-id="SUPP-101">` | Trích xuất đúng `sourceRecordId` phục vụ truy vết nguồn gốc (Provenance). | `test/unit/crawler-resilience.spec.ts` |
| **TC-1.4** | REST API | Tự động thử lại khi lỗi 503 (Transient Retry) | Endpoint `/dispatch-records?failureMode=transient` trả về 503 ở 2 lần đầu | Tự động retry với exponential backoff, lấy dữ liệu thành công ở lần 3. | `test/e2e/workflow.spec.ts` |
| **TC-1.5** | REST API | Thu thập phân trang đa tài nguyên | Gọi đồng bộ `/batches`, `/work-orders`, `/dispatch-records`, `/receiving-records` | Thu thập đầy đủ dữ liệu từ các endpoint con, gán mã nguồn thô chính xác. | `test/e2e/workflow.spec.ts` |
| **TC-1.6** | Postgres | Khám phá cấu trúc (Schema Discovery) | Nguồn PostgreSQL trỏ tới bảng `production_events` | Trả về danh sách bảng và các cột (`batch_id`, `station`, `quantity`,...). | `test/e2e/workflow.spec.ts` |
| **TC-1.7** | Bảo mật | Mã hóa AES-256-GCM & Che giấu bí mật | Đăng ký nguồn PostgreSQL với mật khẩu thô | Mật khẩu được mã hóa AES-256. API response chỉ trả về `hasSecret: true`, không lộ mật khẩu. | `test/unit/preflight-and-security.spec.ts` |
| **TC-1.8** | Kiểm tra | Kiểm tra sức khỏe trước khi cào (Pre-flight Ping) | Chạy cào trên một nguồn bị ngắt kết nối hoặc sai cấu hình | Ngắt an toàn trước khi cào, gắn cờ nguồn `ERROR`, mã lỗi `PREFLIGHT_CONNECTION_FAILED`. | `test/unit/preflight-and-security.spec.ts` |

---

### Giai Đoạn 2: Chuẩn Hóa, Khử Trùng Lặp & Xử Lý Tranh Chấp (Normalization & Deduplication)

| ID | Nhóm | Tên Test Case | Mô Tả Kịch Bản | Kết Quả Kỳ Vọng | Vị Trí Code |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **TC-2.1** | Normalization | Chuẩn hóa múi giờ UTC | Đầu vào chứa chuỗi giờ địa phương `2026-09-01 15:30:00` | Tự động chuyển đổi sang UTC `2026-09-01T08:30:00.000Z` (+07:00 sang UTC). | `test/unit/provenance-and-normalization.spec.ts` |
| **TC-2.2** | Deduplication | Khử trùng lặp bản ghi đồng nhất | Hai bản ghi cùng một sự kiện `PROD-EVT-008` (Trạm FOLDING, 80 cái) | Bản ghi 1 là `ACCEPTED`. Bản ghi 2 là `DUPLICATE`. Sản lượng là 80 (không bị thành 160). | `test/unit/deduplication-resolver.spec.ts` |
| **TC-2.3** | Conflict | Xung đột thẩm quyền nguồn (Authority Weight) | Trạm `RECEIVING`: Crawler (120 cái) vs API (100 cái) | Crawler có thẩm quyền cao hơn tại Trạm 1 ➔ Crawler thắng (`ACCEPTED`), API thành `CONFLICT`. | `test/unit/deduplication-resolver.spec.ts` |
| **TC-2.4** | Conflict | Ưu tiên sản lượng thực tế $> 0$ hơn $0$ | Trạm `RECEIVING`: `API-REC-001` (120 cái) vs `batches-BATCH-001` (0 cái) | Bản ghi có sản lượng thật $> 0$ thắng ➔ `ACCEPTED`, bản ghi giữ chỗ 0 cái thành `CONFLICT`. | `test/unit/deduplication-resolver.spec.ts` |

---

### Giai Đoạn 3: Đánh Giá Trạng Thái Lô Hàng 6 Trạm (Production State Engine)

| ID | Nhóm | Tên Test Case | Mô Tả Kịch Bản | Kết Quả Kỳ Vọng | Vị Trí Code |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **TC-3.1** | State | Trạng thái Mặc định PLANNED | Lô hàng chỉ mới có đơn hàng, chưa có sự kiện trạm nào | `status = PLANNED`, `currentStation = null`, `completedQuantity = 0`. | `test/unit/production-state-evaluator.spec.ts` |
| **TC-3.2** | Station | Xác định Trạm Xa Nhất (Furthest Station) | Sự kiện tại Trạm 1 (RECEIVING) và Trạm 3 (WASHING) | `status = IN_PROGRESS`, `currentStation = WASHING`, `hasMissingData = true` (thiếu Trạm 2). | `test/unit/production-state-evaluator.spec.ts` |
| **TC-3.3** | Invariance | Không lùi trạm khi nhận sự kiện muộn | Đang ở Trạm 4 (DRYING), nhận sự kiện muộn của Trạm 2 (SORTING) | Trạm hiện tại vẫn giữ ở Trạm 4. Cảnh báo thiếu bước biến mất do đã được bù đắp. | `test/unit/production-state-evaluator.spec.ts` |
| **TC-3.4** | Precedence | Ma trận ưu tiên: COMPLETED tối thượng | Lô hàng có DISPATCH accepted nhưng bị Quản đốc áp lệnh BLOCK | `status = COMPLETED`. Lệnh BLOCK bị bỏ qua do sản phẩm đã xuất xưởng. | `test/unit/production-state-evaluator.spec.ts` |
| **TC-3.5** | Precedence | Trạng thái BLOCKED tạm dừng sản xuất | Đang ở Trạm 3 (WASHING), Quản đốc áp lệnh BLOCK vì "Rách vải" | `status = BLOCKED`, `indicators.isBlocked = true`, `activeBlockReason = "Rách vải"`. | `test/unit/management-actions.spec.ts` |
| **TC-3.6** | Precedence | Khôi phục RESUME sau khi khắc phục | Sau khi BLOCK, áp sự kiện RESUME với ghi chú đã thay mẻ giặt mới | `status = IN_PROGRESS`, `indicators.isBlocked = false`, xóa lý do chặn. | `test/unit/management-actions.spec.ts` |
| **TC-3.7** | Invariance | Bảo vệ lô hàng đã xuất xưởng (Dispatch Invariance) | Gọi use case BLOCK hoặc RESUME trên lô hàng đã `COMPLETED` | Ném ngoại lệ `InvalidOperationException` (HTTP 409 Conflict), bảo vệ dữ liệu xuất xưởng. | `test/unit/management-actions.spec.ts` |
| **TC-3.8** | Stale | Cảnh báo Quá hạn động (Configurable Stale) | Sự kiện cuối cách đây 20 phút (Ngưỡng mặc định 15 phút) | `indicators.isStale = true`. Nâng ngưỡng lên 30 phút qua cấu hình ➔ `isStale = false`. | `test/unit/production-state-evaluator.spec.ts` |

---

### Giai Đoạn 4: Quản Lý Điều Phối & Nhật Ký Kiểm Toán (Management Events & Provenance)

| ID | Nhóm | Tên Test Case | Mô Tả Kịch Bản | Kết Quả Kỳ Vọng | Vị Trí Code |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **TC-4.1** | Audit | Ghi nhận điều phối Append-only | Quản đốc tạo ghi chú (NOTE) và xác nhận ngoại lệ (ACKNOWLEDGE) | Tạo bản ghi mới trong bảng `management_events` có `actor`, `timestamp`, `note`. Không sửa đè dữ liệu thô. | `test/unit/management-actions.spec.ts` |
| **TC-4.2** | Provenance | Sắp xếp tất định 6 trạm từ 1 đến 6 | Dữ liệu cào lộn xộn: Trạm 4 ➔ Trạm 1 ➔ Trạm 3 | Danh sách truy vết `lineage` được sắp xếp tăng dần từ Trạm 1 đến 6 chuẩn xác. | `test/unit/provenance-and-normalization.spec.ts` |
| **TC-4.3** | Provenance | Nhận diện khoảng trống thiếu dữ liệu (`⚠️ Missing Data`) | Lô hàng `BATCH-003` có Trạm 1 và Trạm 3 nhưng không có Trạm 2 | Cờ `hasMissingData = true`, hiển thị cảnh báo thiếu dữ liệu trên timeline. | `test/unit/provenance-and-normalization.spec.ts` |

---

### Giai Đoạn 5: Tích Hợp Đầu Cuối E2E & Docker Test Runner (End-to-End Workflow)

| ID | Nhóm | Tên Test Case | Mô Tả Kịch Bản | Kết Quả Kỳ Vọng | Vị Trí Code |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **TC-5.1** | E2E | Cào toàn bộ 3 nguồn và sinh bảng 6 trạm | Chạy cào Supplier Crawler ➔ PostgreSQL ➔ REST API | 6 lô hàng (`BATCH-001` đến `BATCH-006`) được ánh xạ đúng về 3 dây chuyền (`LINE-A`, `LINE-B`, `LINE-C`). | `test/e2e/workflow.spec.ts` |
| **TC-5.2** | E2E | Tuân thủ định dạng ngày tháng ISO UTC | Gọi API trả về `CollectionRun` và `Source` | Các trường ngày tháng (`startedAt`, `finishedAt`, `lastRunAt`) là chuỗi ISO UTC, không bao giờ bị `{}`. | `test/unit/preflight-and-security.spec.ts` |
| **TC-5.3** | Docker | Kiểm thử tự động trên Docker Test Runner | Chạy `docker compose -f infrastructure/docker-compose.test.yml up` | Khởi tạo môi trường container độc lập, chạy toàn bộ 30 test case, trả về mã thoát 0 mà không cần Mosquitto MQTT. | `infrastructure/docker-compose.test.yml` |

---

## 3. Hướng Dẫn Thực Thi Kiểm Thử

### Chạy bằng Jest tại máy cục bộ:
```bash
cd backend
# Chạy toàn bộ 30 test cases:
npm test

# Hoặc chạy riêng các Unit Tests:
npx jest --config ./test/jest.config.js test/unit

# Hoặc chạy riêng E2E Tests:
npx jest --config ./test/jest.config.js test/e2e
```

### Chạy bằng Docker Compose Test Runner:
```bash
docker compose -f infrastructure/docker-compose.test.yml up --build --abort-on-container-exit --exit-code-from backend-test
```
