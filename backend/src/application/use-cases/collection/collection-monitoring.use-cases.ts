import { CollectionRun } from '../../../domain/entities/collection-run.entity';
import { NormalizedRecord } from '../../../domain/entities/normalized-record.entity';
import { ICollectionRunRepository, INormalizedRecordRepository, ISourceRepository } from '../../../domain/repositories';

export class ListCollectionRunsUseCase {
  constructor(private readonly collectionRunRepo: ICollectionRunRepository) {}

  public async execute(organizationId: string, sourceId?: string, limit: number = 50): Promise<CollectionRun[]> {
    if (sourceId) {
      return this.collectionRunRepo.findBySourceId(sourceId, limit);
    }
    return this.collectionRunRepo.findAll(organizationId, limit);
  }
}

export class GetCollectionRunUseCase {
  constructor(private readonly collectionRunRepo: ICollectionRunRepository) {}

  public async execute(runId: string): Promise<CollectionRun | null> {
    return this.collectionRunRepo.findById(runId);
  }
}

export class PreviewNormalizedRecordsUseCase {
  constructor(private readonly normalizedRepo: INormalizedRecordRepository) {}

  public async execute(runId: string, page: number = 1, pageSize: number = 20): Promise<{ items: NormalizedRecord[]; total: number }> {
    return this.normalizedRepo.findByRunId(runId, page, pageSize);
  }
}

export class ConfigureAutoSyncUseCase {
  constructor(private readonly sourceRepo: ISourceRepository) {}

  public async execute(sourceId: string, enabled: boolean, intervalSeconds: number, organizationId: string) {
    const source = await this.sourceRepo.findById(sourceId, organizationId);
    if (!source) {
      throw new Error(`Source with ID ${sourceId} not found`);
    }

    source.setAutoSync(enabled, intervalSeconds);
    return this.sourceRepo.save(source);
  }
}
