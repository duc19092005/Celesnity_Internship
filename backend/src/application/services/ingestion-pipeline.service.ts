import { CollectionRun } from '../../domain/entities/collection-run.entity';
import { Source } from '../../domain/entities/source.entity';
import { SourceObservation } from '../../domain/entities/source-observation.entity';
import { NormalizedRecord } from '../../domain/entities/normalized-record.entity';
import { CanonicalEvent } from '../../domain/entities/canonical-event.entity';
import { Batch } from '../../domain/entities/batch.entity';
import { WorkOrder } from '../../domain/entities/work-order.entity';
import { BatchStatus, CollectionRunStatus, Disposition, QualityStatus, SourceType } from '../../domain/enums/common.enums';
import { isStationCode, StationCode } from '../../domain/enums/station-code.enum';
import {
  IBatchRepository,
  ICanonicalEventRepository,
  ICollectionRunRepository,
  INormalizedRecordRepository,
  ISourceObservationRepository,
  ISourceRepository,
  IWorkOrderRepository,
} from '../../domain/repositories';
import { CollectorExecutionResult } from '../ports';
import { DeduplicationResolver } from '../../domain/services/deduplication-resolver.service';

export class IngestionPipelineService {
  constructor(
    private readonly sourceRepo: ISourceRepository,
    private readonly collectionRunRepo: ICollectionRunRepository,
    private readonly observationRepo: ISourceObservationRepository,
    private readonly normalizedRepo: INormalizedRecordRepository,
    private readonly canonicalRepo: ICanonicalEventRepository,
    private readonly batchRepo: IBatchRepository,
    private readonly workOrderRepo: IWorkOrderRepository,
  ) {}

