import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  IBatchRepository,
  ICanonicalEventRepository,
  ICollectionRunRepository,
  IManagementEventRepository,
  INormalizedRecordRepository,
  ISourceObservationRepository,
  ISourceRepository,
  ISystemSettingsRepository,
  IWorkOrderRepository,
} from '../../../domain/repositories';
import { Source } from '../../../domain/entities/source.entity';
import { CollectionRun } from '../../../domain/entities/collection-run.entity';
import { SourceObservation } from '../../../domain/entities/source-observation.entity';
import { NormalizedRecord } from '../../../domain/entities/normalized-record.entity';
import { CanonicalEvent } from '../../../domain/entities/canonical-event.entity';
import { Batch } from '../../../domain/entities/batch.entity';
import { WorkOrder } from '../../../domain/entities/work-order.entity';
import { ManagementEvent } from '../../../domain/entities/management-event.entity';
import { SystemSettings } from '../../../domain/entities/telemetry-and-settings.entity';
import { StationCode } from '../../../domain/enums/station-code.enum';
import { SourceOrmEntity } from '../entities/source.orm-entity';
import {
  BatchOrmEntity,
  CanonicalEventOrmEntity,
  CollectionRunOrmEntity,
  ManagementEventOrmEntity,
  NormalizedRecordOrmEntity,
  SourceObservationOrmEntity,
  SystemSettingsOrmEntity,
  WorkOrderOrmEntity,
} from '../entities/all.orm-entities';

@Injectable()
export class TypeOrmSourceRepository implements ISourceRepository {
  constructor(
    @InjectRepository(SourceOrmEntity)
    private readonly repo: Repository<SourceOrmEntity>,
  ) {}

  async findById(id: string, organizationId?: string): Promise<Source | null> {
    const where: any = { id };
    if (organizationId) where.organizationId = organizationId;
    const item = await this.repo.findOne({ where });
    return item ? this.toDomain(item) : null;
  }

  async findAll(organizationId: string): Promise<Source[]> {
    const items = await this.repo.find({ where: { organizationId }, order: { createdAt: 'ASC' } });
    return items.map((i) => this.toDomain(i));
  }

  async save(source: Source): Promise<Source> {
    const orm = this.toOrm(source);
    const saved = await this.repo.save(orm);
    return this.toDomain(saved);
  }

  async delete(id: string, organizationId: string): Promise<boolean> {
    const res = await this.repo.delete({ id, organizationId });
    return (res.affected || 0) > 0;
  }

  private toDomain(orm: SourceOrmEntity): Source {
    return new Source(
      orm.id,
      orm.organizationId,
      orm.name,
      orm.type,
      orm.config,
      orm.encryptedSecret,
      orm.selectedSchema,
      orm.status,
      orm.autoSync,
      orm.syncIntervalSeconds,
      orm.lastVerifiedAt,
      orm.lastRunAt,
      orm.createdAt,
      orm.updatedAt,
    );
  }

  private toOrm(domain: Source): SourceOrmEntity {
    const orm = new SourceOrmEntity();
    orm.id = domain.id;
    orm.organizationId = domain.organizationId;
    orm.name = domain.name;
    orm.type = domain.type;
    orm.config = domain.config;
    orm.encryptedSecret = domain.encryptedSecret;
    orm.selectedSchema = domain.selectedSchema;
    orm.status = domain.status;
    orm.autoSync = domain.autoSync;
    orm.syncIntervalSeconds = domain.syncIntervalSeconds;
    orm.lastVerifiedAt = domain.lastVerifiedAt;
    orm.lastRunAt = domain.lastRunAt;
    return orm;
  }
}

@Injectable()
export class TypeOrmCollectionRunRepository implements ICollectionRunRepository {
  constructor(
    @InjectRepository(CollectionRunOrmEntity)
    private readonly repo: Repository<CollectionRunOrmEntity>,
  ) {}

  async findById(id: string): Promise<CollectionRun | null> {
    const item = await this.repo.findOne({ where: { id } });
    return item ? this.toDomain(item) : null;
  }

  async findBySourceId(sourceId: string, limit = 50): Promise<CollectionRun[]> {
    const items = await this.repo.find({ where: { sourceId }, order: { startedAt: 'DESC' }, take: limit });
    return items.map((i) => this.toDomain(i));
  }

  async findAll(organizationId: string, limit = 50): Promise<CollectionRun[]> {
    const items = await this.repo.find({ where: { organizationId }, order: { startedAt: 'DESC' }, take: limit });
    return items.map((i) => this.toDomain(i));
  }

