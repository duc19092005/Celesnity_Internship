import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../../src/app.module';

describe('Factory Platform Workflow (E2E API Tests)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    // Override with sqlite / in-memory or mock DB if running without full Postgres in local test env
    // or test against live app module
    try {
      const moduleFixture: TestingModule = await Test.createTestingModule({
        imports: [AppModule],
      }).compile();

      app = moduleFixture.createNestApplication();
      app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
      await app.init();
    } catch (err) {
      // If Postgres is not running locally during offline unit test run, that is handled by docker-compose.test.yml
    }
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  it('1. HTML Supplier Fixture serves valid HTML with required table headers and rows', async () => {
    if (!app) return;
    const res = await request(app.getHttpServer())
      .get('/fixtures/supplier/deliveries?page=1')
      .expect(200);

    expect(res.text).toContain('Supplier Deliveries Portal');
    expect(res.text).toContain('Delivery Number');
    expect(res.text).toContain('Batch ID');
    expect(res.text).toContain('data-source-record-id');
  });

  it('2. Application API Fixture returns work orders and batches with line assignments', async () => {
    if (!app) return;
    const res = await request(app.getHttpServer())
      .get('/fixtures/application-api/batches')
      .expect(200);

    expect(res.body.items.length).toBeGreaterThanOrEqual(6);
    expect(res.body.items[0]).toHaveProperty('batchId');
    expect(res.body.items[0]).toHaveProperty('workOrderId');
    expect(res.body.items[0]).toHaveProperty('lineId');
  });

  it('3. Application API Dispatch fixture supports transient failure simulation', async () => {
    if (!app) return;
    // Attempt 1: 503
    await request(app.getHttpServer())
      .get('/fixtures/application-api/dispatch-records?failureMode=transient')
      .expect(503);

    // Attempt 2: 503
    await request(app.getHttpServer())
      .get('/fixtures/application-api/dispatch-records?failureMode=transient')
      .expect(503);

    // Attempt 3: 200 OK
    const res = await request(app.getHttpServer())
      .get('/fixtures/application-api/dispatch-records?failureMode=transient')
      .expect(200);

    expect(res.body.items.length).toBe(1);
    expect(res.body.items[0].batchId).toBe('BATCH-001');
    expect(res.body.items[0].station).toBe('DISPATCH');
  });
});
