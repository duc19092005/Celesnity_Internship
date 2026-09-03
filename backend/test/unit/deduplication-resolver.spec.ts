import { DeduplicationResolver } from '../../src/domain/services/deduplication-resolver.service';
import { NormalizedRecord } from '../../src/domain/entities/normalized-record.entity';
import { Disposition, QualityStatus, SourceType } from '../../src/domain/enums/common.enums';
import { StationCode } from '../../src/domain/enums/station-code.enum';

describe('DeduplicationResolver (Domain Unit Tests)', () => {
  const sourceTypesMap = new Map<string, SourceType>([
    ['src-crawler', SourceType.WEB_CRAWLER],
    ['src-db', SourceType.POSTGRESQL],
    ['src-api', SourceType.REST_API],
  ]);

  it('1. should accept single record cluster directly', () => {
    const record = new NormalizedRecord(
      'rec-1', 'org-1', 'src-db', 'run-1', 'obs-1', 'SR-1', 1, 'BATCH-001', 'WO-1',
      StationCode.SORTING, 120, new Date(), QualityStatus.PASS,
    );

    const result = DeduplicationResolver.resolveCluster([record], sourceTypesMap);
    expect(result.winner.id).toBe('rec-1');
    expect(result.winner.disposition).toBe(Disposition.ACCEPTED);
    expect(result.duplicates.length).toBe(0);
    expect(result.conflicts.length).toBe(0);
  });

  it('2. should mark identical observations as DUPLICATE without multiplying quantity', () => {
    const original = new NormalizedRecord(
      'rec-1', 'org-1', 'src-db', 'run-1', 'obs-1', 'PROD-EVT-008', 1, 'BATCH-002', 'WO-1001',
      StationCode.FOLDING, 80, new Date('2026-09-01T09:00:00Z'), QualityStatus.PASS, Disposition.ACCEPTED, null, null, { folderLane: 2 },
    );

    // Duplicate observation of rec-1 (same source record id and identical payload)
    const duplicate = new NormalizedRecord(
      'rec-2', 'org-1', 'src-db', 'run-2', 'obs-2', 'PROD-EVT-008', 1, 'BATCH-002', 'WO-1001',
      StationCode.FOLDING, 80, new Date('2026-09-01T09:00:00Z'), QualityStatus.PASS, Disposition.ACCEPTED, null, null, { folderLane: 2 },
    );

    const result = DeduplicationResolver.resolveCluster([original, duplicate], sourceTypesMap);
    expect(result.winner.quantity).toBe(80); // Quantity is 80, NOT 160
    expect(result.duplicates.length).toBe(1);
    expect(result.duplicates[0].disposition).toBe(Disposition.DUPLICATE);
    expect(result.conflicts.length).toBe(0);
  });

  it('3. should resolve conflicting records deterministically based on source authority and revision', () => {
    // Record from REST API with quantity 100
    const apiRec = new NormalizedRecord(
      'rec-api', 'org-1', 'src-api', 'run-1', 'obs-api', 'SR-RECEIVE-1', 1, 'BATCH-001', 'WO-1001',
      StationCode.RECEIVING, 100, new Date('2026-09-01T08:00:00Z'), QualityStatus.PASS,
    );

    // Record from Web Crawler with quantity 120 (Crawler has higher authority for RECEIVING)
    const crawlerRec = new NormalizedRecord(
      'rec-crawler', 'org-1', 'src-crawler', 'run-1', 'obs-crawler', 'SR-RECEIVE-1', 1, 'BATCH-001', 'WO-1001',
      StationCode.RECEIVING, 120, new Date('2026-09-01T08:00:00Z'), QualityStatus.PASS,
    );

    const result = DeduplicationResolver.resolveCluster([apiRec, crawlerRec], sourceTypesMap);
    // Crawler wins authority at RECEIVING station
    expect(result.winner.id).toBe('rec-crawler');
    expect(result.winner.quantity).toBe(120);
    expect(result.conflicts.length).toBe(1);
    expect(result.conflicts[0].id).toBe('rec-api');
    expect(result.conflicts[0].disposition).toBe(Disposition.CONFLICT);
  });
});
