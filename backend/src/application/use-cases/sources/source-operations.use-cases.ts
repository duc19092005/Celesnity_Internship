import { Source } from '../../../domain/entities/source.entity';
import { ISourceRepository } from '../../../domain/repositories';
import { COLLECTOR_ADAPTERS_TOKEN, DiscoveredSchemaResult, ICollectorAdapter, IEncryptionService } from '../../ports';

export class ListSourcesUseCase {
  constructor(private readonly sourceRepo: ISourceRepository) {}

  public async execute(organizationId: string): Promise<Source[]> {
    return this.sourceRepo.findAll(organizationId);
  }
}

export class TestSourceConnectionUseCase {
  constructor(
    private readonly sourceRepo: ISourceRepository,
    private readonly encryptionService: IEncryptionService,
    private readonly collectorAdapters: ICollectorAdapter[],
  ) {}

  public async execute(sourceId: string, organizationId: string): Promise<{ connected: boolean; latencyMs: number; message: string }> {
    const source = await this.sourceRepo.findById(sourceId, organizationId);
    if (!source) {
      throw new Error(`Source with ID ${sourceId} not found`);
    }

    const adapter = this.collectorAdapters.find((a) => a.supports(source.type));
    if (!adapter) {
      throw new Error(`No collector adapter found for source type: ${source.type}`);
    }

    let secret: string | undefined;
    if (source.encryptedSecret) {
      secret = this.encryptionService.decrypt(source.encryptedSecret);
    }

    try {
      const result = await adapter.testConnection(source.config, secret);
      if (result.connected) {
        source.markVerified();
      } else {
        source.markError();
      }
      await this.sourceRepo.save(source);
      return result;
    } catch (err: any) {
      source.markError();
      await this.sourceRepo.save(source);
      return {
        connected: false,
        latencyMs: 0,
        message: err.message || 'Connection test failed',
      };
    }
  }
}

export class DiscoverSourceSchemaUseCase {
  constructor(
    private readonly sourceRepo: ISourceRepository,
    private readonly encryptionService: IEncryptionService,
    private readonly collectorAdapters: ICollectorAdapter[],
  ) {}

  public async execute(sourceId: string, organizationId: string): Promise<DiscoveredSchemaResult> {
    const source = await this.sourceRepo.findById(sourceId, organizationId);
    if (!source) {
      throw new Error(`Source with ID ${sourceId} not found`);
    }

    const adapter = this.collectorAdapters.find((a) => a.supports(source.type));
    if (!adapter) {
      throw new Error(`No collector adapter found for source type: ${source.type}`);
    }

    let secret: string | undefined;
    if (source.encryptedSecret) {
      secret = this.encryptionService.decrypt(source.encryptedSecret);
    }

    return adapter.discoverSchema(source.config, secret);
  }
}

export class SaveSourceSelectionUseCase {
  constructor(private readonly sourceRepo: ISourceRepository) {}

  public async execute(sourceId: string, selection: any, organizationId: string): Promise<Source> {
    const source = await this.sourceRepo.findById(sourceId, organizationId);
    if (!source) {
      throw new Error(`Source with ID ${sourceId} not found`);
    }

    source.updateSelection(selection);
    return this.sourceRepo.save(source);
  }
}
