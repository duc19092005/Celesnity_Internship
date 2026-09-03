import { Body, Controller, Get, Param, Post, Put } from '@nestjs/common';
import { GetProductionLinesUseCase } from '../../application/use-cases/production/get-production-lines.use-case';
import { GetBatchDetailUseCase, GetBatchProvenanceUseCase } from '../../application/use-cases/production/batch-details.use-cases';
import {
  AcknowledgeExceptionUseCase,
  AddBatchNoteUseCase,
  BlockBatchUseCase,
  ResumeBatchUseCase,
} from '../../application/use-cases/management/management-actions.use-cases';
import { GetStaleThresholdUseCase, UpdateStaleThresholdUseCase } from '../../application/use-cases/settings/settings.use-cases';
import {
  AcknowledgeExceptionDto,
  AddBatchNoteDto,
  BlockBatchDto,
  ResumeBatchDto,
  UpdateStaleThresholdDto,
} from '../dto';

@Controller('api/v1/production-lines')
export class ProductionLinesController {
  private readonly defaultOrgId = process.env.DEFAULT_ORGANIZATION_ID || 'org-celesnity-laundry';

  constructor(private readonly getProductionLinesUseCase: GetProductionLinesUseCase) {}

  @Get()
  async getProductionLines() {
    return this.getProductionLinesUseCase.execute(this.defaultOrgId);
  }
}

@Controller('api/v1/batches')
export class BatchesController {
  private readonly defaultOrgId = process.env.DEFAULT_ORGANIZATION_ID || 'org-celesnity-laundry';
  private readonly defaultActorId = process.env.DEFAULT_ACTOR_ID || 'actor-plant-manager';
  private readonly defaultActorName = process.env.DEFAULT_ACTOR_NAME || 'Plant Manager';

  constructor(
    private readonly getBatchDetailUseCase: GetBatchDetailUseCase,
    private readonly getBatchProvenanceUseCase: GetBatchProvenanceUseCase,
    private readonly blockBatchUseCase: BlockBatchUseCase,
    private readonly resumeBatchUseCase: ResumeBatchUseCase,
    private readonly acknowledgeExceptionUseCase: AcknowledgeExceptionUseCase,
    private readonly addBatchNoteUseCase: AddBatchNoteUseCase,
  ) {}

  @Get(':batchId')
  async getBatchDetail(@Param('batchId') batchId: string) {
    return this.getBatchDetailUseCase.execute(batchId, this.defaultOrgId);
  }

  @Get(':batchId/provenance')
  async getBatchProvenance(@Param('batchId') batchId: string) {
    return this.getBatchProvenanceUseCase.execute(batchId, this.defaultOrgId);
  }

  @Post(':batchId/management-events/blocks')
  async blockBatch(@Param('batchId') batchId: string, @Body() dto: BlockBatchDto) {
    return this.blockBatchUseCase.execute({
      organizationId: this.defaultOrgId,
      batchId,
      actorId: this.defaultActorId,
      actorName: this.defaultActorName,
      reason: dto.reason,
    });
  }

  @Post(':batchId/management-events/resumes')
  async resumeBatch(@Param('batchId') batchId: string, @Body() dto: ResumeBatchDto) {
    return this.resumeBatchUseCase.execute({
      organizationId: this.defaultOrgId,
      batchId,
      actorId: this.defaultActorId,
      actorName: this.defaultActorName,
      note: dto.note,
    });
  }

  @Post(':batchId/management-events/acknowledgements')
  async acknowledgeException(@Param('batchId') batchId: string, @Body() dto: AcknowledgeExceptionDto) {
    return this.acknowledgeExceptionUseCase.execute({
      organizationId: this.defaultOrgId,
      batchId,
      actorId: this.defaultActorId,
      actorName: this.defaultActorName,
      exceptionKey: dto.exceptionKey,
      note: dto.note,
    });
  }

  @Post(':batchId/management-events/notes')
  async addBatchNote(@Param('batchId') batchId: string, @Body() dto: AddBatchNoteDto) {
    return this.addBatchNoteUseCase.execute({
      organizationId: this.defaultOrgId,
      batchId,
      actorId: this.defaultActorId,
      actorName: this.defaultActorName,
      note: dto.note,
    });
  }
}

@Controller('api/v1/settings')
export class SettingsController {
  private readonly defaultOrgId = process.env.DEFAULT_ORGANIZATION_ID || 'org-celesnity-laundry';

  constructor(
    private readonly getStaleThresholdUseCase: GetStaleThresholdUseCase,
    private readonly updateStaleThresholdUseCase: UpdateStaleThresholdUseCase,
  ) {}

  @Get('stale-threshold')
  async getStaleThreshold() {
    const minutes = await this.getStaleThresholdUseCase.execute(this.defaultOrgId);
    return { staleThresholdMinutes: minutes };
  }

  @Put('stale-threshold')
  async updateStaleThreshold(@Body() dto: UpdateStaleThresholdDto) {
    return this.updateStaleThresholdUseCase.execute(this.defaultOrgId, dto.minutes);
  }
}
