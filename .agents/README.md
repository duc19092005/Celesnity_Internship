# Agent Rules Directory (.agents)

Thư mục này chứa các quy tắc kiến trúc, quy định kỹ thuật và nguyên tắc thiết kế bắt buộc cho dự án **Factory Data & Production Line Platform**.

## Danh sách quy tắc:
1. `00-assessment-requirements.md`: Yêu cầu cốt lõi của đề bài, phạm vi dự án, ràng buộc nghiệp vụ.
2. `10-backend-clean-architecture.md`: Chuẩn Clean Architecture cho Backend NestJS (Domain, Application, Infrastructure, Presentation).
3. `20-ingestion-provenance.md`: Nguyên tắc thu thập dữ liệu (Crawler, DB, REST), lưu Raw Observations và truy vết Provenance.
4. `30-production-state-rules.md`: Quy tắc trạng thái dây chuyền 6 trạm, quy tắc trạm xa nhất, State Precedence, WIP, Stale detection.
5. `40-frontend-architecture.md`: Cấu trúc Feature-First cho Next.js 16, Sidebar, Theme (Light/Dark), i18n (VI/EN).
6. `50-security.md`: Quy tắc bảo mật thông tin xác thực, mask secrets, encryption at rest.
7. `60-testing.md`: Chuẩn Unit Test, Integration Test và Docker Test Runner không phụ thuộc Frontend/MQTT.
8. `70-documentation.md`: Chuẩn viết tài liệu song ngữ (VI & EN) chi tiết Controller -> UseCase.
