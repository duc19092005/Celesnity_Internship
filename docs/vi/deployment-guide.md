# Hướng dẫn Khởi chạy & Kiểm thử (Deployment & Testing Guide)

---

## 1. Khởi chạy Toàn bộ Hệ thống (Full Stack)

Để khởi động toàn bộ hệ thống gồm PostgreSQL Platform DB, PostgreSQL Production DB, Backend NestJS và Frontend Next.js:

```bash
docker compose -f infrastructure/docker-compose.yml up --build
```

### Các Cổng Dịch vụ (Ports):
* **Frontend Next.js:** `http://localhost:3000`
* **Backend NestJS API:** `http://localhost:4000`
* **Supplier Portal HTML (Fixture):** `http://localhost:4000/fixtures/supplier/deliveries`
* **Platform Database (Postgres):** `localhost:5432`
* **Production Source Database (Postgres):** `localhost:5433`

---

## 2. Chạy Kiểm Thử Độc Lập (Test Runner Compose)

Đề bài yêu cầu có thể chạy toàn bộ bộ kiểm thử Backend API và UseCases **hoàn toàn không cần khởi động Frontend và không phụ thuộc MQTT**:

```bash
docker compose -f infrastructure/docker-compose.test.yml up --build --abort-on-container-exit --exit-code-from backend-test
```

### Chạy Unit Test cục bộ bằng npm:
```bash
cd backend
npm install
npm test
```
