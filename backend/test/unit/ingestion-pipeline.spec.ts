import { IngestionPipelineService } from '../../src/application/services/ingestion-pipeline.service';
import { CollectionRun } from '../../src/domain/entities/collection-run.entity';
import { Source } from '../../src/domain/entities/source.entity';
import { BatchStatus, CollectionRunStatus, Disposition, SourceType } from '../../src/domain/enums/common.enums';
import { StationCode } from '../../src/domain/enums/station-code.enum';

describe('IngestionPipelineService persistence integration (in-memory repositories)', () => {
  const organizationId = 'org-1';
  const sources: Source[] = [];
  const normalized: any[] = [];
  const canonical: any[] = [];
  const batches: any[] = [];
  const workOrders: any[] = [];
  const observations: any[] = [];

  const sourceRepo = {
    findAll: jest.fn(async () => sources),
    save: jest.fn(async (source) => source),
  } as any;
  const runRepo = { save: jest.fn(async (run) => run) } as any;
  const observationRepo = {
    saveMany: jest.fn(async (items) => {
      observations.push(...items);
      return items;
    }),
  } as any;
  const normalizedRepo = {
    findByObservationIdentity: jest.fn(async (orgId, sourceId, sourceRecordId, sourceRevision) => normalized.filter(
      (record) => record.organizationId === orgId
        && record.sourceId === sourceId
        && record.sourceRecordId === sourceRecordId
        && record.sourceRevision === sourceRevision,
    )),
    findById: jest.fn(async (id) => normalized.find((record) => record.id === id) || null),
    saveMany: jest.fn(async (items) => {
      for (const item of items) {
        const index = normalized.findIndex((record) => record.id === item.id);
        if (index >= 0) normalized[index] = item;
        else normalized.push(item);
      }
      return items;
    }),
  } as any;
  const canonicalRepo = {
    findByBatchAndStation: jest.fn(async (batchId, station, orgId) => canonical.find(
      (event) => event.batchId === batchId && event.station === station && event.organizationId === orgId,
    ) || null),
    save: jest.fn(async (event) => {
      const index = canonical.findIndex((item) => item.id === event.id);
      if (index >= 0) canonical[index] = event;
      else canonical.push(event);
      return event;
    }),
  } as any;
  const batchRepo = {
    findById: jest.fn(async (id, orgId) => batches.find((batch) => batch.batchId === id && batch.organizationId === orgId) || null),
    save: jest.fn(async (batch) => {
      const index = batches.findIndex((item) => item.batchId === batch.batchId && item.organizationId === batch.organizationId);
      if (index >= 0) batches[index] = batch;
      else batches.push(batch);
      return batch;
    }),
  } as any;
  const workOrderRepo = {
    findById: jest.fn(async (id, orgId) => workOrders.find((order) => order.workOrderId === id && order.organizationId === orgId) || null),
    save: jest.fn(async (order) => {
      const index = workOrders.findIndex((item) => item.workOrderId === order.workOrderId && item.organizationId === order.organizationId);
      if (index >= 0) workOrders[index] = order;
      else workOrders.push(order);
      return order;
    }),
  } as any;

  let pipeline: IngestionPipelineService;

  beforeEach(() => {
    sources.length = normalized.length = canonical.length = batches.length = workOrders.length = observations.length = 0;
    jest.clearAllMocks();
    pipeline = new IngestionPipelineService(
      sourceRepo,
      runRepo,
      observationRepo,
      normalizedRepo,
      canonicalRepo,
      batchRepo,
      workOrderRepo,
    );
  });

  it('materializes work orders and batches without creating fake RECEIVING events', async () => {
    const source = new Source('src-rest', organizationId, 'REST', SourceType.REST_API, {}, null, { resources: ['work-orders', 'batches'] });
    sources.push(source);
    const run = new CollectionRun('run-metadata', organizationId, source.id, CollectionRunStatus.RUNNING);

    const result = await pipeline.process(source, {
      success: true,
      durationMs: 1,
      errors: [],
      items: [
        {
          sourceRecordId: 'WO-1001', sourceRevision: 1, observedAt: new Date(),
          payload: { resourceType: 'work-orders', workOrderId: 'WO-1001', customerName: 'Hotel A', targetQuantity: 120, plannedStartDate: '2026-09-01T08:00:00Z', plannedEndDate: '2026-09-01T16:00:00Z', status: 'PLANNED' },
        },
        {
          sourceRecordId: 'BATCH-001', sourceRevision: 1, observedAt: new Date(),
          payload: { resourceType: 'batches', batchId: 'BATCH-001', workOrderId: 'WO-1001', lineId: 'LINE-A' },
        },
      ],
    }, run);

    expect(observations).toHaveLength(2);
    expect(workOrders).toHaveLength(1);
    expect(batches).toHaveLength(1);
    expect(batches[0].status).toBe(BatchStatus.PLANNED);
    expect(batches[0].currentStation).toBeNull();
    expect(normalized).toHaveLength(0);
    expect(canonical).toHaveLength(0);
    expect(result.status).toBe(CollectionRunStatus.SUCCEEDED);
  });

  it('deduplicates a business-identical observation in a later collection run', async () => {
    const source = new Source('src-db', organizationId, 'DB', SourceType.POSTGRESQL, {}, null, { selectedTable: 'production_events' });
    sources.push(source);
    const item = (rowId: number) => ({
      sourceRecordId: 'PROD-EVT-008', sourceRevision: 1, observedAt: new Date(),
      payload: { row_id: rowId, sourceTable: 'production_events', batch_id: 'BATCH-002', station: StationCode.FOLDING, quantity: 80, event_time: '2026-09-01T09:00:00Z' },
    });

    await pipeline.process(source, { success: true, durationMs: 1, errors: [], items: [item(8)] }, new CollectionRun('run-1', organizationId, source.id, CollectionRunStatus.RUNNING));
    const secondRun = await pipeline.process(source, { success: true, durationMs: 1, errors: [], items: [item(9)] }, new CollectionRun('run-2', organizationId, source.id, CollectionRunStatus.RUNNING));

    expect(observations).toHaveLength(2);
    expect(normalized).toHaveLength(2);
    expect(normalized[1].disposition).toBe(Disposition.DUPLICATE);
    expect(secondRun.duplicateCount).toBe(1);
    expect(secondRun.conflictCount).toBe(0);
    expect(canonical).toHaveLength(1);
    expect(canonical[0].quantity).toBe(80);
    expect(canonical[0].duplicateObservationCount).toBe(1);
  });

  it('marks the same persisted observation identity with changed business data as CONFLICT', async () => {
    const source = new Source('src-db', organizationId, 'DB', SourceType.POSTGRESQL, {}, null, { selectedTable: 'production_events' });
    sources.push(source);
    const item = (quantity: number) => ({
      sourceRecordId: 'PROD-EVT-009', sourceRevision: 1, observedAt: new Date(),
      payload: { batch_id: 'BATCH-003', station: StationCode.WASHING, quantity, event_time: '2026-09-01T10:00:00Z' },
    });

    await pipeline.process(source, { success: true, durationMs: 1, errors: [], items: [item(100)] }, new CollectionRun('run-1', organizationId, source.id, CollectionRunStatus.RUNNING));
    const secondRun = await pipeline.process(source, { success: true, durationMs: 1, errors: [], items: [item(95)] }, new CollectionRun('run-2', organizationId, source.id, CollectionRunStatus.RUNNING));

    expect(normalized[1].disposition).toBe(Disposition.CONFLICT);
    expect(secondRun.conflictCount).toBe(1);
    expect(canonical[0].quantity).toBe(100);
    expect(canonical[0].conflictObservationCount).toBe(1);
  });
});
