import { QualityStatus } from '../enums/common.enums';
import { StationCode } from '../enums/station-code.enum';

export class TelemetryRecord {
  constructor(
    public id: string,
    public organizationId: string,
    public batchId: string,
    public station: StationCode,
    public machineId: string,
    public temperatureC: number | null = null,
    public humidityPercent: number | null = null,
    public qualityStatus: QualityStatus = QualityStatus.PASS,
    public rawPayload: Record<string, any> = {},
    public recordedAt: Date = new Date(),
  ) {}
}

export class SystemSettings {
  constructor(
    public organizationId: string,
    public staleThresholdMinutes: number = 15,
    public updatedAt: Date = new Date(),
  ) {}
}
