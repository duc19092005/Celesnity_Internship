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
      { name: 'work-orders', path: '/work-orders', description: 'Work Orders & Line assignments', fields: ['workOrderId', 'customerName', 'targetQuantity', 'plannedStartDate', 'plannedEndDate', 'status'] },
      { name: 'batches', path: '/batches', description: 'Batch ID to Work Order mappings', fields: ['batchId', 'workOrderId', 'lineId'] },
      { name: 'dispatch-records', path: '/dispatch-records', description: 'Station 6 Dispatch records', fields: ['dispatchId', 'workOrderId', 'batchId', 'station', 'quantity', 'dispatchDate', 'destination', 'vehicleNumber'] },
      { name: 'receiving-records', path: '/receiving-records', description: 'Application receiving records', fields: ['receivingId', 'batchId', 'station', 'quantity', 'receivedAt'] },
    ];

    return {
      fields: Array.from(new Set(endpoints.flatMap((endpoint) => endpoint.fields)))
        .map((name) => ({ name, type: ['quantity', 'targetQuantity'].includes(name) ? 'number' : 'string' })),
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
    const allowedResources = new Set(['work-orders', 'batches', 'dispatch-records', 'receiving-records']);
    const selectedResources = Array.isArray(selectedSchema?.resources)
      ? selectedSchema.resources.map((resource: unknown) => String(resource).replace(/^\//, ''))
      : [];

    if (!baseUrl) {
      return { success: false, items, errors: [{ code: 'MISSING_BASE_URL', message: 'Base URL is required' }], durationMs: Date.now() - start };
    }
    if (selectedResources.length === 0) {
      return { success: false, items, errors: [{ code: 'MISSING_RESOURCE_SELECTION', message: 'Select at least one REST resource before collection' }], durationMs: Date.now() - start };
    }
    const invalidResources = selectedResources.filter((resource: string) => !allowedResources.has(resource));
    if (invalidResources.length > 0) {
      return { success: false, items, errors: [{ code: 'INVALID_RESOURCE_SELECTION', message: `Unsupported REST resources: ${invalidResources.join(', ')}` }], durationMs: Date.now() - start };
    }

    for (const resource of selectedResources) {
      const endpoint = `/${resource}`;
      let page = 1;
      let hasMore = true;

      while (hasMore && page <= 10) {
        try {
          const url = `${baseUrl}${endpoint}?page=${page}&pageSize=50`;
          const response = await this.executeWithRetry(() => axios.get(url, { timeout: config.timeoutMs || 5000 }));
          const data = response.data;
          const records: any[] = Array.isArray(data) ? data : (data.items || data.records || data.data || []);

          for (let idx = 0; idx < records.length; idx++) {
            const rec = records[idx];
            const stableId = rec.id || rec.sourceRecordId || rec.dispatchId || rec.receivingId || rec.workOrderId || rec.batchId || `${resource}-${page}-${idx + 1}`;
            items.push({
              sourceRecordId: String(stableId),
              sourceRevision: Number(rec.sourceRevision || 1),
              payload: { ...rec, resourceType: resource },
              observedAt: new Date(),
            });
          }

          if (data.nextPage || (data.total && data.page * data.pageSize < data.total)) {
            page++;
          } else {
            hasMore = false;
          }
        } catch (err: any) {
          errors.push({ code: 'REST_FETCH_ERROR', message: `Failed to fetch ${endpoint} (page ${page}): ${err.message}` });
          hasMore = false;
        }
      }
      if (hasMore) {
        errors.push({ code: 'REST_PAGE_LIMIT_REACHED', message: `${endpoint} exceeded the 10-page safety limit` });
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
