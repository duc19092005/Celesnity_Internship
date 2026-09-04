import { Column, CreateDateColumn, Entity, Index, PrimaryColumn } from 'typeorm';
import { CollectionRunStatus, Disposition, ManagementAction, QualityStatus } from '../../../domain/enums/common.enums';
import { StationCode } from '../../../domain/enums/station-code.enum';

@Entity('collection_runs')
export class CollectionRunOrmEntity {
  @PrimaryColumn('varchar', { length: 50 })
  id: string;

  @Column('varchar', { length: 50 })
  organizationId: string;

  @Column('varchar', { length: 50 })
  sourceId: string;

  @Column('varchar', { length: 50, default: CollectionRunStatus.PENDING })
  status: CollectionRunStatus;

  @Column('timestamp with time zone')
  startedAt: Date;

  @Column('timestamp with time zone', { nullable: true })
  finishedAt: Date | null;

  @Column('int', { default: 0 })
  durationMs: number;

  @Column('int', { default: 0 })
  observedCount: number;

  @Column('int', { default: 0 })
  normalizedCount: number;

  @Column('int', { default: 0 })
  acceptedCount: number;

  @Column('int', { default: 0 })
  duplicateCount: number;

  @Column('int', { default: 0 })
  conflictCount: number;

  @Column('int', { default: 0 })
  rejectedCount: number;

  @Column('int', { default: 0 })
  errorCount: number;

  @Column('jsonb', { default: [] })
  errors: any[];

  @CreateDateColumn({ type: 'timestamp with time zone' })
  createdAt: Date;
}

@Entity('source_observations')
export class SourceObservationOrmEntity {
  @PrimaryColumn('varchar', { length: 50 })
  id: string;

  @Column('varchar', { length: 50 })
  organizationId: string;

  @Column('varchar', { length: 50 })
  sourceId: string;

  @Column('varchar', { length: 50 })
  collectionRunId: string;

  @Column('jsonb')
  rawPayload: Record<string, any>;

  @Column('varchar', { length: 100, nullable: true })
  sourceRecordId: string | null;

  @Column('timestamp with time zone')
  observedAt: Date;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  createdAt: Date;
}

@Entity('normalized_records')
export class NormalizedRecordOrmEntity {
  @PrimaryColumn('varchar', { length: 50 })
  id: string;

  @Column('varchar', { length: 50 })
  organizationId: string;

  @Column('varchar', { length: 50 })
  sourceId: string;

  @Column('varchar', { length: 50 })
  collectionRunId: string;

  @Column('varchar', { length: 50 })
  rawObservationId: string;

  @Column('varchar', { length: 100 })
  sourceRecordId: string;

  @Column('int', { default: 1 })
  sourceRevision: number;

  @Column('varchar', { length: 50 })
  batchId: string;

  @Column('varchar', { length: 50, nullable: true })
  workOrderId: string | null;

  @Column('varchar', { length: 50 })
  station: StationCode;

  @Column('int', { default: 0 })
  quantity: number;

  @Column('timestamp with time zone')
  occurredAt: Date;

  @Column('varchar', { length: 20, default: QualityStatus.PASS })
  qualityStatus: QualityStatus;

  @Column('varchar', { length: 30, default: Disposition.ACCEPTED })
  disposition: Disposition;

  @Column('text', { nullable: true })
  dispositionReason: string | null;

  @Column('varchar', { length: 50, nullable: true })
  canonicalEventId: string | null;

  @Column('jsonb', { default: {} })
  payload: Record<string, any>;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  createdAt: Date;
}

@Entity('canonical_events')
@Index('uq_canonical_business_slot', ['organizationId', 'batchId', 'station'], { unique: true })
export class CanonicalEventOrmEntity {
  @PrimaryColumn('varchar', { length: 80 })
  id: string;

  @Column('varchar', { length: 50 })
  organizationId: string;

  @Column('varchar', { length: 50 })
  batchId: string;

  @Column('varchar', { length: 50 })
  station: StationCode;

