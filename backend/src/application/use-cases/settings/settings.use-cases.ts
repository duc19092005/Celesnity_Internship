import { SystemSettings } from '../../../domain/entities/telemetry-and-settings.entity';
import { ISystemSettingsRepository } from '../../../domain/repositories';

export class GetStaleThresholdUseCase {
  constructor(private readonly settingsRepo: ISystemSettingsRepository) {}

  public async execute(organizationId: string): Promise<number> {
    const settings = await this.settingsRepo.findByOrgId(organizationId);
    return settings?.staleThresholdMinutes ?? 15;
  }
}

export class UpdateStaleThresholdUseCase {
  constructor(private readonly settingsRepo: ISystemSettingsRepository) {}

  public async execute(organizationId: string, minutes: number): Promise<SystemSettings> {
    const clamped = Math.max(1, Math.min(1440, minutes));
    let settings = await this.settingsRepo.findByOrgId(organizationId);
    if (!settings) {
      settings = new SystemSettings(organizationId, clamped, new Date());
    } else {
      settings.staleThresholdMinutes = clamped;
      settings.updatedAt = new Date();
    }
    return this.settingsRepo.save(settings);
  }
}
