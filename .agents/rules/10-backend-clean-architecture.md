# Rule 10: Backend Clean Architecture

## Cấu trúc 4 Tầng độc lập:
1. **Domain (`backend/src/domain`)**:
   - Chứa Pure TypeScript Entities, Value Objects, Enums, Domain Exceptions, Domain Repository Interfaces.
   - **Tuyệt đối không phụ thuộc** vào framework (NestJS, TypeORM, Axios, Cheerio).
2. **Application (`backend/src/application`)**:
   - Chứa UseCases (mỗi hành động là một UseCase riêng biệt), DTOs (Data Transfer Objects), Ports/Interfaces cho các external service.
   - Chỉ phụ thuộc vào Domain.
3. **Infrastructure (`backend/src/infrastructure`)**:
   - Triển khai cụ thể các Database Repositories (TypeORM), Adapters (Cheerio Crawler, Axios REST Client, Postgres DB Connector, Mosquitto MQTT Adapter), AES-256 Encryption, Scheduler.
4. **Presentation (`backend/src/presentation`)**:
   - Chứa NestJS Controllers, Request Validation DTOs, Exception Filters, Logging Interceptors.
   - Controller chỉ validate input, gọi UseCase và map output ra JSON response. Không chứa business logic.
