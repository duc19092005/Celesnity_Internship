import { CollectionRun } from '../../../domain/entities/collection-run.entity';
import { CollectionRunStatus } from '../../../domain/enums/common.enums';
import { AdapterNotFoundException, SourceNotFoundException } from '../../../domain/exceptions/domain.exceptions';
import { ICollectionRunRepository, ISourceRepository } from '../../../domain/repositories';
import { ICollectorAdapter, IEncryptionService } from '../../ports';
import { IngestionPipelineService } from '../../services/ingestion-pipeline.service';

export class RunCollectionUseCase {
  constructor(
    private readonly sourceRepo: ISourceRepository,
    private readonly collectionRunRepo: ICollectionRunRepository,
    private readonly encryptionService: IEncryptionService,
    private readonly collectorAdapters: ICollectorAdapter[],
    private readonly pipelineService: IngestionPipelineService,
  ) {}

  public async execute(sourceId: string, organizationId: string): Promise<CollectionRun> {
    const source = await this.sourceRepo.findById(sourceId, organizationId);
    if (!source) {
      throw new SourceNotFoundException(sourceId);
    }

    const adapter = this.collectorAdapters.find((a) => a.supports(source.type));
    if (!adapter) {
      throw new AdapterNotFoundException(source.type);
    }

    const runId = `run-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const run = new CollectionRun(runId, organizationId, source.id, CollectionRunStatus.RUNNING);
    await this.collectionRunRepo.save(run);

    const secret = source.encryptedSecret ? this.encryptionService.decrypt(source.encryptedSecret) : undefined;

    // Pre-flight connection health check before scraping
    try {
      const health = await adapter.testConnection(source.config, secret);
      if (health.connected) {
        source.markVerified();
        await this.sourceRepo.save(source);
      } else {
        source.markError();
        await this.sourceRepo.save(source);
        run.addError('PREFLIGHT_CONNECTION_FAILED', health.message || 'Connection test failed');
        run.finish(CollectionRunStatus.FAILED);
        await this.collectionRunRepo.save(run);
        return run;
      }
    } catch (testErr: any) {
      source.markError();
      await this.sourceRepo.save(source);
      run.addError('PREFLIGHT_CONNECTION_ERROR', testErr.message || 'Connection test failed');
      run.finish(CollectionRunStatus.FAILED);
      await this.collectionRunRepo.save(run);
      return run;
    }

    try {
      const collectResult = await adapter.collect(source.config, source.selectedSchema, secret);
      return await this.pipelineService.process(source, collectResult, run);
    } catch (err: any) {
      run.addError('COLLECTION_FATAL_ERROR', err.message || 'Collection failed');
      run.finish(CollectionRunStatus.FAILED);
      await this.collectionRunRepo.save(run);
      source.markError();
      await this.sourceRepo.save(source);
      return run;
    }
  }
}
