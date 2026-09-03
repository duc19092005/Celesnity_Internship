# Deployment and Testing Guide

---

## 1. Running the Full Stack

To start all services (Platform DB, Production DB, NestJS Backend, Next.js Frontend):

```bash
docker compose -f infrastructure/docker-compose.yml up --build
```

### Service Access URLs & Ports:
* **Frontend Web App:** `http://localhost:3000`
* **Backend REST API:** `http://localhost:4000`
* **Supplier Portal HTML (Fixture):** `http://localhost:4000/fixtures/supplier/deliveries`
* **Platform Database (PostgreSQL):** `localhost:5432`
* **Production Source Database (PostgreSQL):** `localhost:5433`

---

## 2. Running Automated Tests in Isolation

To execute all unit, domain, and API resilience tests in an isolated container without starting Frontend or requiring MQTT:

```bash
docker compose -f infrastructure/docker-compose.test.yml up --build --abort-on-container-exit --exit-code-from backend-test
```

### Running Tests Locally with npm:
```bash
cd backend
npm install
npm test
```
