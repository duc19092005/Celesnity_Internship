import { Module } from '@nestjs/common';
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';

// Entities
import { SourceOrmEntity } from './infrastructure/persistence/entities/source.orm-entity';
import {
  BatchOrmEntity,
  CanonicalEventOrmEntity,
  CollectionRunOrmEntity,
  ManagementEventOrmEntity,
  NormalizedRecordOrmEntity,
  SourceObservationOrmEntity,
  SystemSettingsOrmEntity,
  WorkOrderOrmEntity,
} from './infrastructure/persistence/entities/all.orm-entities';

// Repositories
import {
  TypeOrmBatchRepository,
  TypeOrmCanonicalEventRepository,
  TypeOrmCollectionRunRepository,
  TypeOrmManagementEventRepository,
  TypeOrmNormalizedRecordRepository,
  TypeOrmSourceObservationRepository,
  TypeOrmSourceRepository,
  TypeOrmSystemSettingsRepository,
  TypeOrmWorkOrderRepository,
} from './infrastructure/persistence/repositories/typeorm-repositories';
import { REPOSITORY_TOKENS } from './domain/repositories';

// Infrastructure Services & Adapters
import { Aes256EncryptionService } from './infrastructure/crypto/aes256-encryption.service';
import { CheerioWebCrawlerAdapter } from './infrastructure/collectors/cheerio-web-crawler.adapter';
import { PostgresDbCollectorAdapter } from './infrastructure/collectors/postgres-db-collector.adapter';
import { AxiosRestClientAdapter } from './infrastructure/collectors/axios-rest-client.adapter';
import { MosquittoMqttAdapter } from './infrastructure/collectors/mosquitto-mqtt.adapter';
import { DatabaseSeederService } from './infrastructure/persistence/seeder/database-seeder.service';
import { AutoSyncSchedulerService } from './infrastructure/scheduling/auto-sync-scheduler.service';
import { IngestionPipelineService } from './application/services/ingestion-pipeline.service';
import { GlobalExceptionFilter } from './presentation/filters/global-exception.filter';
import { LoggingAndRedactionInterceptor } from './presentation/interceptors/logging-and-redaction.interceptor';

// Use Cases
import { RegisterSourceUseCase } from './application/use-cases/sources/register-source.use-case';
import {
  DiscoverSourceSchemaUseCase,
  ListSourcesUseCase,
  SaveSourceSelectionUseCase,
  TestSourceConnectionUseCase,
} from './application/use-cases/sources/source-operations.use-cases';
import { RunCollectionUseCase } from './application/use-cases/collection/run-collection.use-case';
import {
  ConfigureAutoSyncUseCase,
  GetCollectionRunUseCase,
  ListCollectionRunsUseCase,
  PreviewNormalizedRecordsUseCase,
} from './application/use-cases/collection/collection-monitoring.use-cases';
import { GetProductionLinesUseCase } from './application/use-cases/production/get-production-lines.use-case';
import {
  GetBatchDetailUseCase,
  GetBatchProvenanceUseCase,
} from './application/use-cases/production/batch-details.use-cases';
import {
  AcknowledgeExceptionUseCase,
  AddBatchNoteUseCase,
  BlockBatchUseCase,
  ResumeBatchUseCase,
} from './application/use-cases/management/management-actions.use-cases';
import {
  GetStaleThresholdUseCase,
  UpdateStaleThresholdUseCase,
} from './application/use-cases/settings/settings.use-cases';

// Controllers
import { CollectionRunsController, SourcesController } from './presentation/controllers/sources.controller';
import {
  BatchesController,
  ProductionLinesController,
  SettingsController,
} from './presentation/controllers/production-and-management.controller';
import { FixturesController } from './presentation/controllers/fixtures.controller';

const collectorAdapters = [
  new CheerioWebCrawlerAdapter(),
  new PostgresDbCollectorAdapter(),
  new AxiosRestClientAdapter(),
  new MosquittoMqttAdapter(),
];

