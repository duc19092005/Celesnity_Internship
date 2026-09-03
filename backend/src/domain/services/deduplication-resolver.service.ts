import { Disposition, SourceType } from '../enums/common.enums';
import { StationCode } from '../enums/station-code.enum';
import { NormalizedRecord } from '../entities/normalized-record.entity';

export interface ResolutionResult {
  winner: NormalizedRecord;
  duplicates: NormalizedRecord[];
  conflicts: NormalizedRecord[];
}

export class DeduplicationResolver {
  /**
   * Authority weight according to station
   * RECEIVING: Crawler (3) > API (2) > DB (1)
   * SORTING - FOLDING: DB (3) > API (2) > MQTT (1)
   * DISPATCH: API (3) > DB (2)
   */
  public static getAuthorityWeight(station: StationCode, sourceType: SourceType): number {
    switch (station) {
      case StationCode.RECEIVING:
        if (sourceType === SourceType.WEB_CRAWLER) return 100;
        if (sourceType === SourceType.REST_API) return 80;
        return 50;
      case StationCode.SORTING:
      case StationCode.WASHING:
      case StationCode.DRYING:
      case StationCode.FOLDING:
        if (sourceType === SourceType.POSTGRESQL) return 100;
        if (sourceType === SourceType.MQTT) return 60;
        if (sourceType === SourceType.REST_API) return 40;
        return 20;
      case StationCode.DISPATCH:
        if (sourceType === SourceType.REST_API) return 100;
        if (sourceType === SourceType.POSTGRESQL) return 80;
        return 40;
      default:
        return 50;
    }
  }

  /**
   * Resolve duplicate and conflict records deterministically
   */
  public static resolveCluster(
    records: NormalizedRecord[],
    sourceTypesMap: Map<string, SourceType>,
  ): ResolutionResult {
    if (records.length === 0) {
      throw new Error('Cannot resolve an empty record cluster');
    }

    if (records.length === 1) {
      records[0].disposition = Disposition.ACCEPTED;
      return {
        winner: records[0],
        duplicates: [],
        conflicts: [],
      };
    }

    // Sort candidates according to deterministic criteria:
    // 1. Higher Source Authority
    // 2. Higher Source Revision
    // 3. More Recent OccurredAt
    // 4. Lexical sort of Record ID as stable tie-breaker
    const sorted = [...records].sort((a, b) => {
      const aType = sourceTypesMap.get(a.sourceId) ?? SourceType.REST_API;
      const bType = sourceTypesMap.get(b.sourceId) ?? SourceType.REST_API;
      const aWeight = this.getAuthorityWeight(a.station, aType);
      const bWeight = this.getAuthorityWeight(b.station, bType);

      if (aWeight !== bWeight) {
        return bWeight - aWeight;
      }

      if (a.sourceRevision !== b.sourceRevision) {
        return b.sourceRevision - a.sourceRevision;
      }

      const aTime = new Date(a.occurredAt).getTime();
      const bTime = new Date(b.occurredAt).getTime();
      if (aTime !== bTime) {
        return bTime - aTime;
      }

      return a.id.localeCompare(b.id);
    });

    const winner = sorted[0];
    winner.disposition = Disposition.ACCEPTED;

    const duplicates: NormalizedRecord[] = [];
    const conflicts: NormalizedRecord[] = [];

    for (let i = 1; i < sorted.length; i++) {
      const candidate = sorted[i];
      // Compare payloads & quantities
      const isIdentical =
        candidate.quantity === winner.quantity &&
        candidate.qualityStatus === winner.qualityStatus &&
        JSON.stringify(candidate.payload) === JSON.stringify(winner.payload);

      if (isIdentical) {
        candidate.disposition = Disposition.DUPLICATE;
        candidate.dispositionReason = `Identical observation to winning record ${winner.id}`;
        duplicates.push(candidate);
      } else {
        candidate.disposition = Disposition.CONFLICT;
        candidate.dispositionReason = `Conflicting observation with winning record ${winner.id} (Winner authority/revision took precedence)`;
        conflicts.push(candidate);
      }
    }

    return {
      winner,
      duplicates,
      conflicts,
    };
  }
}
