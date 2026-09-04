import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SourceOrmEntity } from '../entities/source.orm-entity';
import { SystemSettingsOrmEntity } from '../entities/all.orm-entities';
import { SourceStatus, SourceType } from '../../../domain/enums/common.enums';
import { Aes256EncryptionService } from '../../crypto/aes256-encryption.service';

@Injectable()
export class DatabaseSeederService implements OnApplicationBootstrap {
  constructor(
    @InjectRepository(SourceOrmEntity)
    private readonly sourceRepo: Repository<SourceOrmEntity>,
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

    // Work orders and batches are intentionally not seeded here. The Application REST
    // source owns these mappings, so the production board remains empty until that
    // source is collected and metadata is materialized by the ingestion pipeline.

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
          encryptedSecret: process.env.PRODUCTION_DB_PASSWORD
            ? encryption.encrypt(process.env.PRODUCTION_DB_PASSWORD)
            : null,
          selectedSchema: {
            selectedTable: 'production_events',
          },
          status: process.env.PRODUCTION_DB_PASSWORD ? SourceStatus.VERIFIED : SourceStatus.UNVERIFIED,
          autoSync: false,
          syncIntervalSeconds: 30,
          lastVerifiedAt: process.env.PRODUCTION_DB_PASSWORD ? new Date() : null,
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
            resources: ['work-orders', 'batches', 'dispatch-records', 'receiving-records'],
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