const encryptionService = new Aes256EncryptionService();

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.PLATFORM_DB_HOST || 'localhost',
      port: Number(process.env.PLATFORM_DB_PORT || 5432),
      username: process.env.PLATFORM_DB_USER || 'postgres',
      password: process.env.PLATFORM_DB_PASSWORD || (process.env.NODE_ENV === 'test' ? undefined : (() => { throw new Error('PLATFORM_DB_PASSWORD is required'); })()),
      database: process.env.PLATFORM_DB_NAME || 'platform_db',
      entities: [
        SourceOrmEntity,
        CollectionRunOrmEntity,
        SourceObservationOrmEntity,
        NormalizedRecordOrmEntity,
        CanonicalEventOrmEntity,
        BatchOrmEntity,
        WorkOrderOrmEntity,
        ManagementEventOrmEntity,
        SystemSettingsOrmEntity,
      ],
      synchronize: true, // Auto-schema sync for easy testing/demo
    }),
    TypeOrmModule.forFeature([
      SourceOrmEntity,
      CollectionRunOrmEntity,
      SourceObservationOrmEntity,
      NormalizedRecordOrmEntity,
      CanonicalEventOrmEntity,
      BatchOrmEntity,
      WorkOrderOrmEntity,
      ManagementEventOrmEntity,
      SystemSettingsOrmEntity,
    ]),
    ScheduleModule.forRoot(),
  ],
  controllers: [
    SourcesController,
    CollectionRunsController,
    ProductionLinesController,
    BatchesController,
    SettingsController,
    FixturesController,
  ],
  providers: [
    // Repositories
    TypeOrmSourceRepository,
    TypeOrmCollectionRunRepository,
    TypeOrmSourceObservationRepository,
    TypeOrmNormalizedRecordRepository,
    TypeOrmCanonicalEventRepository,
    TypeOrmBatchRepository,
    TypeOrmWorkOrderRepository,
    TypeOrmManagementEventRepository,
    TypeOrmSystemSettingsRepository,

    // Services
    DatabaseSeederService,
    AutoSyncSchedulerService,

    // Ingestion Pipeline Service
    {
      provide: IngestionPipelineService,
      useFactory: (
        sourceRepo: TypeOrmSourceRepository,
        runRepo: TypeOrmCollectionRunRepository,
        obsRepo: TypeOrmSourceObservationRepository,
        normRepo: TypeOrmNormalizedRecordRepository,
        canonRepo: TypeOrmCanonicalEventRepository,
        batchRepo: TypeOrmBatchRepository,
        workOrderRepo: TypeOrmWorkOrderRepository,
      ) => new IngestionPipelineService(sourceRepo, runRepo, obsRepo, normRepo, canonRepo, batchRepo, workOrderRepo),
      inject: [
        TypeOrmSourceRepository,
        TypeOrmCollectionRunRepository,
        TypeOrmSourceObservationRepository,
        TypeOrmNormalizedRecordRepository,
        TypeOrmCanonicalEventRepository,
        TypeOrmBatchRepository,
        TypeOrmWorkOrderRepository,
      ],
    },

    // UseCases
    {
      provide: RegisterSourceUseCase,
      useFactory: (repo: TypeOrmSourceRepository) => new RegisterSourceUseCase(repo, encryptionService),
      inject: [TypeOrmSourceRepository],
    },
    {
      provide: ListSourcesUseCase,
      useFactory: (repo: TypeOrmSourceRepository) => new ListSourcesUseCase(repo),
      inject: [TypeOrmSourceRepository],
    },
    {
      provide: TestSourceConnectionUseCase,
      useFactory: (repo: TypeOrmSourceRepository) =>
        new TestSourceConnectionUseCase(repo, encryptionService, collectorAdapters),
      inject: [TypeOrmSourceRepository],
    },
    {
      provide: DiscoverSourceSchemaUseCase,
      useFactory: (repo: TypeOrmSourceRepository) =>
        new DiscoverSourceSchemaUseCase(repo, encryptionService, collectorAdapters),
      inject: [TypeOrmSourceRepository],
    },
    {
      provide: SaveSourceSelectionUseCase,
      useFactory: (repo: TypeOrmSourceRepository) => new SaveSourceSelectionUseCase(repo),
      inject: [TypeOrmSourceRepository],
    },
    {
      provide: RunCollectionUseCase,
      useFactory: (
        sourceRepo: TypeOrmSourceRepository,
        runRepo: TypeOrmCollectionRunRepository,
        pipeline: IngestionPipelineService,
      ) => new RunCollectionUseCase(sourceRepo, runRepo, encryptionService, collectorAdapters, pipeline),
      inject: [TypeOrmSourceRepository, TypeOrmCollectionRunRepository, IngestionPipelineService],
    },
    {
      provide: ListCollectionRunsUseCase,
      useFactory: (repo: TypeOrmCollectionRunRepository) => new ListCollectionRunsUseCase(repo),
      inject: [TypeOrmCollectionRunRepository],
    },
    {
      provide: GetCollectionRunUseCase,
      useFactory: (repo: TypeOrmCollectionRunRepository) => new GetCollectionRunUseCase(repo),
      inject: [TypeOrmCollectionRunRepository],
    },
    {
      provide: PreviewNormalizedRecordsUseCase,
      useFactory: (repo: TypeOrmNormalizedRecordRepository) => new PreviewNormalizedRecordsUseCase(repo),
      inject: [TypeOrmNormalizedRecordRepository],
    },
    {
      provide: ConfigureAutoSyncUseCase,
      useFactory: (repo: TypeOrmSourceRepository) => new ConfigureAutoSyncUseCase(repo),
      inject: [TypeOrmSourceRepository],
    },
    {
      provide: GetProductionLinesUseCase,
      useFactory: (
        batchRepo: TypeOrmBatchRepository,
        woRepo: TypeOrmWorkOrderRepository,
        canonRepo: TypeOrmCanonicalEventRepository,
        mgmtRepo: TypeOrmManagementEventRepository,
        settingsRepo: TypeOrmSystemSettingsRepository,
      ) => new GetProductionLinesUseCase(batchRepo, woRepo, canonRepo, mgmtRepo, settingsRepo),
      inject: [
        TypeOrmBatchRepository,
        TypeOrmWorkOrderRepository,
        TypeOrmCanonicalEventRepository,
        TypeOrmManagementEventRepository,
        TypeOrmSystemSettingsRepository,
      ],
    },
    {
      provide: GetBatchDetailUseCase,
      useFactory: (
        batchRepo: TypeOrmBatchRepository,
        woRepo: TypeOrmWorkOrderRepository,
        canonRepo: TypeOrmCanonicalEventRepository,
        normRepo: TypeOrmNormalizedRecordRepository,
        mgmtRepo: TypeOrmManagementEventRepository,
        settingsRepo: TypeOrmSystemSettingsRepository,
      ) => new GetBatchDetailUseCase(batchRepo, woRepo, canonRepo, normRepo, mgmtRepo, settingsRepo),
      inject: [
        TypeOrmBatchRepository,
        TypeOrmWorkOrderRepository,
        TypeOrmCanonicalEventRepository,
        TypeOrmNormalizedRecordRepository,
        TypeOrmManagementEventRepository,
        TypeOrmSystemSettingsRepository,
      ],
    },
    {
      provide: GetBatchProvenanceUseCase,
      useFactory: (
        canonRepo: TypeOrmCanonicalEventRepository,
        normRepo: TypeOrmNormalizedRecordRepository,
        obsRepo: TypeOrmSourceObservationRepository,
        sourceRepo: TypeOrmSourceRepository,
      ) => new GetBatchProvenanceUseCase(canonRepo, normRepo, obsRepo, sourceRepo),
      inject: [
        TypeOrmCanonicalEventRepository,
        TypeOrmNormalizedRecordRepository,
        TypeOrmSourceObservationRepository,
        TypeOrmSourceRepository,
      ],
    },
    {
      provide: BlockBatchUseCase,
      useFactory: (
        batchRepo: TypeOrmBatchRepository,
        mgmtRepo: TypeOrmManagementEventRepository,
        canonRepo: TypeOrmCanonicalEventRepository,
      ) => new BlockBatchUseCase(batchRepo, mgmtRepo, canonRepo),
      inject: [TypeOrmBatchRepository, TypeOrmManagementEventRepository, TypeOrmCanonicalEventRepository],
    },
    {
      provide: ResumeBatchUseCase,
      useFactory: (
        batchRepo: TypeOrmBatchRepository,
        mgmtRepo: TypeOrmManagementEventRepository,
        canonRepo: TypeOrmCanonicalEventRepository,
      ) => new ResumeBatchUseCase(batchRepo, mgmtRepo, canonRepo),
      inject: [TypeOrmBatchRepository, TypeOrmManagementEventRepository, TypeOrmCanonicalEventRepository],
    },
    {
      provide: AcknowledgeExceptionUseCase,
      useFactory: (batchRepo: TypeOrmBatchRepository, mgmtRepo: TypeOrmManagementEventRepository) =>
        new AcknowledgeExceptionUseCase(batchRepo, mgmtRepo),
      inject: [TypeOrmBatchRepository, TypeOrmManagementEventRepository],
    },
    {
      provide: AddBatchNoteUseCase,
      useFactory: (batchRepo: TypeOrmBatchRepository, mgmtRepo: TypeOrmManagementEventRepository) =>
        new AddBatchNoteUseCase(batchRepo, mgmtRepo),
      inject: [TypeOrmBatchRepository, TypeOrmManagementEventRepository],
    },
    {
      provide: GetStaleThresholdUseCase,
      useFactory: (settingsRepo: TypeOrmSystemSettingsRepository) => new GetStaleThresholdUseCase(settingsRepo),
      inject: [TypeOrmSystemSettingsRepository],
    },
    {
      provide: UpdateStaleThresholdUseCase,
      useFactory: (settingsRepo: TypeOrmSystemSettingsRepository) => new UpdateStaleThresholdUseCase(settingsRepo),
      inject: [TypeOrmSystemSettingsRepository],
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: LoggingAndRedactionInterceptor,
    },
    {
      provide: APP_FILTER,
      useClass: GlobalExceptionFilter,
    },
  ],
})
export class AppModule {}