  async save(run: CollectionRun): Promise<CollectionRun> {
    const orm = this.toOrm(run);
    const saved = await this.repo.save(orm);
    return this.toDomain(saved);
  }

  private toDomain(orm: CollectionRunOrmEntity): CollectionRun {
    return new CollectionRun(
      orm.id,
      orm.organizationId,
      orm.sourceId,
      orm.status,
      orm.startedAt,
      orm.finishedAt,
      orm.durationMs,
      orm.observedCount,
      orm.normalizedCount,
      orm.acceptedCount,
      orm.duplicateCount,
      orm.conflictCount,
      orm.rejectedCount,
      orm.errorCount,
      orm.errors,
      orm.createdAt,
    );
  }

  private toOrm(domain: CollectionRun): CollectionRunOrmEntity {
    const orm = new CollectionRunOrmEntity();
    orm.id = domain.id;
    orm.organizationId = domain.organizationId;
    orm.sourceId = domain.sourceId;
    orm.status = domain.status;
    orm.startedAt = domain.startedAt;
    orm.finishedAt = domain.finishedAt;
    orm.durationMs = domain.durationMs;
    orm.observedCount = domain.observedCount;
    orm.normalizedCount = domain.normalizedCount;
    orm.acceptedCount = domain.acceptedCount;
    orm.duplicateCount = domain.duplicateCount;
    orm.conflictCount = domain.conflictCount;
    orm.rejectedCount = domain.rejectedCount;
    orm.errorCount = domain.errorCount;
    orm.errors = domain.errors;
    return orm;
  }
}

@Injectable()
export class TypeOrmSourceObservationRepository implements ISourceObservationRepository {
  constructor(
    @InjectRepository(SourceObservationOrmEntity)
    private readonly repo: Repository<SourceObservationOrmEntity>,
  ) {}

  async findById(id: string): Promise<SourceObservation | null> {
    const item = await this.repo.findOne({ where: { id } });
    return item ? this.toDomain(item) : null;
  }

  async save(obs: SourceObservation): Promise<SourceObservation> {
    const orm = this.toOrm(obs);
    const saved = await this.repo.save(orm);
    return this.toDomain(saved);
  }

  async saveMany(obsList: SourceObservation[]): Promise<SourceObservation[]> {
    if (obsList.length === 0) return [];
    const orms = obsList.map((o) => this.toOrm(o));
    const saved = await this.repo.save(orms);
    return saved.map((s) => this.toDomain(s));
  }

  async findByRunId(runId: string): Promise<SourceObservation[]> {
    const items = await this.repo.find({ where: { collectionRunId: runId }, order: { observedAt: 'ASC' } });
    return items.map((i) => this.toDomain(i));
  }

  private toDomain(orm: SourceObservationOrmEntity): SourceObservation {
    return new SourceObservation(
      orm.id,
      orm.organizationId,
      orm.sourceId,
      orm.collectionRunId,
      orm.rawPayload,
      orm.sourceRecordId,
      orm.observedAt,
      orm.createdAt,
    );
  }

  private toOrm(domain: SourceObservation): SourceObservationOrmEntity {
    const orm = new SourceObservationOrmEntity();
    orm.id = domain.id;
    orm.organizationId = domain.organizationId;
    orm.sourceId = domain.sourceId;
    orm.collectionRunId = domain.collectionRunId;
    orm.rawPayload = domain.rawPayload;
    orm.sourceRecordId = domain.sourceRecordId;
    orm.observedAt = domain.observedAt;
    return orm;
  }
}

@Injectable()
export class TypeOrmNormalizedRecordRepository implements INormalizedRecordRepository {
  constructor(
    @InjectRepository(NormalizedRecordOrmEntity)
    private readonly repo: Repository<NormalizedRecordOrmEntity>,
  ) {}

  async findById(id: string): Promise<NormalizedRecord | null> {
    const item = await this.repo.findOne({ where: { id } });
    return item ? this.toDomain(item) : null;
  }

  async save(record: NormalizedRecord): Promise<NormalizedRecord> {
    const orm = this.toOrm(record);
    const saved = await this.repo.save(orm);
    return this.toDomain(saved);
  }

  async saveMany(records: NormalizedRecord[]): Promise<NormalizedRecord[]> {
    if (records.length === 0) return [];
    const orms = records.map((r) => this.toOrm(r));
    const saved = await this.repo.save(orms);
    return saved.map((s) => this.toDomain(s));
  }

