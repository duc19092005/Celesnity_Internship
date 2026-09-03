import { CollectionRun } from '../../domain/entities/collection-run.entity';
import { Source } from '../../domain/entities/source.entity';
import { SourceObservation } from '../../domain/entities/source-observation.entity';
import { NormalizedRecord } from '../../domain/entities/normalized-record.entity';
import { CanonicalEvent } from '../../domain/entities/canonical-event.entity';
import { CollectionRunStatus, Disposition, QualityStatus, SourceType } from '../../domain/enums/common.enums';
import { isStationCode, StationCode } from '../../domain/enums/station-code.enum';
import {
  ICanonicalEventRepository,
  ICollectionRunRepository,
  INormalizedRecordRepository,
  ISourceObservationRepository,
  ISourceRepository,
} from '../../domain/repositories';
import { CollectorExecutionResult } from '../ports';
import { DeduplicationResolver } from '../../domain/services/deduplication-resolver.service';
import { FingerprintCacheService } from '../../infrastructure/cache/fingerprint-cache.service';

export class IngestionPipelineService {
  constructor(
    private readonly sourceRepo: ISourceRepository,
    private readonly collectionRunRepo: ICollectionRunRepository,
    private readonly observationRepo: ISourceObservationRepository,
    private readonly normalizedRepo: INormalizedRecordRepository,
    private readonly canonicalRepo: ICanonicalEventRepository,
    private readonly fingerprintCache?: FingerprintCacheService,
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

      // Handle pure metadata / mapping records (e.g. /batches, /work-orders)
      if (raw.resourceType === 'batches' || raw.resourceType === 'work-orders' || raw.isMetadata) {
        normalizedRecords.push(
          new NormalizedRecord(
            `norm-${run.id}-${i + 1}`,
            source.organizationId,
            source.id,
            run.id,
            obs.id,
            item.sourceRecordId || `rec-${i + 1}`,
            item.sourceRevision || 1,
            String(raw.batchId || 'METADATA'),
            raw.workOrderId || null,
            StationCode.RECEIVING,
            0,
            new Date(),
            QualityStatus.PASS,
            Disposition.ACCEPTED,
            null,
            null,
            raw,
          ),
        );
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
      const occurredAt = new Date(raw.eventTime || raw.event_time || raw.deliveryTime || raw.delivery_time || raw.created_at || raw.recorded_at || Date.now());
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

    // 4. Save normalized records
    await this.normalizedRepo.saveMany(normalizedRecords);

    // 5. Cluster & Deduplication Resolution across all operational records
    const allSources = await this.sourceRepo.findAll(source.organizationId);
    const sourceTypesMap = new Map<string, SourceType>();
    for (const s of allSources) {
      sourceTypesMap.set(s.id, s.type);
    }

    const clusters = new Map<string, NormalizedRecord[]>();
    for (const rec of normalizedRecords) {
      if (rec.disposition === Disposition.REJECTED) continue;
      const clusterKey = `${rec.batchId}::${rec.station}`;
      if (!clusters.has(clusterKey)) {
        clusters.set(clusterKey, []);
      }
      clusters.get(clusterKey)!.push(rec);
    }

    for (const [key, clusterRecs] of clusters.entries()) {
      const [batchId, stationStr] = key.split('::');
      const station = stationStr as StationCode;

      const existingCanonical = await this.canonicalRepo.findByBatchAndStation(
        batchId,
        station,
        source.organizationId,
      );

      const resolution = DeduplicationResolver.resolveCluster(clusterRecs, sourceTypesMap);
      const winner = resolution.winner;

      if (!existingCanonical) {
        const canonical = new CanonicalEvent(
          `canon-${batchId}-${station}`,
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
          resolution.duplicates.length,
          resolution.conflicts.length,
          winner.payload,
        );
        await this.canonicalRepo.save(canonical);
      } else {
        const existingWeight = DeduplicationResolver.getAuthorityWeight(
          station,
          sourceTypesMap.get(existingCanonical.winningSourceId) || SourceType.REST_API,
        );
        const newWeight = DeduplicationResolver.getAuthorityWeight(
          station,
          sourceTypesMap.get(winner.sourceId) || SourceType.REST_API,
        );

        if (newWeight >= existingWeight && winner.occurredAt >= existingCanonical.occurredAt) {
          existingCanonical.quantity = winner.quantity;
          existingCanonical.occurredAt = winner.occurredAt;
          existingCanonical.winningSourceId = winner.sourceId;
          existingCanonical.winningCollectionRunId = winner.collectionRunId;
          existingCanonical.winningNormalizedRecordId = winner.id;
          existingCanonical.winningSourceRecordId = winner.sourceRecordId;
          existingCanonical.qualityStatus = winner.qualityStatus;
          existingCanonical.duplicateObservationCount += resolution.duplicates.length;
          existingCanonical.conflictObservationCount += resolution.conflicts.length;
          existingCanonical.payload = winner.payload;
          existingCanonical.updatedAt = new Date();
          await this.canonicalRepo.save(existingCanonical);
        }
      }

      await this.normalizedRepo.saveMany([winner, ...resolution.duplicates, ...resolution.conflicts]);

      // Cache winning fingerprint in 128-bit memory store
      if (this.fingerprintCache) {
        const fpKey = `${winner.sourceId}::${winner.sourceRecordId}::${winner.sourceRevision}`;
        this.fingerprintCache.add(fpKey);
      }
    }

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
}
