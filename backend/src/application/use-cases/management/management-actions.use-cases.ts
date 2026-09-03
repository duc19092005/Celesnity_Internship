import { ManagementEvent } from '../../../domain/entities/management-event.entity';
import { BatchStatus, ManagementAction } from '../../../domain/enums/common.enums';
import { StationCode } from '../../../domain/enums/station-code.enum';
import { BatchNotFoundException, InvalidOperationException } from '../../../domain/exceptions/domain.exceptions';
import { IBatchRepository, ICanonicalEventRepository, IManagementEventRepository } from '../../../domain/repositories';

export interface BlockBatchInput {
  organizationId: string;
  batchId: string;
  actorId: string;
  actorName: string;
  reason: string;
}

export class BlockBatchUseCase {
  constructor(
    private readonly batchRepo: IBatchRepository,
    private readonly mgmtRepo: IManagementEventRepository,
    private readonly canonRepo?: ICanonicalEventRepository,
  ) {}

  public async execute(input: BlockBatchInput): Promise<ManagementEvent> {
    const batch = await this.batchRepo.findById(input.batchId, input.organizationId);
    if (!batch) {
      throw new BatchNotFoundException(input.batchId);
    }

    // Check if batch is completed according to deterministic DISPATCH rule
    let isCompleted = batch.status === BatchStatus.COMPLETED;
    if (!isCompleted && this.canonRepo) {
      const dispatchEvent = await this.canonRepo.findByBatchAndStation(
        input.batchId,
        StationCode.DISPATCH,
        input.organizationId,
      );
      if (dispatchEvent) {
        isCompleted = true;
      }
    }

    if (isCompleted) {
      throw new InvalidOperationException(`Cannot block completed batch '${input.batchId}'`);
    }

    const event = new ManagementEvent(
      `mgmt-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      input.organizationId,
      input.batchId,
      ManagementAction.BLOCK,
      input.actorId,
      input.actorName,
      input.reason,
      null,
      null,
      new Date(),
    );

    const saved = await this.mgmtRepo.save(event);

    // Synchronize batch status in database
    batch.status = BatchStatus.BLOCKED;
    batch.activeBlockReason = input.reason;
    batch.activeBlockActor = input.actorName;
    batch.activeBlockTimestamp = event.timestamp;
    await this.batchRepo.save(batch);

    return saved;
  }
}

export interface ResumeBatchInput {
  organizationId: string;
  batchId: string;
  actorId: string;
  actorName: string;
  note?: string;
}

export class ResumeBatchUseCase {
  constructor(
    private readonly batchRepo: IBatchRepository,
    private readonly mgmtRepo: IManagementEventRepository,
    private readonly canonRepo?: ICanonicalEventRepository,
  ) {}

  public async execute(input: ResumeBatchInput): Promise<ManagementEvent> {
    const batch = await this.batchRepo.findById(input.batchId, input.organizationId);
    if (!batch) {
      throw new BatchNotFoundException(input.batchId);
    }

    if (this.canonRepo) {
      const dispatchEvent = await this.canonRepo.findByBatchAndStation(
        input.batchId,
        StationCode.DISPATCH,
        input.organizationId,
      );
      if (dispatchEvent) {
        throw new InvalidOperationException(`Cannot resume completed batch '${input.batchId}'`);
      }
    }

    const event = new ManagementEvent(
      `mgmt-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      input.organizationId,
      input.batchId,
      ManagementAction.RESUME,
      input.actorId,
      input.actorName,
      null,
      input.note ?? 'Resumed operation by manager',
      null,
      new Date(),
    );

    const saved = await this.mgmtRepo.save(event);

    // Synchronize batch status in database
    batch.status = BatchStatus.IN_PROGRESS;
    batch.activeBlockReason = null;
    batch.activeBlockActor = null;
    batch.activeBlockTimestamp = null;
    await this.batchRepo.save(batch);

    return saved;
  }
}

export interface AcknowledgeExceptionInput {
  organizationId: string;
  batchId: string;
  actorId: string;
  actorName: string;
  exceptionKey: string;
  note?: string;
}

export class AcknowledgeExceptionUseCase {
  constructor(
    private readonly batchRepo: IBatchRepository,
    private readonly mgmtRepo: IManagementEventRepository,
  ) {}

  public async execute(input: AcknowledgeExceptionInput): Promise<ManagementEvent> {
    const batch = await this.batchRepo.findById(input.batchId, input.organizationId);
    if (!batch) {
      throw new BatchNotFoundException(input.batchId);
    }

    const event = new ManagementEvent(
      `mgmt-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      input.organizationId,
      input.batchId,
      ManagementAction.ACKNOWLEDGE,
      input.actorId,
      input.actorName,
      null,
      input.note ?? null,
      input.exceptionKey,
      new Date(),
    );

    return this.mgmtRepo.save(event);
  }
}

export interface AddBatchNoteInput {
  organizationId: string;
  batchId: string;
  actorId: string;
  actorName: string;
  note: string;
}

export class AddBatchNoteUseCase {
  constructor(
    private readonly batchRepo: IBatchRepository,
    private readonly mgmtRepo: IManagementEventRepository,
  ) {}

  public async execute(input: AddBatchNoteInput): Promise<ManagementEvent> {
    const batch = await this.batchRepo.findById(input.batchId, input.organizationId);
    if (!batch) {
      throw new BatchNotFoundException(input.batchId);
    }

    const event = new ManagementEvent(
      `mgmt-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      input.organizationId,
      input.batchId,
      ManagementAction.NOTE,
      input.actorId,
      input.actorName,
      null,
      input.note,
      null,
      new Date(),
    );

    return this.mgmtRepo.save(event);
  }
}