  async findByRunId(runId: string, page = 1, pageSize = 20): Promise<{ items: NormalizedRecord[]; total: number }> {
    const [items, total] = await this.repo.findAndCount({
      where: { collectionRunId: runId },
      order: { occurredAt: 'DESC' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });
    return { items: items.map((i) => this.toDomain(i)), total };
  }

  async findByBatchId(batchId: string, organizationId: string): Promise<NormalizedRecord[]> {
    const items = await this.repo.find({
      where: { batchId, organizationId },
      order: { occurredAt: 'ASC' },
    });
    return items.map((i) => this.toDomain(i));
  }

  async findByBatchAndStation(batchId: string, station: StationCode, organizationId: string): Promise<NormalizedRecord[]> {
    const items = await this.repo.find({
      where: { batchId, station, organizationId },
      order: { occurredAt: 'ASC' },
    });
    return items.map((i) => this.toDomain(i));
  }

  private toDomain(orm: NormalizedRecordOrmEntity): NormalizedRecord {
    return new NormalizedRecord(
      orm.id,
      orm.organizationId,
      orm.sourceId,
      orm.collectionRunId,
      orm.rawObservationId,
      orm.sourceRecordId,
      orm.sourceRevision,
      orm.batchId,
      orm.workOrderId,
      orm.station,
      orm.quantity,
      orm.occurredAt,
      orm.qualityStatus,
      orm.disposition,
      orm.dispositionReason,
      orm.canonicalEventId,
      orm.payload,
      orm.createdAt,
    );
  }

  private toOrm(domain: NormalizedRecord): NormalizedRecordOrmEntity {
    const orm = new NormalizedRecordOrmEntity();
    orm.id = domain.id;
    orm.organizationId = domain.organizationId;
    orm.sourceId = domain.sourceId;
    orm.collectionRunId = domain.collectionRunId;
    orm.rawObservationId = domain.rawObservationId;
    orm.sourceRecordId = domain.sourceRecordId;
    orm.sourceRevision = domain.sourceRevision;
    orm.batchId = domain.batchId;
    orm.workOrderId = domain.workOrderId;
    orm.station = domain.station;
    orm.quantity = domain.quantity;
    orm.occurredAt = domain.occurredAt;
    orm.qualityStatus = domain.qualityStatus;
    orm.disposition = domain.disposition;
    orm.dispositionReason = domain.dispositionReason;
    orm.canonicalEventId = domain.canonicalEventId;
    orm.payload = domain.payload;
    return orm;
  }
}

@Injectable()
export class TypeOrmCanonicalEventRepository implements ICanonicalEventRepository {
  constructor(
    @InjectRepository(CanonicalEventOrmEntity)
    private readonly repo: Repository<CanonicalEventOrmEntity>,
  ) {}

  async findById(id: string): Promise<CanonicalEvent | null> {
    const item = await this.repo.findOne({ where: { id } });
    return item ? this.toDomain(item) : null;
  }

  async findByBatchId(batchId: string, organizationId: string): Promise<CanonicalEvent[]> {
    const items = await this.repo.find({
      where: { batchId, organizationId },
      order: { occurredAt: 'ASC' },
    });
    return items.map((i) => this.toDomain(i));
  }

  async findByBatchAndStation(batchId: string, station: StationCode, organizationId: string): Promise<CanonicalEvent | null> {
    const item = await this.repo.findOne({ where: { batchId, station, organizationId } });
    return item ? this.toDomain(item) : null;
  }

  async findAll(organizationId: string): Promise<CanonicalEvent[]> {
    const items = await this.repo.find({ where: { organizationId }, order: { occurredAt: 'ASC' } });
    return items.map((i) => this.toDomain(i));
  }

  async save(event: CanonicalEvent): Promise<CanonicalEvent> {
    const orm = this.toOrm(event);
    const saved = await this.repo.save(orm);
    return this.toDomain(saved);
  }

  async saveMany(events: CanonicalEvent[]): Promise<CanonicalEvent[]> {
    if (events.length === 0) return [];
    const orms = events.map((e) => this.toOrm(e));
    const saved = await this.repo.save(orms);
    return saved.map((s) => this.toDomain(s));
  }

