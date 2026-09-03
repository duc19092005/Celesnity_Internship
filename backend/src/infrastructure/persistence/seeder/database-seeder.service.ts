import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SourceOrmEntity } from '../entities/source.orm-entity';
import { BatchOrmEntity, SystemSettingsOrmEntity, WorkOrderOrmEntity } from '../entities/all.orm-entities';
import { SourceStatus, SourceType } from '../../../domain/enums/common.enums';
import { Aes256EncryptionService } from '../../crypto/aes256-encryption.service';

@Injectable()
export class DatabaseSeederService implements OnApplicationBootstrap {
  constructor(
    @InjectRepository(SourceOrmEntity)
    private readonly sourceRepo: Repository<SourceOrmEntity>,
    @InjectRepository(WorkOrderOrmEntity)
    private readonly workOrderRepo: Repository<WorkOrderOrmEntity>,
    @InjectRepository(BatchOrmEntity)
    private readonly batchRepo: Repository<BatchOrmEntity>,
    @InjectRepository(SystemSettingsOrmEntity)
    private readonly settingsRepo: Repository<SystemSettingsOrmEntity>,
  ) {}

  async onApplicationBootstrap() {
    await this.seed();
  }

  public async seed() {
    const orgId = process.env.DEFAULT_ORGANIZATION_ID || 'org-celesnity-laundry';
    const port = process.env.PORT || 4000;
    const encryption = new Aes256EncryptionService();

    // 1. Seed System Settings
    const existingSettings = await this.settingsRepo.findOne({ where: { organizationId: orgId } });
    if (!existingSettings) {
      await this.settingsRepo.save({
        organizationId: orgId,
        staleThresholdMinutes: 15,
        updatedAt: new Date(),
      });
    }

    // 2. Seed Work Orders
    const existingWo = await this.workOrderRepo.count();
    if (existingWo === 0) {
      await this.workOrderRepo.save([
        {
          workOrderId: 'WO-1001',
          organizationId: orgId,
          customerName: 'InterContinental Hotel Landmark 72',
          targetQuantity: 200,
          plannedStartDate: new Date(Date.now() - 2 * 3600 * 1000),
          plannedEndDate: new Date(Date.now() + 6 * 3600 * 1000),
          status: 'IN_PROGRESS',
        },
        {
          workOrderId: 'WO-1002',
          organizationId: orgId,
          customerName: 'JW Marriott Hotel Hanoi',
          targetQuantity: 350,
          plannedStartDate: new Date(Date.now() - 3 * 3600 * 1000),
          plannedEndDate: new Date(Date.now() + 5 * 3600 * 1000),
          status: 'IN_PROGRESS',
        },
        {
          workOrderId: 'WO-1003',
          organizationId: orgId,
          customerName: 'Lotte Hotel Hanoi',
          targetQuantity: 150,
          plannedStartDate: new Date(Date.now() - 1 * 3600 * 1000),
          plannedEndDate: new Date(Date.now() + 8 * 3600 * 1000),
          status: 'PLANNED',
        },
      ]);
    }

    // 3. Seed Batches mapped to Work Orders & Lines
    const existingBatches = await this.batchRepo.count();
    if (existingBatches === 0) {
      await this.batchRepo.save([
        {
          batchId: 'BATCH-001',
          organizationId: orgId,
          workOrderId: 'WO-1001',
          lineId: 'LINE-A',
          currentStation: null,
          completedQuantity: 0,
          status: 'PLANNED',
          indicators: { isStale: false, isBlocked: false, hasMissingData: false, hasQualityWarning: false },
          acknowledgedExceptions: [],
        },
        {
          batchId: 'BATCH-002',
          organizationId: orgId,
          workOrderId: 'WO-1001',
          lineId: 'LINE-A',
          currentStation: null,
          completedQuantity: 0,
          status: 'PLANNED',
          indicators: { isStale: false, isBlocked: false, hasMissingData: false, hasQualityWarning: false },
          acknowledgedExceptions: [],
        },
        {
          batchId: 'BATCH-003',
          organizationId: orgId,
          workOrderId: 'WO-1002',
          lineId: 'LINE-B',
          currentStation: null,
          completedQuantity: 0,
          status: 'PLANNED',
          indicators: { isStale: false, isBlocked: false, hasMissingData: false, hasQualityWarning: false },
          acknowledgedExceptions: [],
        },
        {
          batchId: 'BATCH-004',
          organizationId: orgId,
          workOrderId: 'WO-1002',
          lineId: 'LINE-B',
          currentStation: null,
          completedQuantity: 0,
          status: 'PLANNED',
          indicators: { isStale: false, isBlocked: false, hasMissingData: false, hasQualityWarning: false },
          acknowledgedExceptions: [],
        },
        {
          batchId: 'BATCH-005',
          organizationId: orgId,
          workOrderId: 'WO-1002',
          lineId: 'LINE-B',
          currentStation: null,
          completedQuantity: 0,
          status: 'PLANNED',
          indicators: { isStale: false, isBlocked: false, hasMissingData: false, hasQualityWarning: false },
          acknowledgedExceptions: [],
        },
        {
          batchId: 'BATCH-006',
          organizationId: orgId,
          workOrderId: 'WO-1003',
          lineId: 'LINE-C',
          currentStation: null,
          completedQuantity: 0,
          status: 'PLANNED',
          indicators: { isStale: false, isBlocked: false, hasMissingData: false, hasQualityWarning: false },
          acknowledgedExceptions: [],
        },
      ]);
    }

    // 4. Seed Default Local Sources
    const existingSources = await this.sourceRepo.count();
    if (existingSources === 0) {
      await this.sourceRepo.save([
        {
          id: 'src-crawler-supplier',
          organizationId: orgId,
          name: 'Supplier Portal Web Crawler (Station 1)',
          type: SourceType.WEB_CRAWLER,
          config: {
            url: `http://localhost:${port}/fixtures/supplier/deliveries`,
            maxPages: 5,
            timeoutMs: 5000,
          },
          encryptedSecret: null,
          selectedSchema: {
            headers: ['Delivery Number', 'Supplier', 'Batch ID', 'Quantity', 'Delivery Time'],
          },
          status: SourceStatus.VERIFIED,
          autoSync: false,
          syncIntervalSeconds: 30,
          lastVerifiedAt: new Date(),
          lastRunAt: null,
        },
        {
          id: 'src-postgres-factory',
          organizationId: orgId,
          name: 'Factory PostgreSQL Production DB (Stations 2-5)',
          type: SourceType.POSTGRESQL,
          config: {
            host: process.env.PRODUCTION_DB_HOST || 'production-db',
            port: Number(process.env.PRODUCTION_DB_PORT || 5432),
            database: process.env.PRODUCTION_DB_NAME || 'production_db',
            username: process.env.PRODUCTION_DB_USER || 'postgres',
            timeoutMs: 5000,
          },
          encryptedSecret: encryption.encrypt(process.env.PRODUCTION_DB_PASSWORD || 'postgres'),
          selectedSchema: {
            selectedTable: 'production_events',
          },
          status: SourceStatus.VERIFIED,
          autoSync: false,
          syncIntervalSeconds: 30,
          lastVerifiedAt: new Date(),
          lastRunAt: null,
        },
        {
          id: 'src-rest-api',
          organizationId: orgId,
          name: 'Application Core REST API (Station 6 & Work Orders)',
          type: SourceType.REST_API,
          config: {
            baseUrl: `http://localhost:${port}/fixtures/application-api`,
            timeoutMs: 5000,
          },
          encryptedSecret: null,
          selectedSchema: {
            resources: ['batches', 'dispatch-records', 'receiving-records'],
          },
          status: SourceStatus.VERIFIED,
          autoSync: false,
          syncIntervalSeconds: 30,
          lastVerifiedAt: new Date(),
          lastRunAt: null,
        },
      ]);
    }
  }
}
