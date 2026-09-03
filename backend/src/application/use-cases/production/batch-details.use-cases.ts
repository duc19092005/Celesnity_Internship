import {
  IBatchRepository,
  ICanonicalEventRepository,
  IManagementEventRepository,
  INormalizedRecordRepository,
  ISourceObservationRepository,
  ISourceRepository,
  ISystemSettingsRepository,
  IWorkOrderRepository,
} from '../../../domain/repositories';
import { ProductionStateEvaluator } from '../../../domain/services/production-state-evaluator.service';
import { getStationRank } from '../../../domain/enums/station-code.enum';

export class GetBatchDetailUseCase {
  constructor(
    private readonly batchRepo: IBatchRepository,
    private readonly workOrderRepo: IWorkOrderRepository,
    private readonly canonicalRepo: ICanonicalEventRepository,
    private readonly normalizedRepo: INormalizedRecordRepository,
    private readonly mgmtRepo: IManagementEventRepository,
    private readonly settingsRepo: ISystemSettingsRepository,
  ) {}

  public async execute(batchId: string, organizationId: string) {
    const batch = await this.batchRepo.findById(batchId, organizationId);
    if (!batch) {
      throw new Error(`Batch ${batchId} not found`);
    }

    const workOrder = await this.workOrderRepo.findById(batch.workOrderId, organizationId);
    const canonicalEvents = await this.canonicalRepo.findByBatchId(batchId, organizationId);
    const normalizedRecords = await this.normalizedRepo.findByBatchId(batchId, organizationId);
    const managementEvents = await this.mgmtRepo.findByBatchId(batchId, organizationId);
    const settings = await this.settingsRepo.findByOrgId(organizationId);

    const evaluated = ProductionStateEvaluator.evaluateBatch(
      batchId,
      canonicalEvents,
      managementEvents,
      settings?.staleThresholdMinutes ?? 15,
      new Date(),
    );

    return {
      batch: {
        ...batch,
        ...evaluated,
      },
      workOrder,
      canonicalEvents,
      normalizedRecords,
      managementEvents,
    };
  }
}

export class GetBatchProvenanceUseCase {
  constructor(
    private readonly canonicalRepo: ICanonicalEventRepository,
    private readonly normalizedRepo: INormalizedRecordRepository,
    private readonly observationRepo: ISourceObservationRepository,
    private readonly sourceRepo: ISourceRepository,
  ) {}

  public async execute(batchId: string, organizationId: string) {
    const canonicalEvents = await this.canonicalRepo.findByBatchId(batchId, organizationId);
    const normalizedRecords = await this.normalizedRepo.findByBatchId(batchId, organizationId);
    const allSources = await this.sourceRepo.findAll(organizationId);
    const sourceMap = new Map(allSources.map((s) => [s.id, s]));

    const lineage = [];

    for (const canonical of canonicalEvents) {
      const contributingRecords = normalizedRecords.filter(
        (r) => r.station === canonical.station && r.batchId === batchId,
      );

      // Group contributing records by (sourceId + sourceRecordId) to collapse repeated observations from Auto-Sync
      const recordGroups = new Map<string, typeof contributingRecords>();
      for (const rec of contributingRecords) {
        const key = `${rec.sourceId}::${rec.sourceRecordId}`;
        const existing = recordGroups.get(key) || [];
        existing.push(rec);
        recordGroups.set(key, existing);
      }

      const contributions = [];
      for (const [, group] of recordGroups.entries()) {
        // Pick the winning record if present in this group, otherwise the latest record
        const winnerRecord = group.find((r) => r.id === canonical.winningNormalizedRecordId);
        const representativeRec = winnerRecord || group[group.length - 1];

        const observation = await this.observationRepo.findById(representativeRec.rawObservationId);
        const source = sourceMap.get(representativeRec.sourceId);

        contributions.push({
          normalizedRecord: representativeRec,
          sourceObservation: observation,
          sourceName: source?.name || 'Unknown Source',
          sourceType: source?.type || 'UNKNOWN',
          isWinner: Boolean(winnerRecord),
          occurrenceCount: group.length,
          allRunIds: group.map((r) => r.collectionRunId),
        });
      }

      // Sort so Winner is always at the top of the contributions list
      contributions.sort((a, b) => (b.isWinner ? 1 : 0) - (a.isWinner ? 1 : 0));

      lineage.push({
        station: canonical.station,
        canonicalEvent: canonical,
        contributions,
      });
    }

    // Sort lineage strictly according to 6-station order (1 -> 6)
    lineage.sort((a, b) => getStationRank(a.station) - getStationRank(b.station));

    return {
      batchId,
      lineage,
    };
  }
}