  private toDomain(orm: CanonicalEventOrmEntity): CanonicalEvent {
    return new CanonicalEvent(
      orm.id,
      orm.organizationId,
      orm.batchId,
      orm.station,
      orm.quantity,
      orm.occurredAt,
      orm.winningSourceId,
      orm.winningCollectionRunId,
      orm.winningNormalizedRecordId,
      orm.winningSourceRecordId,
      orm.qualityStatus,
      orm.duplicateObservationCount,
      orm.conflictObservationCount,
      orm.payload,
      orm.createdAt,
      orm.updatedAt,
    );
  }

  private toOrm(domain: CanonicalEvent): CanonicalEventOrmEntity {
    const orm = new CanonicalEventOrmEntity();
    orm.id = domain.id;
    orm.organizationId = domain.organizationId;
    orm.batchId = domain.batchId;
    orm.station = domain.station;
    orm.quantity = domain.quantity;
    orm.occurredAt = domain.occurredAt;
    orm.winningSourceId = domain.winningSourceId;
    orm.winningCollectionRunId = domain.winningCollectionRunId;
    orm.winningNormalizedRecordId = domain.winningNormalizedRecordId;
    orm.winningSourceRecordId = domain.winningSourceRecordId;
    orm.qualityStatus = domain.qualityStatus;
    orm.duplicateObservationCount = domain.duplicateObservationCount;
    orm.conflictObservationCount = domain.conflictObservationCount;
    orm.payload = domain.payload;
    return orm;
  }
}

@Injectable()
export class TypeOrmBatchRepository implements IBatchRepository {
  constructor(
    @InjectRepository(BatchOrmEntity)
    private readonly repo: Repository<BatchOrmEntity>,
  ) {}

  async findById(batchId: string, organizationId: string): Promise<Batch | null> {
    const item = await this.repo.findOne({ where: { batchId, organizationId } });
    return item ? this.toDomain(item) : null;
  }

  async findAll(organizationId: string): Promise<Batch[]> {
    const items = await this.repo.find({ where: { organizationId }, order: { batchId: 'ASC' } });
    return items.map((i) => this.toDomain(i));
  }

  async findByLineId(lineId: string, organizationId: string): Promise<Batch[]> {
    const items = await this.repo.find({ where: { lineId, organizationId }, order: { batchId: 'ASC' } });
    return items.map((i) => this.toDomain(i));
  }

  async save(batch: Batch): Promise<Batch> {
    const orm = this.toOrm(batch);
    const saved = await this.repo.save(orm);
    return this.toDomain(saved);
  }

  async saveMany(batches: Batch[]): Promise<Batch[]> {
    if (batches.length === 0) return [];
    const orms = batches.map((b) => this.toOrm(b));
    const saved = await this.repo.save(orms);
    return saved.map((s) => this.toDomain(s));
  }

  private toDomain(orm: BatchOrmEntity): Batch {
    return new Batch(
      orm.batchId,
      orm.organizationId,
      orm.workOrderId,
      orm.lineId,
      orm.currentStation,
      orm.completedQuantity,
      orm.status as any,
      orm.lastEventTime,
      orm.indicators,
      orm.activeBlockReason,
      orm.activeBlockActor,
      orm.activeBlockTimestamp,
      orm.acknowledgedExceptions,
      orm.createdAt,
      orm.updatedAt,
    );
  }

  private toOrm(domain: Batch): BatchOrmEntity {
    const orm = new BatchOrmEntity();
    orm.batchId = domain.batchId;
    orm.organizationId = domain.organizationId;
    orm.workOrderId = domain.workOrderId;
    orm.lineId = domain.lineId;
    orm.currentStation = domain.currentStation;
    orm.completedQuantity = domain.completedQuantity;
    orm.status = domain.status;
    orm.lastEventTime = domain.lastEventTime;
    orm.indicators = domain.indicators;
    orm.activeBlockReason = domain.activeBlockReason;
    orm.activeBlockActor = domain.activeBlockActor;
    orm.activeBlockTimestamp = domain.activeBlockTimestamp;
    orm.acknowledgedExceptions = domain.acknowledgedExceptions;
    return orm;
  }
}

@Injectable()
export class TypeOrmWorkOrderRepository implements IWorkOrderRepository {
  constructor(
    @InjectRepository(WorkOrderOrmEntity)
    private readonly repo: Repository<WorkOrderOrmEntity>,
  ) {}

  async findById(workOrderId: string, organizationId: string): Promise<WorkOrder | null> {
    const item = await this.repo.findOne({ where: { workOrderId, organizationId } });
    return item ? this.toDomain(item) : null;
  }

