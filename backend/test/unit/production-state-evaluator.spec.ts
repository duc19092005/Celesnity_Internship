import { ProductionStateEvaluator } from '../../src/domain/services/production-state-evaluator.service';
import { CanonicalEvent } from '../../src/domain/entities/canonical-event.entity';
import { ManagementEvent } from '../../src/domain/entities/management-event.entity';
import { StationCode } from '../../src/domain/enums/station-code.enum';
import { BatchStatus, ManagementAction, QualityStatus } from '../../src/domain/enums/common.enums';
import { Batch } from '../../src/domain/entities/batch.entity';

describe('ProductionStateEvaluator (Domain Unit Tests)', () => {
  const orgId = 'org-test';
  const batchId = 'BATCH-001';

  it('1. should evaluate state as PLANNED when no canonical events exist', () => {
    const state = ProductionStateEvaluator.evaluateBatch(batchId, [], []);
    expect(state.status).toBe(BatchStatus.PLANNED);
    expect(state.currentStation).toBeNull();
    expect(state.completedQuantity).toBe(0);
    expect(state.indicators.hasMissingData).toBe(false);
  });

  it('2. should evaluate state as IN_PROGRESS and identify furthest station reached', () => {
    const events: CanonicalEvent[] = [
      new CanonicalEvent('c1', orgId, batchId, StationCode.RECEIVING, 120, new Date('2026-09-01T08:00:00Z'), 's1', 'r1', 'n1', 'sr1'),
      new CanonicalEvent('c2', orgId, batchId, StationCode.SORTING, 120, new Date('2026-09-01T08:30:00Z'), 's2', 'r1', 'n2', 'sr2'),
      new CanonicalEvent('c3', orgId, batchId, StationCode.WASHING, 120, new Date('2026-09-01T09:00:00Z'), 's2', 'r1', 'n3', 'sr3'),
    ];

    const state = ProductionStateEvaluator.evaluateBatch(batchId, events, []);
    expect(state.status).toBe(BatchStatus.IN_PROGRESS);
    expect(state.currentStation).toBe(StationCode.WASHING);
    expect(state.completedQuantity).toBe(120);
    expect(state.indicators.hasMissingData).toBe(false);
  });

  it('3. should NOT move batch backwards when a late earlier-station event arrives', () => {
    // Initial events reaching DRYING (Rank 4)
    const initialEvents: CanonicalEvent[] = [
      new CanonicalEvent('c1', orgId, batchId, StationCode.RECEIVING, 100, new Date('2026-09-01T08:00:00Z'), 's1', 'r1', 'n1', 'sr1'),
      new CanonicalEvent('c2', orgId, batchId, StationCode.WASHING, 100, new Date('2026-09-01T08:45:00Z'), 's2', 'r1', 'n2', 'sr2'),
      new CanonicalEvent('c3', orgId, batchId, StationCode.DRYING, 100, new Date('2026-09-01T09:15:00Z'), 's2', 'r1', 'n3', 'sr3'),
    ];

    const state1 = ProductionStateEvaluator.evaluateBatch(batchId, initialEvents, []);
    expect(state1.currentStation).toBe(StationCode.DRYING);
    expect(state1.indicators.hasMissingData).toBe(true); // missing SORTING

    // Late SORTING event arrives later
    const lateSortingEvent = new CanonicalEvent(
      'c-late',
      orgId,
      batchId,
      StationCode.SORTING,
      100,
      new Date('2026-09-01T08:20:00Z'),
      's2',
      'r2',
      'n-late',
      'sr-late',
    );

    const state2 = ProductionStateEvaluator.evaluateBatch(batchId, [...initialEvents, lateSortingEvent], []);
    // Must remain at DRYING, never moved backwards to SORTING
    expect(state2.currentStation).toBe(StationCode.DRYING);
    // Gap filled: no longer missing data
    expect(state2.indicators.hasMissingData).toBe(false);
  });

  it('4. should respect State Precedence: COMPLETED > BLOCKED > IN_PROGRESS', () => {
    const events: CanonicalEvent[] = [
      new CanonicalEvent('c1', orgId, batchId, StationCode.RECEIVING, 120, new Date(), 's1', 'r1', 'n1', 'sr1'),
      new CanonicalEvent('c6', orgId, batchId, StationCode.DISPATCH, 120, new Date(), 's3', 'r1', 'n6', 'sr6'),
    ];

    // Even if manager applied an active block, DISPATCH accepted makes it COMPLETED
    const mgmtEvents: ManagementEvent[] = [
      new ManagementEvent('m1', orgId, batchId, ManagementAction.BLOCK, 'u1', 'Manager', 'Temporary issue', null, null, new Date()),
    ];

    const state = ProductionStateEvaluator.evaluateBatch(batchId, events, mgmtEvents);
    expect(state.status).toBe(BatchStatus.COMPLETED);
    expect(state.currentStation).toBe(StationCode.DISPATCH);
  });

  it('5. should handle active block and resume correctly', () => {
    const events: CanonicalEvent[] = [
      new CanonicalEvent('c1', orgId, batchId, StationCode.RECEIVING, 120, new Date(), 's1', 'r1', 'n1', 'sr1'),
    ];

    // Blocked
    const mgmt1: ManagementEvent[] = [
      new ManagementEvent('m1', orgId, batchId, ManagementAction.BLOCK, 'u1', 'Manager', 'Torn linen', null, null, new Date('2026-09-01T10:00:00Z')),
    ];
    const state1 = ProductionStateEvaluator.evaluateBatch(batchId, events, mgmt1);
    expect(state1.status).toBe(BatchStatus.BLOCKED);
    expect(state1.indicators.isBlocked).toBe(true);
    expect(state1.activeBlockReason).toBe('Torn linen');

    // Resumed
    const mgmt2: ManagementEvent[] = [
      ...mgmt1,
      new ManagementEvent('m2', orgId, batchId, ManagementAction.RESUME, 'u1', 'Manager', null, 'Fixed and verified', null, new Date('2026-09-01T10:30:00Z')),
    ];
    const state2 = ProductionStateEvaluator.evaluateBatch(batchId, events, mgmt2);
    expect(state2.status).toBe(BatchStatus.IN_PROGRESS);
    expect(state2.indicators.isBlocked).toBe(false);
  });

  it('6. should detect stale threshold correctly with time difference', () => {
    const eventTime = new Date('2026-09-01T08:00:00Z');
    const events: CanonicalEvent[] = [
      new CanonicalEvent('c1', orgId, batchId, StationCode.RECEIVING, 100, eventTime, 's1', 'r1', 'n1', 'sr1'),
    ];

    // 10 minutes later -> not stale (threshold = 15m)
    const time10m = new Date('2026-09-01T08:10:00Z');
    const state1 = ProductionStateEvaluator.evaluateBatch(batchId, events, [], 15, time10m);
    expect(state1.indicators.isStale).toBe(false);

    // 25 minutes later -> stale!
    const time25m = new Date('2026-09-01T08:25:00Z');
    const state2 = ProductionStateEvaluator.evaluateBatch(batchId, events, [], 15, time25m);
    expect(state2.indicators.isStale).toBe(true);
  });

  it('7. should calculate station WIP excluding completed batches', () => {
    const batches: Batch[] = [
      new Batch('B1', orgId, 'WO1', 'LINE-A', StationCode.WASHING, 100, BatchStatus.IN_PROGRESS),
      new Batch('B2', orgId, 'WO1', 'LINE-A', StationCode.WASHING, 80, BatchStatus.IN_PROGRESS),
      new Batch('B3', orgId, 'WO1', 'LINE-A', StationCode.WASHING, 80, BatchStatus.COMPLETED), // Completed -> excluded from WIP
      new Batch('B4', orgId, 'WO1', 'LINE-A', StationCode.DRYING, 120, BatchStatus.IN_PROGRESS),
    ];

    const washingWip = ProductionStateEvaluator.calculateStationWip(StationCode.WASHING, batches);
    expect(washingWip).toBe(2);

    const dryingWip = ProductionStateEvaluator.calculateStationWip(StationCode.DRYING, batches);
    expect(dryingWip).toBe(1);
  });
});
