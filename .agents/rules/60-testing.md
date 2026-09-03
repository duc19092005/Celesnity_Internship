# Rule 60: Testing & Docker Test Runner

## 1. Yêu cầu Kiểm thử:
- **Unit Tests**: Kiểm thử riêng biệt các quy tắc nghiệp vụ cốt lõi trong Domain & UseCases:
  - Thứ tự ưu tiên trạng thái (State Precedence matrix).
  - Quy tắc trạm xa nhất & Không lùi trạm khi nhận event cũ.
  - Khử trùng lặp số lượng hoàn thành (Deduplication policy).
  - Tính toán WIP và phát hiện Stale timeout.
- **Integration Tests**: Kiểm thử tính chịu lỗi của các Collector:
  - Crawler xử lý phân trang, chống lặp loop và bắt dòng lỗi `malformed row`.
  - REST Collector retry thành công khi gặp lỗi 503 tạm thời.
  - DB Collector kết nối an toàn và khám phá schema.

## 2. Docker Compose Test Runner:
- File `infrastructure/docker-compose.test.yml` chạy kiểm thử độc lập:
  - Chạy `platform-test-db`, `production-test-db` và service `backend-test`.
  - **KHÔNG chạy Frontend** và **KHÔNG phụ thuộc Mosquitto MQTT**.
  - Lệnh thực thi:
    ```bash
    docker compose -f infrastructure/docker-compose.test.yml up --build --abort-on-container-exit --exit-code-from backend-test
    ```
