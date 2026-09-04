import axios from 'axios';
import * as cheerio from 'cheerio';
import { SourceConfig } from '../../domain/entities/source.entity';
import { SourceType } from '../../domain/enums/common.enums';
import { CollectorExecutionResult, DiscoveredSchemaResult, ICollectorAdapter, RawCollectedItem } from '../../application/ports';

export class CheerioWebCrawlerAdapter implements ICollectorAdapter {
  public supports(type: SourceType): boolean {
    return type === SourceType.WEB_CRAWLER;
  }

  public async testConnection(config: SourceConfig): Promise<{ connected: boolean; latencyMs: number; message: string }> {
    const start = Date.now();
    const targetUrl = config.url || config.baseUrl;
    if (!targetUrl) {
      return { connected: false, latencyMs: 0, message: 'URL is required for web crawler source' };
    }

    try {
      const response = await axios.get(targetUrl, { timeout: config.timeoutMs || 5000 });
      const latencyMs = Date.now() - start;
      if (response.status >= 200 && response.status < 400) {
        return { connected: true, latencyMs, message: `Successfully reached HTML supplier portal (Status ${response.status})` };
      }
      return { connected: false, latencyMs, message: `Received non-success HTTP status ${response.status}` };
    } catch (err: any) {
      return { connected: false, latencyMs: Date.now() - start, message: `Failed to connect: ${err.message}` };
    }
  }

  public async discoverSchema(config: SourceConfig): Promise<DiscoveredSchemaResult> {
    const targetUrl = config.url || config.baseUrl;
    if (!targetUrl) {
      throw new Error('URL is required for schema discovery');
    }

    const response = await axios.get(targetUrl, { timeout: config.timeoutMs || 5000 });
    const $ = cheerio.load(response.data);
    const headers: string[] = [];

    $('table thead tr th, table tr th').each((_, el) => {
      const text = $(el).text().trim();
      if (text) headers.push(text);
    });

    return {
      headers: headers.length > 0 ? headers : ['Delivery Number', 'Supplier', 'Batch ID', 'Quantity', 'Delivery Time'],
      metadata: {
        title: $('title').text().trim() || 'Supplier Delivery Portal',
        rowCount: $('table tbody tr').length,
      },
    };
  }

  public async collect(config: SourceConfig, selectedSchema?: any): Promise<CollectorExecutionResult> {
    const start = Date.now();
    let currentUrl: string | null = config.url || config.baseUrl || null;
    const maxPages = config.maxPages || 10;
    const timeoutMs = config.timeoutMs || 5000;
    const selectedHeaders = Array.isArray(selectedSchema?.headers) ? selectedSchema.headers.map(String) : [];
    const requiredHeaders = ['Delivery Number', 'Supplier', 'Batch ID', 'Quantity', 'Delivery Time'];

    const visitedUrls = new Set<string>();
    const items: RawCollectedItem[] = [];
    const errors: Array<{ code: string; message: string; rowNumber?: number; rawExcerpt?: string }> = [];

    if (selectedHeaders.length === 0) {
      return { success: false, items, errors: [{ code: 'MISSING_HEADER_SELECTION', message: 'Select crawler fields before collection' }], durationMs: Date.now() - start };
    }
    const missingRequired = requiredHeaders.filter((header) => !selectedHeaders.includes(header));
    if (missingRequired.length > 0) {
      return { success: false, items, errors: [{ code: 'INVALID_HEADER_SELECTION', message: `Crawler selection must include: ${missingRequired.join(', ')}` }], durationMs: Date.now() - start };
    }

    let pageCount = 0;

    while (currentUrl && pageCount < maxPages) {
      // 1. Pagination Loop Prevention
      const normalizedUrl = this.normalizeUrl(currentUrl);
      if (visitedUrls.has(normalizedUrl)) {
        errors.push({ code: 'PAGINATION_LOOP_DETECTED', message: `Crawler stopped pagination loop at visited URL: ${currentUrl}` });
        break;
      }

      visitedUrls.add(normalizedUrl);
      pageCount++;

      try {
        const response = await axios.get(currentUrl, { timeout: timeoutMs });
        const $ = cheerio.load(response.data);

        $('table tbody tr, table tr:has(td)').each((rowIdx, el) => {
          const rowEl = $(el);
          const cols = rowEl.find('td');
          if (cols.length === 0) return;

          const stableRecordId = rowEl.attr('data-source-record-id') || rowEl.find('[data-source-record-id]').attr('data-source-record-id') || cols.eq(0).text().trim();
          const deliveryNumber = cols.eq(0).text().trim();
          const supplier = cols.eq(1).text().trim();
          const batchId = cols.eq(2).text().trim();
          const quantityText = cols.eq(3).text().trim();
          const deliveryTimeText = cols.eq(4).text().trim();
          const quantity = parseInt(quantityText, 10);

          if (isNaN(quantity) || quantity < 0) {
            errors.push({ code: 'MALFORMED_QUANTITY_ROW', message: `Page ${pageCount} Row #${rowIdx + 1} has invalid quantity: '${quantityText}'`, rowNumber: rowIdx + 1, rawExcerpt: rowEl.html()?.substring(0, 200) || '' });
            return;
          }
          if (!batchId) {
            errors.push({ code: 'MALFORMED_EMPTY_BATCH_ROW', message: `Page ${pageCount} Row #${rowIdx + 1} is missing required batch identifier`, rowNumber: rowIdx + 1, rawExcerpt: rowEl.html()?.substring(0, 200) || '' });
            return;
          }

          const fieldsByHeader: Record<string, any> = {
            'Delivery Number': deliveryNumber,
            Supplier: supplier,
            'Batch ID': batchId,
            Quantity: quantity,
            'Delivery Time': deliveryTimeText || new Date().toISOString(),
          };
          const payload: Record<string, any> = { station: 'RECEIVING' };
          const fieldNames: Record<string, string> = {
            'Delivery Number': 'deliveryNumber', Supplier: 'supplier', 'Batch ID': 'batchId', Quantity: 'quantity', 'Delivery Time': 'deliveryTime',
          };
          for (const header of selectedHeaders) {
            if (header in fieldsByHeader) payload[fieldNames[header]] = fieldsByHeader[header];
          }

          items.push({ sourceRecordId: stableRecordId || `SUPPLIER-DELIV-${deliveryNumber}-${batchId}`, sourceRevision: 1, payload, observedAt: new Date() });
        });

        const nextHref = $('a[rel="next"], a.next-page, a:contains("Next"), a:contains("Trang sau")').attr('href');
        currentUrl = nextHref ? this.resolveUrl(currentUrl, nextHref) : null;
      } catch (err: any) {
        errors.push({ code: 'CRAWLER_FETCH_ERROR', message: `Failed to fetch page ${pageCount} at ${currentUrl}: ${err.message}` });
        break;
      }
    }

    if (currentUrl && pageCount >= maxPages) {
      errors.push({ code: 'CRAWLER_PAGE_LIMIT_REACHED', message: `Crawler reached configured maximum of ${maxPages} pages` });
    }

    return { success: errors.length === 0, items, errors, durationMs: Date.now() - start };
  }

  private normalizeUrl(url: string): string {
    try {
      const u = new URL(url);
      return `${u.origin}${u.pathname}${u.search}`;
    } catch {
      return url.toLowerCase().trim();
    }
  }

  private resolveUrl(base: string, href: string): string {
    try {
      return new URL(href, base).toString();
    } catch {
      return href;
    }
  }
}
