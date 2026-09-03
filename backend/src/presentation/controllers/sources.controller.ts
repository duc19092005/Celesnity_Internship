import { Body, Controller, Get, Param, Patch, Post, Put, Query } from '@nestjs/common';
import { RegisterSourceUseCase } from '../../application/use-cases/sources/register-source.use-case';
import {
  DiscoverSourceSchemaUseCase,
  ListSourcesUseCase,
  SaveSourceSelectionUseCase,
  TestSourceConnectionUseCase,
} from '../../application/use-cases/sources/source-operations.use-cases';
import { RunCollectionUseCase } from '../../application/use-cases/collection/run-collection.use-case';
import {
  ConfigureAutoSyncUseCase,
  GetCollectionRunUseCase,
  ListCollectionRunsUseCase,
  PreviewNormalizedRecordsUseCase,
} from '../../application/use-cases/collection/collection-monitoring.use-cases';
import { AutoSyncDto, RegisterSourceDto, SaveSelectionDto } from '../dto';

@Controller('api/v1/sources')
export class SourcesController {
  private readonly defaultOrgId = process.env.DEFAULT_ORGANIZATION_ID || 'org-celesnity-laundry';

  constructor(
    private readonly registerSourceUseCase: RegisterSourceUseCase,
    private readonly listSourcesUseCase: ListSourcesUseCase,
    private readonly testConnectionUseCase: TestSourceConnectionUseCase,
    private readonly discoverSchemaUseCase: DiscoverSourceSchemaUseCase,
    private readonly saveSelectionUseCase: SaveSourceSelectionUseCase,
    private readonly runCollectionUseCase: RunCollectionUseCase,
    private readonly listRunsUseCase: ListCollectionRunsUseCase,
    private readonly getRunUseCase: GetCollectionRunUseCase,
    private readonly previewRecordsUseCase: PreviewNormalizedRecordsUseCase,
    private readonly configureAutoSyncUseCase: ConfigureAutoSyncUseCase,
  ) {}

  @Post()
  async registerSource(@Body() dto: RegisterSourceDto) {
    return this.registerSourceUseCase.execute({
      organizationId: this.defaultOrgId,
      name: dto.name,
      type: dto.type,
      config: dto.config,
      secret: dto.secret,
      selectedSchema: dto.selectedSchema,
    });
  }

  @Get()
  async listSources() {
    return this.listSourcesUseCase.execute(this.defaultOrgId);
  }

  @Post(':sourceId/test')
  async testConnection(@Param('sourceId') sourceId: string) {
    return this.testConnectionUseCase.execute(sourceId, this.defaultOrgId);
  }

  @Post(':sourceId/discover')
  async discoverSchema(@Param('sourceId') sourceId: string) {
    return this.discoverSchemaUseCase.execute(sourceId, this.defaultOrgId);
  }

  @Put(':sourceId/selection')
  async saveSelection(@Param('sourceId') sourceId: string, @Body() dto: SaveSelectionDto) {
    return this.saveSelectionUseCase.execute(sourceId, dto.selection, this.defaultOrgId);
  }

  @Post(':sourceId/runs')
  async runCollection(@Param('sourceId') sourceId: string) {
    return this.runCollectionUseCase.execute(sourceId, this.defaultOrgId);
  }

  @Get(':sourceId/runs')
  async listRunsForSource(@Param('sourceId') sourceId: string, @Query('limit') limit?: string) {
    return this.listRunsUseCase.execute(this.defaultOrgId, sourceId, limit ? parseInt(limit, 10) : 50);
  }

  @Patch(':sourceId/auto-sync')
  async configureAutoSync(@Param('sourceId') sourceId: string, @Body() dto: AutoSyncDto) {
    return this.configureAutoSyncUseCase.execute(sourceId, dto.enabled, dto.intervalSeconds || 30, this.defaultOrgId);
  }
}

@Controller('api/v1/collection-runs')
export class CollectionRunsController {
  private readonly defaultOrgId = process.env.DEFAULT_ORGANIZATION_ID || 'org-celesnity-laundry';

  constructor(
    private readonly listRunsUseCase: ListCollectionRunsUseCase,
    private readonly getRunUseCase: GetCollectionRunUseCase,
    private readonly previewRecordsUseCase: PreviewNormalizedRecordsUseCase,
  ) {}

  @Get()
  async listAllRuns(@Query('limit') limit?: string) {
    return this.listRunsUseCase.execute(this.defaultOrgId, undefined, limit ? parseInt(limit, 10) : 50);
  }

  @Get(':runId')
  async getRunDetail(@Param('runId') runId: string) {
    return this.getRunUseCase.execute(runId);
  }

  @Get(':runId/records')
  async previewRecords(
    @Param('runId') runId: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.previewRecordsUseCase.execute(
      runId,
      page ? parseInt(page, 10) : 1,
      pageSize ? parseInt(pageSize, 10) : 20,
    );
  }
}
