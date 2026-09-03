import { BatchStatus, QualityStatus } from '../enums/common.enums';
import { StationCode } from '../enums/station-code.enum';

export interface BatchIndicators {
  isStale: boolean;
  isBlocked: boolean;
  hasMissingData: boolean;
  hasQualityWarning: boolean;
}

export class Batch {
  constructor(
    public batchId: string,
    public organizationId: string,
    public workOrderId: string,
    public lineId: string,
    public currentStation: StationCode | null = null,
    public completedQuantity: number = 0,
    public status: BatchStatus = BatchStatus.PLANNED,
    public lastEventTime: Date | null = null,
    public indicators: BatchIndicators = {
      isStale: false,
      isBlocked: false,
      hasMissingData: false,
      hasQualityWarning: false,
    },
    public activeBlockReason: string | null = null,
    public activeBlockActor: string | null = null,
    public activeBlockTimestamp: Date | null = null,
    public acknowledgedExceptions: string[] = [],
    public createdAt: Date = new Date(),
    public updatedAt: Date = new Date(),
  ) {}
}
