# Rule 00: Assessment Requirements

## 1. Mục tiêu hệ thống
- Thu thập dữ liệu từ các nguồn cục bộ (Application API REST, Supplier Web Crawler, PostgreSQL Production Database, Mosquitto MQTT Telemetry tùy chọn).
- Chuẩn hóa thành một bộ dữ liệu sự kiện chuẩn hóa có truy vết nguồn gốc (Traceable Canonical Dataset).
- Hiển thị và quản lý trạng thái dây chuyền sản xuất 6 công đoạn xưởng giặt ủi công nghiệp:
  1. `RECEIVING` (Nhận đồ - Supplier Crawler)
  2. `SORTING` (Phân loại - Production Database)
  3. `WASHING` (Giặt - Production Database / MQTT)
  4. `DRYING` (Sấy - Production Database / MQTT)
  5. `FOLDING` (Ủi/Gấp - Production Database)
  6. `DISPATCH` (Đóng gói/Xuất xưởng - Application API)

## 2. Ràng buộc bất biến
- **KHÔNG** tự động tối ưu hóa lịch sản xuất.
- **KHÔNG** tự động điều khiển máy móc.
- **KHÔNG** phụ thuộc vào repository hoặc infrastructure bên ngoài gói bài.
- MQTT là phần mở rộng tùy chọn; hệ thống và bộ test bắt buộc **phải pass 100% khi MQTT không được bật**.
- Giao diện gồm 2 màn hình chính: `Data Sources` và `Production Lines`.
