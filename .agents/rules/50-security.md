# Rule 50: Security & Masking

## 1. Bảo mật Thông tin xác thực (Credentials):
- Mọi mật khẩu, connection strings, secret tokens được lưu trong Database phải được mã hóa chuẩn **AES-256-GCM** với khóa bí mật từ biến môi trường `SOURCE_SECRET_ENCRYPTION_KEY`.
- Khi trả dữ liệu ra API cho Frontend:
  - **KHÔNG BAO GIỜ** trả về mật khẩu hoặc connection string chứa mật khẩu.
  - Chỉ trả về cờ an toàn: `hasSecret: true` hoặc thông tin host/port/database không nhạy cảm.

## 2. Redaction trong Logging & Exceptions:
- Tầng Exception Filter và Logging Interceptor phải tự động xóa (redact) các trường nhạy cảm: `password`, `secret`, `authorization`, `connectionString`, `token`.
- Không in credentials ra file log hoặc commit vào git.
