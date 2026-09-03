import { GetBatchProvenanceUseCase } from '../../src/application/use-cases/production/batch-details.use-cases';
import { CanonicalEvent } from '../../src/domain/entities/canonical-event.entity';
import { NormalizedRecord } from '../../src/domain/entities/normalized-record.entity';
import { Source } from '../../src/domain/entities/source.entity';
import { SourceObservation } from '../../src/domain/entities/source-observation.entity';
import { Disposition, QualityStatus, SourceType } from '../../src/domain/enums/common.enums';
import { StationCode, getStationRank } from '../../src/domain/enums/station-code.enum';
import { ProductionStateEvaluator } from '../../src/domain/services/production-state-evaluator.service';

describe('Provenance & Normalization Test Suite (Unit Tests - Phase 2 & 4)', () => {
  const orgId = 'org-celesnity-laundry';
  const batchId = 'BATCH-003';

  describe('1. Deterministic Provenance Ordering 1 -> 6 (TC-4.2)', () => {
    it('should sort lineage strictly in chronological station order 1 -> 6 regardless of ingestion order', async () => {
      // Ingested out of order: Station 4 (DRYING) first, then Station 1 (RECEIVING), then Station 3 (WASHING)
      const canonicalEvents = [
        new CanonicalEvent('canon-4', orgId, batchId, StationCode.DRYING, 100, new Date(), 'src-db', 'run-1', 'norm-4', 'rec-4'),
        new CanonicalEvent('canon-1', orgId, batchId, StationCode.RECEIVING, 100, new Date(), 'src-crawler', 'run-1', 'norm-1', 'rec-1'),
        new CanonicalEvent('canon-3', orgId, batchId, StationCode.WASHING, 100, new Date(), 'src-db', 'run-1', 'norm-3', 'rec-3'),
      ];

      const normalizedRecords = [
        new NormalizedRecord('norm-4', orgId, 'src-db', 'run-1', 'obs-4', 'rec-4', 1, batchId, 'WO-1002', StationCode.DRYING, 100, new Date(), QualityStatus.PASS, Disposition.ACCEPTED),
        new NormalizedRecord('norm-1', orgId, 'src-crawler', 'run-1', 'obs-1', 'rec-1', 1, batchId, 'WO-1002', StationCode.RECEIVING, 100, new Date(), QualityStatus.PASS, Disposition.ACCEPTED),
        new NormalizedRecord('norm-3', orgId, 'src-db', 'run-1', 'obs-3', 'rec-3', 1, batchId, 'WO-1002', StationCode.WASHING, 100, new Date(), QualityStatus.PASS, Disposition.ACCEPTED),
      ];

      const sources = [
        new Source('src-crawler', orgId, 'Supplier Web Crawler', SourceType.WEB_CRAWLER, {}),
        new Source('src-db', orgId, 'Factory DB', SourceType.POSTGRESQL, {}),
      ];

      const mockCanonicalRepo = {
        findByBatchId: jest.fn().mockResolvedValue(canonicalEvents),
      } as any;
      const mockNormalizedRepo = {
        findByBatchId: jest.fn().mockResolvedValue(normalizedRecords),
      } as any;
      const mockObsRepo = {
        findById: jest.fn().mockImplementation(async (id) => new SourceObservation(id, orgId, 'src-1', 'run-1', {}, 'rec-1', new Date())),
      } as any;
      const mockSourceRepo = {
        findAll: jest.fn().mockResolvedValue(sources),
      } as any;

      const useCase = new GetBatchProvenanceUseCase(
        mockCanonicalRepo,
        mockNormalizedRepo,
        mockObsRepo,
        mockSourceRepo,
      );

      const result = await useCase.execute(batchId, orgId);

      expect(result.lineage.length).toBe(3);
      // Verify strict station order: RECEIVING (rank 1) -> WASHING (rank 3) -> DRYING (rank 4)
      expect(result.lineage[0].station).toBe(StationCode.RECEIVING);
      expect(result.lineage[1].station).toBe(StationCode.WASHING);
      expect(result.lineage[2].station).toBe(StationCode.DRYING);
      expect(getStationRank(result.lineage[0].station)).toBeLessThan(getStationRank(result.lineage[1].station));
      expect(getStationRank(result.lineage[1].station)).toBeLessThan(getStationRank(result.lineage[2].station));
    });
  });

  describe('2. Detection of Missing Intermediate Station Gap (TC-4.3 & TC-3.2)', () => {
    it('should flag hasMissingData = true when a batch skips intermediate station (BATCH-003 skips SORTING)', () => {
      // BATCH-003 has Station 1 (RECEIVING) and Station 3 (WASHING), but MISSES Station 2 (SORTING)
      const events = [
        new CanonicalEvent('c1', orgId, batchId, StationCode.RECEIVING, 100, new Date(), 'src-crawler', 'run-1', 'n1', 'sr1'),
        new CanonicalEvent('c3', orgId, batchId, StationCode.WASHING, 100, new Date(), 'src-db', 'run-1', 'n3', 'sr3'),
      ];

      const evaluated = ProductionStateEvaluator.evaluateBatch(batchId, events, []);

      expect(evaluated.currentStation).toBe(StationCode.WASHING);
      expect(evaluated.indicators.hasMissingData).toBe(true);
    });

    it('should clear hasMissingData once the missing event arrives', () => {
      const events = [
        new CanonicalEvent('c1', orgId, batchId, StationCode.RECEIVING, 100, new Date(), 'src-crawler', 'run-1', 'n1', 'sr1'),
        new CanonicalEvent('c3', orgId, batchId, StationCode.WASHING, 100, new Date(), 'src-db', 'run-1', 'n3', 'sr3'),
      ];

      const evaluatedBefore = ProductionStateEvaluator.evaluateBatch(batchId, events, []);
      expect(evaluatedBefore.indicators.hasMissingData).toBe(true);

      // Late event for SORTING arrives
      const lateSorting = new CanonicalEvent('c2', orgId, batchId, StationCode.SORTING, 100, new Date(), 'src-db', 'run-2', 'n2', 'sr2');
      const evaluatedAfter = ProductionStateEvaluator.evaluateBatch(batchId, [...events, lateSorting], []);

      expect(evaluatedAfter.currentStation).toBe(StationCode.WASHING); // Kept furthest station
      expect(evaluatedAfter.indicators.hasMissingData).toBe(false);
    });
  });
});