  @Column('int', { default: 0 })
  quantity: number;

  @Column('timestamp with time zone')
  occurredAt: Date;

  @Column('varchar', { length: 50 })
  winningSourceId: string;

  @Column('varchar', { length: 50 })
  winningCollectionRunId: string;

  @Column('varchar', { length: 50 })
  winningNormalizedRecordId: string;

  @Column('varchar', { length: 100 })
  winningSourceRecordId: string;

  @Column('varchar', { length: 20, default: QualityStatus.PASS })
  qualityStatus: QualityStatus;

  @Column('int', { default: 0 })
  duplicateObservationCount: number;

  @Column('int', { default: 0 })
  conflictObservationCount: number;

  @Column('jsonb', { default: {} })
  payload: Record<string, any>;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  createdAt: Date;

  @Column('timestamp with time zone', { default: () => 'CURRENT_TIMESTAMP' })
  updatedAt: Date;
}

@Entity('batches')
export class BatchOrmEntity {
  @PrimaryColumn('varchar', { length: 50 })
  batchId: string;

  @Column('varchar', { length: 50 })
  organizationId: string;

  @Column('varchar', { length: 50 })
  workOrderId: string;

  @Column('varchar', { length: 50, default: 'LINE-A' })
  lineId: string;

  @Column('varchar', { length: 50, nullable: true })
  currentStation: StationCode | null;

  @Column('int', { default: 0 })
  completedQuantity: number;

  @Column('varchar', { length: 30, default: 'PLANNED' })
  status: string;

  @Column('timestamp with time zone', { nullable: true })
  lastEventTime: Date | null;

  @Column('jsonb', { default: { isStale: false, isBlocked: false, hasMissingData: false, hasQualityWarning: false } })
  indicators: any;

  @Column('text', { nullable: true })
  activeBlockReason: string | null;

  @Column('varchar', { length: 100, nullable: true })
  activeBlockActor: string | null;

  @Column('timestamp with time zone', { nullable: true })
  activeBlockTimestamp: Date | null;

  @Column('text', { array: true, default: '{}' })
  acknowledgedExceptions: string[];

  @CreateDateColumn({ type: 'timestamp with time zone' })
  createdAt: Date;

  @Column('timestamp with time zone', { default: () => 'CURRENT_TIMESTAMP' })
  updatedAt: Date;
}

@Entity('work_orders')
export class WorkOrderOrmEntity {
  @PrimaryColumn('varchar', { length: 50 })
  workOrderId: string;

  @Column('varchar', { length: 50 })
  organizationId: string;

  @Column('varchar', { length: 150 })
  customerName: string;

  @Column('int')
  targetQuantity: number;

  @Column('date')
  plannedStartDate: Date;

  @Column('date')
  plannedEndDate: Date;

  @Column('varchar', { length: 50, default: 'PLANNED' })
  status: string;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  createdAt: Date;
}

@Entity('management_events')
export class ManagementEventOrmEntity {
  @PrimaryColumn('varchar', { length: 50 })
  id: string;

  @Column('varchar', { length: 50 })
  organizationId: string;

  @Column('varchar', { length: 50 })
  batchId: string;

  @Column('varchar', { length: 50 })
  action: ManagementAction;

  @Column('varchar', { length: 50 })
  actorId: string;

  @Column('varchar', { length: 100 })
  actorName: string;

  @Column('text', { nullable: true })
  reason: string | null;

  @Column('text', { nullable: true })
  note: string | null;

  @Column('varchar', { length: 100, nullable: true })
  exceptionKey: string | null;

  @Column('timestamp with time zone')
  timestamp: Date;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  createdAt: Date;
}

@Entity('system_settings')
export class SystemSettingsOrmEntity {
  @PrimaryColumn('varchar', { length: 50 })
  organizationId: string;

  @Column('int', { default: 15 })
  staleThresholdMinutes: number;

  @Column('timestamp with time zone', { default: () => 'CURRENT_TIMESTAMP' })
  updatedAt: Date;
}
