import { Disposition, QualityStatus } from '../enums/common.enums';
import { StationCode } from '../enums/station-code.enum';

export class NormalizedRecord {
  constructor(
    public id: string,
    public organizationId: string,
    public sourceId: string,
    public collectionRunId: string,
    public rawObservationId: string,
    public sourceRecordId: string,
    public sourceRevision: number,
    public batchId: string,
    public workOrderId: string | null,
    public station: StationCode,
    public quantity: number,
    public occurredAt: Date,
    public qualityStatus: QualityStatus = QualityStatus.PASS,
    public disposition: Disposition = Disposition.ACCEPTED,
    public dispositionReason: string | null = null,
    public canonicalEventId: string | null = null,
    public payload: Record<string, any> = {},
    public createdAt: Date = new Date(),
  ) {}
}
