import { Source } from '../entities/source.entity';
import { CollectionRun } from '../entities/collection-run.entity';
import { SourceObservation } from '../entities/source-observation.entity';
import { NormalizedRecord } from '../entities/normalized-record.entity';
import { CanonicalEvent } from '../entities/canonical-event.entity';
import { Batch } from '../entities/batch.entity';
import { WorkOrder } from '../entities/work-order.entity';
import { ManagementEvent } from '../entities/management-event.entity';
import { SystemSettings } from '../entities/telemetry-and-settings.entity';
import { StationCode } from '../enums/station-code.enum';

export interface ISourceRepository {
  findById(id: string, organizationId?: string): Promise<Source | null>;
  findAll(organizationId: string): Promise<Source[]>;
  save(source: Source): Promise<Source>;
  delete(id: string, organizationId: string): Promise<boolean>;
}

export interface ICollectionRunRepository {
  findById(id: string): Promise<CollectionRun | null>;
  findBySourceId(sourceId: string, limit?: number): Promise<CollectionRun[]>;
  findAll(organizationId: string, limit?: number): Promise<CollectionRun[]>;
  save(run: CollectionRun): Promise<CollectionRun>;
}

export interface ISourceObservationRepository {
  findById(id: string): Promise<SourceObservation | null>;
  save(obs: SourceObservation): Promise<SourceObservation>;
  saveMany(obsList: SourceObservation[]): Promise<SourceObservation[]>;
  findByRunId(runId: string): Promise<SourceObservation[]>;
}

export interface INormalizedRecordRepository {
  findById(id: string): Promise<NormalizedRecord | null>;
  save(record: NormalizedRecord): Promise<NormalizedRecord>;
  saveMany(records: NormalizedRecord[]): Promise<NormalizedRecord[]>;
  findByRunId(runId: string, page?: number, pageSize?: number): Promise<{ items: NormalizedRecord[]; total: number }>;
  findByBatchId(batchId: string, organizationId: string): Promise<NormalizedRecord[]>;
  findByBatchAndStation(batchId: string, station: StationCode, organizationId: string): Promise<NormalizedRecord[]>;
  findByObservationIdentity(
    organizationId: string,
    sourceId: string,
    sourceRecordId: string,
    sourceRevision: number,
  ): Promise<NormalizedRecord[]>;
}

export interface ICanonicalEventRepository {
  findById(id: string): Promise<CanonicalEvent | null>;
  findByBatchId(batchId: string, organizationId: string): Promise<CanonicalEvent[]>;
  findByBatchAndStation(batchId: string, station: StationCode, organizationId: string): Promise<CanonicalEvent | null>;
  findAll(organizationId: string): Promise<CanonicalEvent[]>;
  save(event: CanonicalEvent): Promise<CanonicalEvent>;
  saveMany(events: CanonicalEvent[]): Promise<CanonicalEvent[]>;
}

export interface IBatchRepository {
  findById(batchId: string, organizationId: string): Promise<Batch | null>;
  findAll(organizationId: string): Promise<Batch[]>;
  findByLineId(lineId: string, organizationId: string): Promise<Batch[]>;
  save(batch: Batch): Promise<Batch>;
  saveMany(batches: Batch[]): Promise<Batch[]>;
}

export interface IWorkOrderRepository {
  findById(workOrderId: string, organizationId: string): Promise<WorkOrder | null>;
  findAll(organizationId: string): Promise<WorkOrder[]>;
  save(workOrder: WorkOrder): Promise<WorkOrder>;
  saveMany(workOrders: WorkOrder[]): Promise<WorkOrder[]>;
}

export interface IManagementEventRepository {
  findById(id: string): Promise<ManagementEvent | null>;
  findByBatchId(batchId: string, organizationId: string): Promise<ManagementEvent[]>;
  findAll(organizationId: string): Promise<ManagementEvent[]>;
  save(event: ManagementEvent): Promise<ManagementEvent>;
}

export interface ISystemSettingsRepository {
  findByOrgId(organizationId: string): Promise<SystemSettings | null>;
  save(settings: SystemSettings): Promise<SystemSettings>;
}

export const REPOSITORY_TOKENS = {
  SOURCE_REPOSITORY: 'SOURCE_REPOSITORY',
  COLLECTION_RUN_REPOSITORY: 'COLLECTION_RUN_REPOSITORY',
  SOURCE_OBSERVATION_REPOSITORY: 'SOURCE_OBSERVATION_REPOSITORY',
  NORMALIZED_RECORD_REPOSITORY: 'NORMALIZED_RECORD_REPOSITORY',
  CANONICAL_EVENT_REPOSITORY: 'CANONICAL_EVENT_REPOSITORY',
  BATCH_REPOSITORY: 'BATCH_REPOSITORY',
  WORK_ORDER_REPOSITORY: 'WORK_ORDER_REPOSITORY',
  MANAGEMENT_EVENT_REPOSITORY: 'MANAGEMENT_EVENT_REPOSITORY',
  SYSTEM_SETTINGS_REPOSITORY: 'SYSTEM_SETTINGS_REPOSITORY',
};
