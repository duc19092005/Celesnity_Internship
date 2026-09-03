import { Injectable, Logger } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { TypeOrmSourceRepository } from '../persistence/repositories/typeorm-repositories';
import { RunCollectionUseCase } from '../../application/use-cases/collection/run-collection.use-case';

@Injectable()
export class AutoSyncSchedulerService {
  private readonly logger = new Logger(AutoSyncSchedulerService.name);
  private isRunning = false;

  constructor(
    private readonly sourceRepo: TypeOrmSourceRepository,
    private readonly runCollectionUseCase: RunCollectionUseCase,
  ) {}

  @Interval(10000) // Check every 10s for sources needing sync
  async handleAutoSyncTick() {
    if (this.isRunning) return;
    this.isRunning = true;

    try {
      const orgId = process.env.DEFAULT_ORGANIZATION_ID || 'org-celesnity-laundry';
      const sources = await this.sourceRepo.findAll(orgId);
      const autoSyncSources = sources.filter((s) => s.autoSync);

      const now = Date.now();
      for (const source of autoSyncSources) {
        const intervalMs = (source.syncIntervalSeconds || 30) * 1000;
        const lastRun = source.lastRunAt ? new Date(source.lastRunAt).getTime() : 0;

        if (now - lastRun >= intervalMs) {
          this.logger.log(`Auto-sync triggered for source '${source.name}' (${source.id})`);
          await this.runCollectionUseCase.execute(source.id, orgId);
        }
      }
    } catch (err: any) {
      this.logger.error(`Auto-sync scheduler error: ${err.message}`);
    } finally {
      this.isRunning = false;
    }
  }
}
