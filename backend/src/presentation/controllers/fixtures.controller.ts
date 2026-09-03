import { Body, Controller, Get, Header, HttpException, HttpStatus, Post, Query } from '@nestjs/common';

@Controller('fixtures')
export class FixturesController {
  private requestCounts = new Map<string, number>();

  /**
   * 1. HTML Supplier Portal Fixture (Station 1 RECEIVING)
   * Serves paginated HTML containing delivery records, stable IDs, pagination link, and malformed row
   */
  @Get('supplier/deliveries')
  @Header('Content-Type', 'text/html; charset=utf-8')
  getSupplierDeliveries(
    @Query('page') pageStr?: string,
    @Query('paginationMode') paginationMode?: string,
  ): string {
    const page = parseInt(pageStr || '1', 10);
    const isLoopMode = paginationMode === 'loop';

    let nextLinkHtml = '';
    if (isLoopMode) {
      // Loop mode: page 2 loops back to page 1 to test loop prevention
      const nextPage = page === 1 ? 2 : 1;
      nextLinkHtml = `<a href="/fixtures/supplier/deliveries?page=${nextPage}&paginationMode=loop" class="next-page">Next Page</a>`;
    } else if (page < 3) {
      nextLinkHtml = `<a href="/fixtures/supplier/deliveries?page=${page + 1}" class="next-page">Next Page</a>`;
    }

    let rowsHtml = '';

    if (page === 1) {
      rowsHtml = `
        <tr data-source-record-id="SUPP-DELIV-101">
          <td>DELIV-101</td>
          <td>InterContinental Hanoi</td>
          <td>BATCH-001</td>
          <td>120</td>
          <td>2026-09-01T08:00:00Z</td>
        </tr>
        <tr data-source-record-id="SUPP-DELIV-102">
          <td>DELIV-102</td>
          <td>InterContinental Hanoi</td>
          <td>BATCH-002</td>
          <td>80</td>
          <td>2026-09-01T08:15:00Z</td>
        </tr>
        <!-- Malformed row sample to test resilience without failing run -->
        <tr data-source-record-id="SUPP-DELIV-MALFORMED">
          <td>DELIV-ERR</td>
          <td>Unknown Hotel</td>
          <td>BATCH-MALFORMED</td>
          <td>INVALID_QTY</td>
          <td>2026-09-01T08:20:00Z</td>
        </tr>
      `;
    } else if (page === 2) {
      rowsHtml = `
        <tr data-source-record-id="SUPP-DELIV-103">
          <td>DELIV-103</td>
          <td>JW Marriott Hanoi</td>
          <td>BATCH-003</td>
          <td>200</td>
          <td>2026-09-01T08:30:00Z</td>
        </tr>
        <tr data-source-record-id="SUPP-DELIV-104">
          <td>DELIV-104</td>
          <td>JW Marriott Hanoi</td>
          <td>BATCH-004</td>
          <td>150</td>
          <td>2026-09-01T08:45:00Z</td>
        </tr>
      `;
    } else if (page === 3) {
      rowsHtml = `
        <tr data-source-record-id="SUPP-DELIV-105">
          <td>DELIV-105</td>
          <td>JW Marriott Hanoi</td>
          <td>BATCH-005</td>
          <td>150</td>
          <td>2026-09-01T09:00:00Z</td>
        </tr>
        <tr data-source-record-id="SUPP-DELIV-106">
          <td>DELIV-106</td>
          <td>Lotte Hotel Hanoi</td>
          <td>BATCH-006</td>
          <td>90</td>
          <td>2026-09-01T09:15:00Z</td>
        </tr>
      `;
    }

    return `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Supplier Linen Deliveries Portal</title>
          <style>
            body { font-family: sans-serif; padding: 24px; }
            table { width: 100%; border-collapse: collapse; margin-top: 16px; }
            th, td { border: 1px solid #ddd; padding: 8px 12px; text-align: left; }
            th { background-color: #f4f4f4; }
            .pagination { margin-top: 20px; }
          </style>
        </head>
        <body>
          <h2>Supplier Deliveries Portal - Page ${page}</h2>
          <table>
            <thead>
              <tr>
                <th>Delivery Number</th>
                <th>Supplier</th>
                <th>Batch ID</th>
                <th>Quantity</th>
                <th>Delivery Time</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
            </tbody>
          </table>
          <div class="pagination">
            ${nextLinkHtml}
          </div>
        </body>
      </html>
    `;
  }

  /**
   * 2. Application REST API Fixtures
   */
  @Get('application-api/work-orders')
  getWorkOrders() {
    return {
      items: [
        { workOrderId: 'WO-1001', customerName: 'InterContinental Hotel', targetQuantity: 200, status: 'IN_PROGRESS' },
        { workOrderId: 'WO-1002', customerName: 'JW Marriott Hotel', targetQuantity: 350, status: 'IN_PROGRESS' },
        { workOrderId: 'WO-1003', customerName: 'Lotte Hotel Hanoi', targetQuantity: 150, status: 'PLANNED' },
      ],
      total: 3,
      page: 1,
      pageSize: 50,
    };
  }

  @Get('application-api/batches')
  getBatches() {
    return {
      items: [
        { batchId: 'BATCH-001', workOrderId: 'WO-1001', lineId: 'LINE-A' },
        { batchId: 'BATCH-002', workOrderId: 'WO-1001', lineId: 'LINE-A' },
        { batchId: 'BATCH-003', workOrderId: 'WO-1002', lineId: 'LINE-B' },
        { batchId: 'BATCH-004', workOrderId: 'WO-1002', lineId: 'LINE-B' },
        { batchId: 'BATCH-005', workOrderId: 'WO-1002', lineId: 'LINE-B' },
        { batchId: 'BATCH-006', workOrderId: 'WO-1003', lineId: 'LINE-C' },
      ],
      total: 6,
      page: 1,
      pageSize: 50,
    };
  }

  @Get('application-api/receiving-records')
  getReceivingRecords() {
    return {
      items: [
        { receivingId: 'API-REC-001', batchId: 'BATCH-001', quantity: 120, receivedAt: '2026-09-01T08:00:00Z', station: 'RECEIVING' },
        { receivingId: 'API-REC-002', batchId: 'BATCH-002', quantity: 80, receivedAt: '2026-09-01T08:15:00Z', station: 'RECEIVING' },
      ],
      total: 2,
      page: 1,
      pageSize: 50,
    };
  }

  /**
   * Station 6: DISPATCH records fixture
   * Supports transient failure simulation via `failureMode=transient`
   */
  @Get('application-api/dispatch-records')
  getDispatchRecords(
    @Query('page') pageStr?: string,
    @Query('failureMode') failureMode?: string,
  ) {
    if (failureMode === 'transient') {
      const count = (this.requestCounts.get('dispatch-transient') || 0) + 1;
      this.requestCounts.set('dispatch-transient', count);

      if (count <= 2) {
        throw new HttpException('Transient Service Unavailable (Simulation)', HttpStatus.SERVICE_UNAVAILABLE);
      }
    }

    const page = parseInt(pageStr || '1', 10);
    return {
      items: [
        // BATCH-001 is DISPATCHED (Completed step 6)
        {
          dispatchId: 'DISP-1001',
          workOrderId: 'WO-1001',
          batchId: 'BATCH-001',
          station: 'DISPATCH',
          quantity: 120,
          destination: 'InterContinental West Lake Delivery Gate 1',
          dispatchDate: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
          vehicleNumber: '29C-889.99',
        },
      ],
      total: 1,
      page,
      pageSize: 50,
    };
  }
}
