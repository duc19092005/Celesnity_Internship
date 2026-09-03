# Rule 40: Frontend Architecture

## 1. Cấu trúc Feature-First trên Next.js 16 (React 19):
- `app`: Định tuyến App Router (`/data-sources`, `/production-lines`).
- `components/ui`: UI components dùng chung (Buttons, Modals, Cards, Badges, Tables, Tabs, Inputs, Drawers).
- `components/layout`: Sidebar (có nút đóng/mở Collapse), Header, ThemeToggle (Light/Dark), LanguageSelector (VI/EN).
- `components/features`: Chia theo tính năng (`sources`, `production`, `management`).
- `services`: Axios/Fetch API clients tập trung.
- `stores` / `context`: ThemeContext (Light/Dark mode), LanguageContext / i18n (VI/EN dictionary), UI state.

## 2. Trải nghiệm người dùng (UX):
- Sidebar navigation có thể thu gọn (Collapsible sidebar).
- Hỗ trợ chuyển đổi giao diện Dark Mode / Light Mode mượt mà.
- Chuẩn bị sẵn cấu trúc đa ngôn ngữ i18n (VI / EN) cho toàn bộ hệ thống.
- Cung cấp đầy đủ trạng thái: Loading skeleton, Empty state, Error alert, Retry button.
