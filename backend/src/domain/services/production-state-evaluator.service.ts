import { BatchStatus, ManagementAction, QualityStatus } from '../enums/common.enums';
import { getStationRank, StationCode, STATION_ORDER } from '../enums/station-code.enum';
import { CanonicalEvent } from '../entities/canonical-event.entity';
import { ManagementEvent } from '../entities/management-event.entity';
import { Batch, BatchIndicators } from '../entities/batch.entity';

export interface EvaluatedBatchState {
  currentStation: StationCode | null;
  completedQuantity: number;
  status: BatchStatus;
  lastEventTime: Date | null;
  indicators: BatchIndicators;
  activeBlockReason: string | null;
  activeBlockActor: string | null;
  activeBlockTimestamp: Date | null;
  acknowledgedExceptions: string[];
}

export class ProductionStateEvaluator {
  /**
   * Evaluate the complete state of a batch from its canonical events and management history
   */
  public static evaluateBatch(
    batchId: string,
    canonicalEvents: CanonicalEvent[],
    managementEvents: ManagementEvent[],
    staleThresholdMinutes: number = 15,
    currentTime: Date = new Date(),
  ): EvaluatedBatchState {
    // Sort canonical events by station rank & time
    const sortedEvents = [...canonicalEvents].sort(
      (a, b) => getStationRank(a.station) - getStationRank(b.station),
    );

    // 1. Determine Furthest Station Reached & Completed Quantity
    let currentStation: StationCode | null = null;
    let maxRank = 0;
    let completedQuantity = 0;
    let lastEventTime: Date | null = null;
    let hasQualityWarning = false;

    const presentStations = new Set<StationCode>();

    for (const event of sortedEvents) {
      const rank = getStationRank(event.station);
      presentStations.add(event.station);

      if (rank > maxRank) {
        maxRank = rank;
        currentStation = event.station;
        completedQuantity = event.quantity;
      }

      if (!lastEventTime || new Date(event.occurredAt) > new Date(lastEventTime)) {
        lastEventTime = new Date(event.occurredAt);
      }

      if (event.qualityStatus === QualityStatus.FAIL) {
        hasQualityWarning = true;
      }
    }

    // 2. Evaluate Management Stream (Blocks, Resumes, Acknowledges)
    // Sort management events chronologically
    const sortedMgmt = [...managementEvents].sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
    );

    let isBlocked = false;
    let activeBlockReason: string | null = null;
    let activeBlockActor: string | null = null;
    let activeBlockTimestamp: Date | null = null;
    const acknowledgedExceptions: string[] = [];

    for (const mgmt of sortedMgmt) {
      if (mgmt.action === ManagementAction.BLOCK) {
        isBlocked = true;
        activeBlockReason = mgmt.reason;
        activeBlockActor = mgmt.actorName;
        activeBlockTimestamp = new Date(mgmt.timestamp);
      } else if (mgmt.action === ManagementAction.RESUME) {
        isBlocked = false;
        activeBlockReason = null;
        activeBlockActor = null;
        activeBlockTimestamp = null;
      } else if (mgmt.action === ManagementAction.ACKNOWLEDGE && mgmt.exceptionKey) {
        acknowledgedExceptions.push(mgmt.exceptionKey);
      }
    }

    // 3. Evaluate State Precedence
    // Rule: COMPLETED -> BLOCKED -> IN_PROGRESS -> PLANNED
    const hasDispatchEvent = presentStations.has(StationCode.DISPATCH);
    const hasAnyProductionEvent = sortedEvents.length > 0;

    let status: BatchStatus;
    if (hasDispatchEvent) {
      status = BatchStatus.COMPLETED;
    } else if (isBlocked) {
      status = BatchStatus.BLOCKED;
    } else if (hasAnyProductionEvent) {
      status = BatchStatus.IN_PROGRESS;
    } else {
      status = BatchStatus.PLANNED;
    }

    // 4. Missing Data Gap Detection (e.g. at WASHING but missing SORTING or RECEIVING)
    let hasMissingData = false;
    if (currentStation && status !== BatchStatus.PLANNED) {
      const currentRank = getStationRank(currentStation);
      for (const station of STATION_ORDER) {
        const rank = getStationRank(station);
        if (rank < currentRank && !presentStations.has(station)) {
          hasMissingData = true;
          break;
        }
      }
    }

    // 5. Stale Indicator Calculation
    let isStale = false;
    if (status !== BatchStatus.COMPLETED && lastEventTime) {
      const diffMs = currentTime.getTime() - new Date(lastEventTime).getTime();
      const diffMinutes = diffMs / (1000 * 60);
      if (diffMinutes > staleThresholdMinutes) {
        isStale = true;
      }
    }

    return {
      currentStation,
      completedQuantity,
      status,
      lastEventTime,
      indicators: {
        isStale,
        isBlocked: status === BatchStatus.BLOCKED,
        hasMissingData,
        hasQualityWarning,
      },
      activeBlockReason,
      activeBlockActor,
      activeBlockTimestamp,
      acknowledgedExceptions,
    };
  }

  /**
   * Calculate Station WIP (Work in progress) for a list of evaluated batches
   */
  public static calculateStationWip(
    station: StationCode,
    batches: Batch[],
  ): number {
    return batches.filter(
      (b) => b.status !== BatchStatus.COMPLETED && b.currentStation === station,
    ).length;
  }
}
