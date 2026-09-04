import { CheerioWebCrawlerAdapter } from '../../src/infrastructure/collectors/cheerio-web-crawler.adapter';
import axios from 'axios';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('CheerioWebCrawlerAdapter (Resilience Unit Tests)', () => {
  let adapter: CheerioWebCrawlerAdapter;

  beforeEach(() => {
    adapter = new CheerioWebCrawlerAdapter();
    jest.clearAllMocks();
  });

  it('1. should prevent pagination loops and terminate safely', async () => {
    // Mocking a pagination loop: Page 1 links to Page 2, and Page 2 links back to Page 1
    const page1Html = `
      <html>
        <body>
          <table>
            <tbody>
              <tr data-source-record-id="REC-1">
                <td>DELIV-1</td><td>Hotel A</td><td>BATCH-001</td><td>100</td><td>2026-09-01T08:00:00Z</td>
              </tr>
            </tbody>
          </table>
          <a href="http://mock-supplier.local/deliveries?page=2" class="next-page">Next</a>
        </body>
      </html>
    `;

    const page2Html = `
      <html>
        <body>
          <table>
            <tbody>
              <tr data-source-record-id="REC-2">
                <td>DELIV-2</td><td>Hotel B</td><td>BATCH-002</td><td>80</td><td>2026-09-01T08:15:00Z</td>
              </tr>
            </tbody>
          </table>
          <a href="http://mock-supplier.local/deliveries?page=1" class="next-page">Next (Loops back)</a>
        </body>
      </html>
    `;

    mockedAxios.get.mockImplementation(async (url: string) => {
      if (url.includes('page=2')) {
        return { status: 200, data: page2Html } as any;
      }
      return { status: 200, data: page1Html } as any;
    });

    const result = await adapter.collect({
      url: 'http://mock-supplier.local/deliveries?page=1',
      maxPages: 10,
    }, {
      headers: ['Delivery Number', 'Supplier', 'Batch ID', 'Quantity', 'Delivery Time'],
    });

    // Should stop gracefully after detecting the loop
    expect(result.items.length).toBe(2);
    expect(result.errors.some((e) => e.code === 'PAGINATION_LOOP_DETECTED')).toBe(true);
  });

  it('2. should isolate malformed rows without failing the entire run', async () => {
    const pageHtml = `
      <html>
        <body>
          <table>
            <tbody>
              <tr data-source-record-id="REC-VALID-1">
                <td>DELIV-1</td><td>Hotel A</td><td>BATCH-001</td><td>100</td><td>2026-09-01T08:00:00Z</td>
              </tr>
              <!-- Malformed row with text in quantity -->
              <tr data-source-record-id="REC-ERR">
                <td>DELIV-ERR</td><td>Hotel Err</td><td>BATCH-ERR</td><td>NOT_A_NUMBER</td><td>2026-09-01T08:10:00Z</td>
              </tr>
              <tr data-source-record-id="REC-VALID-2">
                <td>DELIV-2</td><td>Hotel B</td><td>BATCH-002</td><td>80</td><td>2026-09-01T08:15:00Z</td>
              </tr>
            </tbody>
          </table>
        </body>
      </html>
    `;

    mockedAxios.get.mockResolvedValueOnce({ status: 200, data: pageHtml } as any);

    const result = await adapter.collect({
      url: 'http://mock-supplier.local/deliveries',
      maxPages: 1,
    }, {
      headers: ['Delivery Number', 'Supplier', 'Batch ID', 'Quantity', 'Delivery Time'],
    });

    // Valid items are collected successfully (2 items)
    expect(result.items.length).toBe(2);
    expect(result.items[0].payload.batchId).toBe('BATCH-001');
    expect(result.items[1].payload.batchId).toBe('BATCH-002');

    // Error is reported for the malformed row
    expect(result.errors.length).toBe(1);
    expect(result.errors[0].code).toBe('MALFORMED_QUANTITY_ROW');
    expect(result.errors[0].rowNumber).toBe(2);
  });
});
