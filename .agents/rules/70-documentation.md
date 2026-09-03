# Rule 70: Documentation Rules

## 1. Yêu cầu Tài liệu Đa ngôn ngữ (VI & EN):
- Toàn bộ tài liệu phải có 2 phiên bản song ngữ đầy đủ và đồng bộ:
  - `README.md` (Tiếng Anh) và `README.vi.md` (Tiếng Việt) tại thư mục gốc.
  - Thư mục `docs/en/` và `docs/vi/` chứa các tài liệu chi tiết.

## 2. Chi tiết từng tài liệu trong `docs/`:
- `controllers-and-usecases.md`:
  - Liệt kê toàn bộ Controller, Endpoint HTTP, DTOs.
  - Ánh xạ rõ ràng: Endpoint nào gọi tới UseCase nào?
  - Mô tả từng bước logic nghiệp vụ chi tiết của UseCase đó.
- `architecture.md`:
  - Sơ đồ Clean Architecture 4 tầng, flow dữ liệu từ Ingestion -> Normalizer -> Production Engine -> UI.
- `deployment-guide.md`:
  - Hướng dẫn chạy Docker Compose cho cả bản chạy đầy đủ và bản test độc lập.
