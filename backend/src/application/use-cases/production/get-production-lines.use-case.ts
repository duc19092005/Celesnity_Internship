import { Batch } from '../../../domain/entities/batch.entity';
import { CanonicalEvent } from '../../../domain/entities/canonical-event.entity';
import { ManagementEvent } from '../../../domain/entities/management-event.entity';
import { WorkOrder } from '../../../domain/entities/work-order.entity';
import { StationCode, STATION_ORDER } from '../../../domain/enums/station-code.enum';
import {
  IBatchRepository,
  ICanonicalEventRepository,
  IManagementEventRepository,
  ISystemSettingsRepository,
  IWorkOrderRepository,
} from '../../../domain/repositories';
import { EvaluatedBatchState, ProductionStateEvaluator } from '../../../domain/services/production-state-evaluator.service';

export interface StationSummary {
  station: StationCode;
  name: string;
  wipCount: number;
  completedQuantity: number;
  staleCount: number;
  blockedCount: number;
}

export interface ProductionLineView {
  lineId: string;
  name: string;
  stations: StationSummary[];
  batches: Array<Batch & { workOrder?: WorkOrder; canonicalEvents: CanonicalEvent[] }>;
  plannedBatches: Array<Batch & { workOrder?: WorkOrder }>;
}

export class GetProductionLinesUseCase {
  constructor(
    private readonly batchRepo: IBatchRepository,
    private readonly workOrderRepo: IWorkOrderRepository,
    private readonly canonicalRepo: ICanonicalEventRepository,
    private readonly mgmtRepo: IManagementEventRepository,
    private readonly settingsRepo: ISystemSettingsRepository,
  ) {}

  public async execute(organizationId: string): Promise<ProductionLineView[]> {
    const settings = await this.settingsRepo.findByOrgId(organizationId);
    const staleThreshold = settings?.staleThresholdMinutes ?? 15;
    const now = new Date();

    const batches = await this.batchRepo.findAll(organizationId);
    const workOrders = await this.workOrderRepo.findAll(organizationId);
    const woMap = new Map<string, WorkOrder>();
    for (const wo of workOrders) {
      woMap.set(wo.workOrderId, wo);
    }

    const allCanonicals = await this.canonicalRepo.findAll(organizationId);
    const canonicalsByBatch = new Map<string, CanonicalEvent[]>();
    for (const c of allCanonicals) {
      if (!canonicalsByBatch.has(c.batchId)) {
        canonicalsByBatch.set(c.batchId, []);
      }
      canonicalsByBatch.get(c.batchId)!.push(c);
    }

    const allMgmts = await this.mgmtRepo.findAll(organizationId);
    const mgmtsByBatch = new Map<string, ManagementEvent[]>();
    for (const m of allMgmts) {
      if (!mgmtsByBatch.has(m.batchId)) {
        mgmtsByBatch.set(m.batchId, []);
      }
      mgmtsByBatch.get(m.batchId)!.push(m);
    }

    // Recalculate evaluated state for each batch
    const evaluatedBatches: Array<Batch & { workOrder?: WorkOrder; canonicalEvents: CanonicalEvent[] }> = [];

    for (const batch of batches) {
      const canonicals = canonicalsByBatch.get(batch.batchId) || [];
      const mgmts = mgmtsByBatch.get(batch.batchId) || [];

      const evaluated: EvaluatedBatchState = ProductionStateEvaluator.evaluateBatch(
        batch.batchId,
        canonicals,
        mgmts,
        staleThreshold,
        now,
      );

      batch.currentStation = evaluated.currentStation;
      batch.completedQuantity = evaluated.completedQuantity;
      batch.status = evaluated.status;
      batch.lastEventTime = evaluated.lastEventTime;
      batch.indicators = evaluated.indicators;
      batch.activeBlockReason = evaluated.activeBlockReason;
      batch.activeBlockActor = evaluated.activeBlockActor;
      batch.activeBlockTimestamp = evaluated.activeBlockTimestamp;
      batch.acknowledgedExceptions = evaluated.acknowledgedExceptions;

      evaluatedBatches.push({
        ...batch,
        workOrder: woMap.get(batch.workOrderId),
        canonicalEvents: canonicals,
      });
    }

    // Group by Line ID (e.g. LINE-A, LINE-B, LINE-C)
    const lineIds = Array.from(new Set(batches.map((b) => b.lineId || 'LINE-A')));
    if (lineIds.length === 0) lineIds.push('LINE-A');

    const lines: ProductionLineView[] = [];

    for (const lineId of lineIds) {
      const lineBatches = evaluatedBatches.filter((b) => b.lineId === lineId);
      const plannedBatches = lineBatches.filter((b) => !b.currentStation);

      const stationSummaries: StationSummary[] = STATION_ORDER.map((station) => {
        const atStation = lineBatches.filter((b) => b.currentStation === station);
        const wipCount = atStation.filter((b) => b.status !== 'COMPLETED').length;
        const completedQuantity = lineBatches.reduce((sum, batch) => {
          const stationEvent = batch.canonicalEvents.find((event) => event.station === station);
          return sum + (stationEvent?.quantity || 0);
        }, 0);
        const staleCount = atStation.filter((b) => b.indicators.isStale).length;
        const blockedCount = atStation.filter((b) => b.indicators.isBlocked).length;

        return {
          station,
          name: this.getStationDisplayName(station),
          wipCount,
          completedQuantity,
          staleCount,
          blockedCount,
        };
      });

      lines.push({
        lineId,
        name: `Production Line ${lineId.replace('LINE-', '')}`,
        stations: stationSummaries,
        batches: lineBatches,
        plannedBatches,
      });
    }

    return lines;
  }

  private getStationDisplayName(station: StationCode): string {
    switch (station) {
      case StationCode.RECEIVING: return '1. Receiving';
      case StationCode.SORTING: return '2. Sorting';
      case StationCode.WASHING: return '3. Washing';
      case StationCode.DRYING: return '4. Drying';
      case StationCode.FOLDING: return '5. Folding';
      case StationCode.DISPATCH: return '6. Dispatch';
      default: return station;
    }
  }
}
