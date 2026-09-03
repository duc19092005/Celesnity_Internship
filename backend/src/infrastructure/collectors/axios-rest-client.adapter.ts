import axios, { AxiosError } from 'axios';
import { SourceConfig } from '../../domain/entities/source.entity';
import { SourceType } from '../../domain/enums/common.enums';
import { CollectorExecutionResult, DiscoveredSchemaResult, ICollectorAdapter, RawCollectedItem } from '../../application/ports';

export class AxiosRestClientAdapter implements ICollectorAdapter {
  public supports(type: SourceType): boolean {
    return type === SourceType.REST_API;
  }

  public async testConnection(config: SourceConfig): Promise<{ connected: boolean; latencyMs: number; message: string }> {
    const start = Date.now();
    const baseUrl = config.baseUrl || config.url;
    if (!baseUrl) {
      return { connected: false, latencyMs: 0, message: 'Base URL is required for REST API source' };
    }

    try {
      const response = await this.executeWithRetry(async () => {
        return axios.get(`${baseUrl.replace(/\/$/, '')}/work-orders`, {
          timeout: config.timeoutMs || 5000,
        });
      });
      const latencyMs = Date.now() - start;
      return {
        connected: true,
        latencyMs,
        message: `Successfully connected to Application REST API (Status ${response.status})`,
      };
    } catch (err: any) {
      return {
        connected: false,
        latencyMs: Date.now() - start,
        message: `REST API connection failed: ${err.message}`,
      };
    }
  }

  public async discoverSchema(config: SourceConfig): Promise<DiscoveredSchemaResult> {
    const baseUrl = config.baseUrl || config.url;
    if (!baseUrl) {
      throw new Error('Base URL is required');
    }

    const endpoints = [
      { name: 'work-orders', path: '/work-orders', description: 'Work Orders & Line assignments' },
      { name: 'batches', path: '/batches', description: 'Batch ID to Work Order mappings' },
      { name: 'dispatch-records', path: '/dispatch-records', description: 'Station 6 Dispatch records' },
      { name: 'receiving-records', path: '/receiving-records', description: 'Receiving records' },
    ];

    const fields: Array<{ name: string; type: string; example?: any }> = [
      { name: 'workOrderId', type: 'string', example: 'WO-1001' },
      { name: 'batchId', type: 'string', example: 'BATCH-001' },
      { name: 'lineId', type: 'string', example: 'LINE-A' },
      { name: 'station', type: 'string', example: 'DISPATCH' },
      { name: 'quantity', type: 'number', example: 120 },
      { name: 'dispatchDate', type: 'string', example: '2026-09-01T10:00:00Z' },
    ];

    return {
      fields,
      metadata: {
        endpoints,
        supportedMethods: ['GET'],
      },
    };
  }

  public async collect(config: SourceConfig, selectedSchema?: any): Promise<CollectorExecutionResult> {
    const start = Date.now();
    const baseUrl = (config.baseUrl || config.url || '').replace(/\/$/, '');
    const items: RawCollectedItem[] = [];
    const errors: Array<{ code: string; message: string; rowNumber?: number; rawExcerpt?: string }> = [];

    // Resources to fetch: batches, dispatch-records, receiving-records
    const resourceEndpoints = ['/batches', '/dispatch-records', '/receiving-records'];

    for (const endpoint of resourceEndpoints) {
      let page = 1;
      let hasMore = true;

      while (hasMore && page <= 10) {
        try {
          const url = `${baseUrl}${endpoint}?page=${page}&pageSize=50`;
          const response = await this.executeWithRetry(async () => {
            return axios.get(url, { timeout: config.timeoutMs || 5000 });
          });

          const data = response.data;
          const records: any[] = Array.isArray(data) ? data : (data.items || data.records || data.data || []);

          for (let idx = 0; idx < records.length; idx++) {
            const rec = records[idx];
            const stableId = rec.id || rec.sourceRecordId || rec.dispatchId || rec.receivingId || `${endpoint.replace('/', '')}-${rec.batchId || idx + 1}`;

            items.push({
              sourceRecordId: String(stableId),
              sourceRevision: 1,
              payload: {
                ...rec,
                resourceType: endpoint.replace('/', ''),
              },
              observedAt: new Date(),
            });
          }

          if (data.nextPage || (data.total && data.page * data.pageSize < data.total)) {
            page++;
          } else {
            hasMore = false;
          }
        } catch (err: any) {
          errors.push({
            code: 'REST_FETCH_ERROR',
            message: `Failed to fetch ${endpoint} (page ${page}): ${err.message}`,
          });
          hasMore = false;
        }
      }
    }

    return {
      success: errors.length === 0,
      items,
      errors,
      durationMs: Date.now() - start,
    };
  }

  /**
   * Exponential backoff retry for transient network / 5xx failures
   */
  private async executeWithRetry<T>(fn: () => Promise<T>, maxRetries = 3): Promise<T> {
    let attempt = 0;
    while (attempt < maxRetries) {
      try {
        return await fn();
      } catch (err: any) {
        attempt++;
        const isTransient =
          !err.response ||
          err.code === 'ECONNREFUSED' ||
          err.code === 'ETIMEDOUT' ||
          [408, 429, 500, 502, 503, 504].includes(err.response?.status);

        if (!isTransient || attempt >= maxRetries) {
          throw err;
        }

        // Wait with exponential backoff: 200ms, 400ms, 800ms
        const delayMs = Math.pow(2, attempt) * 100;
        await new Promise((res) => setTimeout(res, delayMs));
      }
    }
    throw new Error('Retry limit reached');
  }
}