  public async process(
    source: Source,
    collectResult: CollectorExecutionResult,
    run: CollectionRun,
  ): Promise<CollectionRun> {
    // 1. Record collector-level errors
    for (const err of collectResult.errors) {
      run.addError(err.code, err.message, err.rowNumber, err.rawExcerpt);
    }
    run.observedCount = collectResult.items.length;

    // 2. Persist Raw Observations (Append-only audit store)
    const observations: SourceObservation[] = collectResult.items.map((item, idx) => {
      const obsId = `obs-${run.id}-${idx + 1}`;
      return new SourceObservation(
        obsId,
        source.organizationId,
        source.id,
        run.id,
        item.payload,
        item.sourceRecordId,
        item.observedAt || new Date(),
        new Date(),
      );
    });
    await this.observationRepo.saveMany(observations);

    // 3. Normalize records
    const normalizedRecords: NormalizedRecord[] = [];
    const affectedBatchIds = new Set<string>();

    for (let i = 0; i < collectResult.items.length; i++) {
      const item = collectResult.items[i];
      const obs = observations[i];
      const raw = item.payload;

      // REST metadata owns board mappings, but is not an operational station event.
      if (raw.resourceType === 'work-orders') {
        const workOrderId = String(raw.workOrderId || raw.work_order_id || '').trim();
        if (!workOrderId) {
          run.addError('MISSING_WORK_ORDER_ID', `Metadata row #${i + 1} missing workOrderId`, i + 1, JSON.stringify(raw));
          continue;
        }
        const existing = await this.workOrderRepo.findById(workOrderId, source.organizationId);
        const defaultStart = existing?.plannedStartDate || new Date();
        const defaultEnd = existing?.plannedEndDate || new Date(defaultStart.getTime() + 8 * 60 * 60 * 1000);
        await this.workOrderRepo.save(new WorkOrder(
          workOrderId,
          source.organizationId,
          String(raw.customerName || raw.customer_name || existing?.customerName || 'Unknown customer'),
          Number(raw.targetQuantity ?? raw.target_quantity ?? existing?.targetQuantity ?? 0),
          this.parseToUtc(raw.plannedStartDate || raw.planned_start_date || defaultStart),
          this.parseToUtc(raw.plannedEndDate || raw.planned_end_date || defaultEnd),
          String(raw.status || existing?.status || 'PLANNED'),
          existing?.createdAt || new Date(),
        ));
        continue;
      }

      if (raw.resourceType === 'batches' || raw.isMetadata) {
        const batchId = String(raw.batchId || raw.batch_id || '').trim();
        const workOrderId = String(raw.workOrderId || raw.work_order_id || '').trim();
        if (!batchId || !workOrderId) {
          run.addError('INVALID_BATCH_METADATA', `Metadata row #${i + 1} requires batchId and workOrderId`, i + 1, JSON.stringify(raw));
          continue;
        }
        const existing = await this.batchRepo.findById(batchId, source.organizationId);
        await this.batchRepo.save(new Batch(
          batchId,
          source.organizationId,
          workOrderId,
          String(raw.lineId || raw.line_id || existing?.lineId || 'LINE-A'),
          existing?.currentStation || null,
          existing?.completedQuantity || 0,
          existing?.status || BatchStatus.PLANNED,
          existing?.lastEventTime || null,
          existing?.indicators,
          existing?.activeBlockReason || null,
          existing?.activeBlockActor || null,
          existing?.activeBlockTimestamp || null,
          existing?.acknowledgedExceptions || [],
          existing?.createdAt || new Date(),
          new Date(),
        ));
        continue;
      }

      const batchId = String(raw.batchId || raw.batch_id || raw.batchNumber || raw.batch_number || '').trim();
      const workOrderId = raw.workOrderId || raw.work_order_id || null;
      let stationRaw = String(raw.station || raw.stationCode || raw.station_code || raw.step || '').trim().toUpperCase();

      // Station inference based on source type / tables
      if (!stationRaw || !isStationCode(stationRaw)) {
        if (source.type === SourceType.WEB_CRAWLER) {
          stationRaw = StationCode.RECEIVING;
        } else if (source.type === SourceType.REST_API) {
          if (raw.dispatchDate || raw.destination || raw.dispatchId) {
            stationRaw = StationCode.DISPATCH;
          } else if (raw.receivingDate || raw.receivingId) {
            stationRaw = StationCode.RECEIVING;
          }
        } else if (source.selectedSchema?.selectedTable) {
          const table = source.selectedSchema.selectedTable.toLowerCase();
          if (table.includes('sorting')) stationRaw = StationCode.SORTING;
          else if (table.includes('washing')) stationRaw = StationCode.WASHING;
          else if (table.includes('drying')) stationRaw = StationCode.DRYING;
          else if (table.includes('folding')) stationRaw = StationCode.FOLDING;
          else if (table.includes('dispatch')) stationRaw = StationCode.DISPATCH;
          else if (table.includes('receiving')) stationRaw = StationCode.RECEIVING;
        }
      }

      const quantity = Number(raw.quantity ?? raw.pieces_count ?? raw.pieces ?? raw.completed_quantity ?? 0);
      const occurredAt = this.parseToUtc(raw.eventTime || raw.event_time || raw.deliveryTime || raw.delivery_time || raw.receivedAt || raw.received_at || raw.receivingDate || raw.dispatchDate || raw.dispatch_date || raw.created_at || raw.recorded_at || Date.now());
      const qualityStatus = (String(raw.qualityStatus || raw.quality_status || 'PASS').toUpperCase() === 'FAIL') ? QualityStatus.FAIL : QualityStatus.PASS;
      const recordId = `norm-${run.id}-${i + 1}`;

      if (!batchId) {
        run.addError('MISSING_BATCH_ID', `Row #${i + 1} missing required batch ID`, i + 1, JSON.stringify(raw));
        normalizedRecords.push(
          new NormalizedRecord(
            recordId,
            source.organizationId,
            source.id,
            run.id,
            obs.id,
            item.sourceRecordId || `rec-${i + 1}`,
            item.sourceRevision || 1,
            'UNKNOWN',
            workOrderId,
            StationCode.RECEIVING,
            quantity,
            occurredAt,
            qualityStatus,
            Disposition.REJECTED,
            'Missing required batchId',
            null,
            raw,
          ),
        );
        continue;
      }

      if (!isStationCode(stationRaw)) {
        run.addError('INVALID_STATION_CODE', `Row #${i + 1} invalid station code: ${stationRaw}`, i + 1, JSON.stringify(raw));
        normalizedRecords.push(
          new NormalizedRecord(
            recordId,
            source.organizationId,
            source.id,
            run.id,
            obs.id,
            item.sourceRecordId || `rec-${i + 1}`,
            item.sourceRevision || 1,
            batchId,
            workOrderId,
            StationCode.RECEIVING,
            quantity,
            occurredAt,
            qualityStatus,
            Disposition.REJECTED,
            `Invalid station code: ${stationRaw}`,
            null,
            raw,
          ),
        );
        continue;
      }

      affectedBatchIds.add(batchId);
      normalizedRecords.push(
        new NormalizedRecord(
          recordId,
          source.organizationId,
          source.id,
          run.id,
          obs.id,
          item.sourceRecordId || `rec-${i + 1}`,
          item.sourceRevision || 1,
          batchId,
          workOrderId,
          stationRaw as StationCode,
          quantity,
          occurredAt,
          qualityStatus,
          Disposition.ACCEPTED,
          null,
          null,
          raw,
        ),
      );
    }

    // 4. Durable observation-identity classification.
    // Raw observations are already append-only; normalized identity is
    // (organization, source, sourceRecordId, sourceRevision).
    const eligibleRecords: NormalizedRecord[] = [];
    const currentByIdentity = new Map<string, NormalizedRecord[]>();
    for (const record of normalizedRecords) {
      if (record.disposition === Disposition.REJECTED) continue;
      const identityKey = `${record.sourceId}\u0000${record.sourceRecordId}\u0000${record.sourceRevision}`;
      const persisted = await this.normalizedRepo.findByObservationIdentity(
        record.organizationId,
        record.sourceId,
        record.sourceRecordId,
        record.sourceRevision,
      );
      const identityHistory = [...persisted, ...(currentByIdentity.get(identityKey) || [])]
        .filter((candidate) => candidate.disposition !== Disposition.REJECTED);

      if (identityHistory.length > 0) {
        const identical = identityHistory.find((candidate) => DeduplicationResolver.areBusinessEquivalent(record, candidate));
        record.disposition = identical ? Disposition.DUPLICATE : Disposition.CONFLICT;
        record.dispositionReason = identical
          ? `Repeated observation identity; business-identical to ${identical.id}`
          : `Repeated observation identity has a conflicting business payload/revision`;
      } else {
        eligibleRecords.push(record);
      }
      currentByIdentity.set(identityKey, [...(currentByIdentity.get(identityKey) || []), record]);
    }

    // 5. Resolve canonical business slots (organization, batch, station).
    const allSources = await this.sourceRepo.findAll(source.organizationId);
    const sourceTypesMap = new Map(allSources.map((candidate) => [candidate.id, candidate.type]));
    const clusters = new Map<string, NormalizedRecord[]>();
    for (const record of eligibleRecords) {
      const clusterKey = `${record.batchId}::${record.station}`;
      clusters.set(clusterKey, [...(clusters.get(clusterKey) || []), record]);
    }

    for (const [key, currentCandidates] of clusters.entries()) {
      const [batchId, stationValue] = key.split('::');
      const station = stationValue as StationCode;
      const existingCanonical = await this.canonicalRepo.findByBatchAndStation(batchId, station, source.organizationId);
      const historicalWinner = existingCanonical
        ? await this.normalizedRepo.findById(existingCanonical.winningNormalizedRecordId)
        : null;
      const candidates = historicalWinner ? [historicalWinner, ...currentCandidates] : currentCandidates;
      const resolution = DeduplicationResolver.resolveCluster(candidates, sourceTypesMap);
      const winner = resolution.winner;
      const canonicalId = existingCanonical?.id || `canon-${source.organizationId}-${batchId}-${station}`;

      for (const record of currentCandidates) {
        record.canonicalEventId = canonicalId;
      }

      const currentDuplicates = currentCandidates.filter((record) => record.disposition === Disposition.DUPLICATE).length;
      const currentConflicts = currentCandidates.filter((record) => record.disposition === Disposition.CONFLICT).length;

      if (!existingCanonical) {
        await this.canonicalRepo.save(new CanonicalEvent(
          canonicalId,
          source.organizationId,
          batchId,
          station,
          winner.quantity,
          winner.occurredAt,
          winner.sourceId,
          winner.collectionRunId,
          winner.id,
          winner.sourceRecordId,
          winner.qualityStatus,
          currentDuplicates,
          currentConflicts,
          winner.payload,
        ));
      } else {
        if (winner.id !== existingCanonical.winningNormalizedRecordId) {
          existingCanonical.quantity = winner.quantity;
          existingCanonical.occurredAt = winner.occurredAt;
          existingCanonical.winningSourceId = winner.sourceId;
          existingCanonical.winningCollectionRunId = winner.collectionRunId;
          existingCanonical.winningNormalizedRecordId = winner.id;
          existingCanonical.winningSourceRecordId = winner.sourceRecordId;
          existingCanonical.qualityStatus = winner.qualityStatus;
          existingCanonical.payload = winner.payload;
        }
        existingCanonical.duplicateObservationCount += currentDuplicates;
        existingCanonical.conflictObservationCount += currentConflicts;
        existingCanonical.updatedAt = new Date();
        await this.canonicalRepo.save(existingCanonical);
      }
    }

    // Identity repeats were excluded from slot resolution; link them to an existing slot when possible.
    for (const record of normalizedRecords) {
      if (!record.canonicalEventId && (record.disposition === Disposition.DUPLICATE || record.disposition === Disposition.CONFLICT)) {
        const canonical = await this.canonicalRepo.findByBatchAndStation(record.batchId, record.station, source.organizationId);
        record.canonicalEventId = canonical?.id || null;
        if (canonical) {
          if (record.disposition === Disposition.DUPLICATE) canonical.duplicateObservationCount += 1;
          else canonical.conflictObservationCount += 1;
          canonical.updatedAt = new Date();
          await this.canonicalRepo.save(canonical);
        }
      }
    }

    await this.normalizedRepo.saveMany(normalizedRecords);

    // 6. Update Run counters
    let accepted = 0;
    let duplicates = 0;
    let conflicts = 0;
    let rejected = 0;

    for (const rec of normalizedRecords) {
      if (rec.disposition === Disposition.ACCEPTED) accepted++;
      else if (rec.disposition === Disposition.DUPLICATE) duplicates++;
      else if (rec.disposition === Disposition.CONFLICT) conflicts++;
      else if (rec.disposition === Disposition.REJECTED) rejected++;
    }

    run.normalizedCount = normalizedRecords.length;
    run.acceptedCount = accepted;
    run.duplicateCount = duplicates;
    run.conflictCount = conflicts;
    run.rejectedCount = rejected;

    if (run.errors.length > 0 && run.acceptedCount > 0) {
      run.finish(CollectionRunStatus.PARTIAL_SUCCESS);
    } else if (run.errors.length > 0 && run.acceptedCount === 0) {
      run.finish(CollectionRunStatus.FAILED);
    } else {
      run.finish(CollectionRunStatus.SUCCEEDED);
    }

    await this.collectionRunRepo.save(run);
    source.lastRunAt = new Date();
    await this.sourceRepo.save(source);

    return run;
  }

  private parseToUtc(dateInput: any): Date {
    if (!dateInput) return new Date();
    if (dateInput instanceof Date) return dateInput;
    const str = String(dateInput).trim();
    if (/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(:\d{2})?(\.\d+)?$/.test(str)) {
      return new Date(str.replace(' ', 'T') + '+07:00');
    }
    const parsed = new Date(str);
    return isNaN(parsed.getTime()) ? new Date() : parsed;
  }
}
