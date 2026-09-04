import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../../src/app.module';

const BASE_URL = 'http://127.0.0.1:4001';

describe('Factory Platform Three-Source Workflow (E2E)', () => {
  let app: INestApplication;
  let restSourceId: string;
  let crawlerSourceId: string;
  let postgresSourceId: string;
  let postgresRunId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.listen(4001, '0.0.0.0');
  }, 30000);

  afterAll(async () => {
    await app.close();
  });

  async function register(body: Record<string, unknown>): Promise<string> {
    const response = await request(app.getHttpServer()).post('/api/v1/sources').send(body).expect(201);
    expect(response.body.id).toBeTruthy();
    expect(response.body.encryptedSecret).toBeFalsy();
    return response.body.id;
  }

  it('registers, tests, discovers, selects and collects all three source types', async () => {
    restSourceId = await register({
      name: 'E2E REST',
      type: 'REST_API',
      config: { baseUrl: `${BASE_URL}/fixtures/application-api`, timeoutMs: 5000 },
    });
    crawlerSourceId = await register({
      name: 'E2E Supplier',
      type: 'WEB_CRAWLER',
      config: { url: `${BASE_URL}/fixtures/supplier/deliveries?page=1`, maxPages: 5, timeoutMs: 5000 },
    });
    postgresSourceId = await register({
      name: 'E2E Production DB',
      type: 'POSTGRESQL',
      config: {
        host: process.env.PRODUCTION_DB_HOST || 'production-test-db',
        port: Number(process.env.PRODUCTION_DB_PORT || 5432),
        database: process.env.PRODUCTION_DB_NAME || 'production_db',
        username: process.env.PRODUCTION_DB_USER || 'postgres',
      },
    });

    for (const sourceId of [restSourceId, crawlerSourceId, postgresSourceId]) {
      const connection = await request(app.getHttpServer()).post(`/api/v1/sources/${sourceId}/test`).expect(201);
      expect(connection.body.connected).toBe(true);
    }

    const restSchema = await request(app.getHttpServer()).post(`/api/v1/sources/${restSourceId}/discover`).expect(201);
    expect(restSchema.body.metadata.endpoints.map((endpoint: any) => endpoint.name)).toEqual(expect.arrayContaining([
      'work-orders', 'batches', 'receiving-records', 'dispatch-records',
    ]));
    await request(app.getHttpServer()).put(`/api/v1/sources/${restSourceId}/selection`).send({
      selection: { resources: ['work-orders', 'batches', 'receiving-records', 'dispatch-records'] },
    }).expect(200);

    const crawlerSchema = await request(app.getHttpServer()).post(`/api/v1/sources/${crawlerSourceId}/discover`).expect(201);
    expect(crawlerSchema.body.headers).toEqual(expect.arrayContaining(['Delivery Number', 'Supplier', 'Batch ID', 'Quantity', 'Delivery Time']));
    await request(app.getHttpServer()).put(`/api/v1/sources/${crawlerSourceId}/selection`).send({
      selection: { headers: ['Delivery Number', 'Supplier', 'Batch ID', 'Quantity', 'Delivery Time'] },
    }).expect(200);

    const postgresSchema = await request(app.getHttpServer()).post(`/api/v1/sources/${postgresSourceId}/discover`).expect(201);
    const eventTable = postgresSchema.body.tables.find((table: any) => table.name === 'production_events');
    expect(eventTable).toBeTruthy();
    await request(app.getHttpServer()).put(`/api/v1/sources/${postgresSourceId}/selection`).send({
      selection: { selectedTable: 'production_events', selectedColumns: eventTable.columns.map((column: any) => column.name) },
    }).expect(200);

    const restRun = await request(app.getHttpServer()).post(`/api/v1/sources/${restSourceId}/runs`).expect(201);
    expect(restRun.body.observedCount).toBeGreaterThanOrEqual(12);
    expect(restRun.body.normalizedCount).toBe(3);

    const crawlerRun = await request(app.getHttpServer()).post(`/api/v1/sources/${crawlerSourceId}/runs`).expect(201);
    expect(crawlerRun.body.observedCount).toBe(6);
    expect(crawlerRun.body.errorCount).toBe(1);
    expect(crawlerRun.body.status).toBe('PARTIAL_SUCCESS');

    const postgresRun = await request(app.getHttpServer()).post(`/api/v1/sources/${postgresSourceId}/runs`).expect(201);
    postgresRunId = postgresRun.body.id;
    expect(postgresRun.body.normalizedCount).toBeGreaterThanOrEqual(16);
    expect(postgresRun.body.duplicateCount).toBeGreaterThanOrEqual(1);
    expect(postgresRun.body.conflictCount).toBe(0);
  }, 30000);

  it('keeps PROD-EVT-008 as one accepted event plus duplicates across collection runs', async () => {
    const firstPreview = await request(app.getHttpServer()).get(`/api/v1/collection-runs/${postgresRunId}/records?pageSize=100`).expect(200);
    const firstRecords = firstPreview.body.items.filter((record: any) => record.sourceRecordId === 'PROD-EVT-008');
    expect(firstRecords).toHaveLength(2);
    expect(firstRecords.map((record: any) => record.disposition).sort()).toEqual(['ACCEPTED', 'DUPLICATE']);

    const secondRun = await request(app.getHttpServer()).post(`/api/v1/sources/${postgresSourceId}/runs`).expect(201);
    expect(secondRun.body.acceptedCount).toBe(0);
    expect(secondRun.body.conflictCount).toBe(0);
    expect(secondRun.body.duplicateCount).toBe(secondRun.body.normalizedCount);

    const provenance = await request(app.getHttpServer()).get('/api/v1/batches/BATCH-002/provenance').expect(200);
    const folding = provenance.body.lineage.find((entry: any) => entry.station === 'FOLDING');
    const prodEight = folding.contributions.find((entry: any) => entry.normalizedRecord.sourceRecordId === 'PROD-EVT-008');
    expect(folding.canonicalEvent.quantity).toBe(80);
    expect(prodEight.occurrenceCount).toBe(4);
    expect(prodEight.allRunIds).toEqual(expect.arrayContaining([postgresRunId, secondRun.body.id]));
  }, 30000);

  it('materializes REST metadata and projects six stations without fake receiving progress', async () => {
    const board = await request(app.getHttpServer()).get('/api/v1/production-lines').expect(200);
    expect(board.body).toHaveLength(3);
    expect(board.body.every((line: any) => line.stations.length === 6)).toBe(true);

    const allBatches = board.body.flatMap((line: any) => line.batches);
    const batchOne = allBatches.find((batch: any) => batch.batchId === 'BATCH-001');
    const batchFive = allBatches.find((batch: any) => batch.batchId === 'BATCH-005');
    expect(batchOne.status).toBe('COMPLETED');
    expect(batchOne.currentStation).toBe('DISPATCH');
    expect(batchFive.status).toBe('IN_PROGRESS');
    expect(batchFive.currentStation).toBe('RECEIVING');
    expect(batchFive.workOrder).toBeTruthy();

    const batchThree = allBatches.find((batch: any) => batch.batchId === 'BATCH-003');
    expect(batchThree.currentStation).toBe('DRYING');
    expect(batchThree.indicators.hasMissingData).toBe(true);
  });
});
