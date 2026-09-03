# Rule 20: Ingestion & Provenance

## 1. Raw Observations & Provenance
- Mọi dữ liệu thu thập từ nguồn ngoài đều phải được lưu trữ dạng **Raw Observation (Append-only)** trước khi chuẩn hóa.
- Mỗi bản ghi chuẩn hóa (`NormalizedRecord` / `CanonicalEvent`) phải lưu đủ 3 thông tin truy vết:
  - `sourceId`: Nguồn thu thập.
  - `collectionRunId`: Đợt thu thập cụ thể.
  - `sourceRecordId`: ID ổn định từ hệ thống nguồn.

## 2. Quy tắc cho từng Collector:
- **Web Crawler**:
  - Phải có cơ chế chống lặp phân trang (`visitedUrls: Set<string>` + `maxPages`).
  - Gặp dòng lỗi (`malformed row`) $\rightarrow$ ghi nhận lỗi vào log riêng, không được làm sập đợt thu thập.
- **REST Collector**:
  - Hỗ trợ phân trang (`page`, `pageSize`).
  - Timeout tối đa 5000ms.
  - Tự động Retry 3 lần với exponential backoff khi gặp lỗi tạm thời (network, 500, 502, 503, 504, 429). Không retry lỗi 4xx client.
- **Database Collector**:
  - Chỉ được kết nối sau khi đã xác thực (`Test Connection`).
  - Khám phá Schema và chỉ thu thập bảng sản xuất được người dùng chọn.
  - Bảo mật thông tin đăng nhập, không trả về secret.
