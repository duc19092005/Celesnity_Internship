import { QualityStatus } from '../enums/common.enums';
import { StationCode } from '../enums/station-code.enum';

export class CanonicalEvent {
  constructor(
    public id: string,
    public organizationId: string,
    public batchId: string,
    public station: StationCode,
    public quantity: number,
    public occurredAt: Date,
    public winningSourceId: string,
    public winningCollectionRunId: string,
    public winningNormalizedRecordId: string,
    public winningSourceRecordId: string,
    public qualityStatus: QualityStatus = QualityStatus.PASS,
    public duplicateObservationCount: number = 0,
    public conflictObservationCount: number = 0,
    public payload: Record<string, any> = {},
    public createdAt: Date = new Date(),
    public updatedAt: Date = new Date(),
  ) {}
}