  async findAll(organizationId: string): Promise<WorkOrder[]> {
    const items = await this.repo.find({ where: { organizationId }, order: { workOrderId: 'ASC' } });
    return items.map((i) => this.toDomain(i));
  }

  async save(workOrder: WorkOrder): Promise<WorkOrder> {
    const orm = this.toOrm(workOrder);
    const saved = await this.repo.save(orm);
    return this.toDomain(saved);
  }

  async saveMany(workOrders: WorkOrder[]): Promise<WorkOrder[]> {
    if (workOrders.length === 0) return [];
    const orms = workOrders.map((w) => this.toOrm(w));
    const saved = await this.repo.save(orms);
    return saved.map((s) => this.toDomain(s));
  }

  private toDomain(orm: WorkOrderOrmEntity): WorkOrder {
    return new WorkOrder(
      orm.workOrderId,
      orm.organizationId,
      orm.customerName,
      orm.targetQuantity,
      orm.plannedStartDate,
      orm.plannedEndDate,
      orm.status,
      orm.createdAt,
    );
  }

  private toOrm(domain: WorkOrder): WorkOrderOrmEntity {
    const orm = new WorkOrderOrmEntity();
    orm.workOrderId = domain.workOrderId;
    orm.organizationId = domain.organizationId;
    orm.customerName = domain.customerName;
    orm.targetQuantity = domain.targetQuantity;
    orm.plannedStartDate = domain.plannedStartDate;
    orm.plannedEndDate = domain.plannedEndDate;
    orm.status = domain.status;
    return orm;
  }
}

@Injectable()
export class TypeOrmManagementEventRepository implements IManagementEventRepository {
  constructor(
    @InjectRepository(ManagementEventOrmEntity)
    private readonly repo: Repository<ManagementEventOrmEntity>,
  ) {}

  async findById(id: string): Promise<ManagementEvent | null> {
    const item = await this.repo.findOne({ where: { id } });
    return item ? this.toDomain(item) : null;
  }

  async findByBatchId(batchId: string, organizationId: string): Promise<ManagementEvent[]> {
    const items = await this.repo.find({
      where: { batchId, organizationId },
      order: { timestamp: 'ASC' },
    });
    return items.map((i) => this.toDomain(i));
  }

  async findAll(organizationId: string): Promise<ManagementEvent[]> {
    const items = await this.repo.find({ where: { organizationId }, order: { timestamp: 'ASC' } });
    return items.map((i) => this.toDomain(i));
  }

  async save(event: ManagementEvent): Promise<ManagementEvent> {
    const orm = this.toOrm(event);
    const saved = await this.repo.save(orm);
    return this.toDomain(saved);
  }

  private toDomain(orm: ManagementEventOrmEntity): ManagementEvent {
    return new ManagementEvent(
      orm.id,
      orm.organizationId,
      orm.batchId,
      orm.action,
      orm.actorId,
      orm.actorName,
      orm.reason,
      orm.note,
      orm.exceptionKey,
      orm.timestamp,
      orm.createdAt,
    );
  }

  private toOrm(domain: ManagementEvent): ManagementEventOrmEntity {
    const orm = new ManagementEventOrmEntity();
    orm.id = domain.id;
    orm.organizationId = domain.organizationId;
    orm.batchId = domain.batchId;
    orm.action = domain.action;
    orm.actorId = domain.actorId;
    orm.actorName = domain.actorName;
    orm.reason = domain.reason;
    orm.note = domain.note;
    orm.exceptionKey = domain.exceptionKey;
    orm.timestamp = domain.timestamp;
    return orm;
  }
}

@Injectable()
export class TypeOrmSystemSettingsRepository implements ISystemSettingsRepository {
  constructor(
    @InjectRepository(SystemSettingsOrmEntity)
    private readonly repo: Repository<SystemSettingsOrmEntity>,
  ) {}

  async findByOrgId(organizationId: string): Promise<SystemSettings | null> {
    const item = await this.repo.findOne({ where: { organizationId } });
    return item ? new SystemSettings(item.organizationId, item.staleThresholdMinutes, item.updatedAt) : null;
  }

  async save(settings: SystemSettings): Promise<SystemSettings> {
    const orm = new SystemSettingsOrmEntity();
    orm.organizationId = settings.organizationId;
    orm.staleThresholdMinutes = settings.staleThresholdMinutes;
    const saved = await this.repo.save(orm);
    return new SystemSettings(saved.organizationId, saved.staleThresholdMinutes, saved.updatedAt);
  }
}
