# Rule 80: Testing & Documentation Synchronization

## 1. Yêu cầu Bắt buộc khi Kiểm thử:
- Mỗi quy tắc nghiệp vụ, tính năng mới hoặc bản sửa lỗi (bug fix) **bắt buộc** phải có Unit Test hoặc E2E Test tương ứng chứng minh tính đúng đắn.
- Test suites phải bao phủ đủ 5 giai đoạn:
  1. Thu thập dữ liệu & Chịu lỗi (Crawler resilience, retry, pre-flight ping, masking).
  2. Chuẩn hóa & Khử trùng lặp (Normalization, deduplication, conflict authority, fingerprint cache).
  3. Đánh giá trạng thái dây chuyền (Furthest station, late event invariance, precedence, missing gap, dispatch protection).
  4. Quản lý điều phối & Truy vết (Append-only audit, deterministic provenance order 1 -> 6).
  5. Luồng tích hợp đầu cuối & Docker Test Runner (docker-compose.test.yml).

## 2. Yêu cầu Đồng bộ Tài liệu:
- Khi có thay đổi về test hoặc kiến trúc, **bắt buộc cập nhật tài liệu song ngữ**:
  - `docs/en/testing-strategy.md` (English)
  - `docs/vi/testing-strategy.md` (Vietnamese)
  - Tổng quan tại `README.md` và `README.vi.md`.
- Tuyệt đối không để xảy ra tình trạng code đã đổi nhưng tài liệu kiểm thử bị lỗi thời.
