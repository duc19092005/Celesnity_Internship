import { SourceConfig } from '../../domain/entities/source.entity';
import { SourceType } from '../../domain/enums/common.enums';

export interface IEncryptionService {
  encrypt(plainText: string): string;
  decrypt(cipherText: string): string;
  mask(plainText?: string): string;
}

export const ENCRYPTION_SERVICE_TOKEN = 'ENCRYPTION_SERVICE_TOKEN';

export interface RawCollectedItem {
  sourceRecordId: string;
  sourceRevision?: number;
  payload: Record<string, any>;
  observedAt: Date;
}

export interface DiscoveredSchemaResult {
  tables?: Array<{ name: string; columns: Array<{ name: string; type: string }> }>;
  fields?: Array<{ name: string; type: string; example?: any }>;
  headers?: string[];
  metadata?: Record<string, any>;
}

export interface CollectorExecutionResult {
  success: boolean;
  items: RawCollectedItem[];
  errors: Array<{ code: string; message: string; rowNumber?: number; rawExcerpt?: string }>;
  durationMs: number;
}

export interface ICollectorAdapter {
  supports(type: SourceType): boolean;
  testConnection(config: SourceConfig, secret?: string): Promise<{ connected: boolean; latencyMs: number; message: string }>;
  discoverSchema(config: SourceConfig, secret?: string): Promise<DiscoveredSchemaResult>;
  collect(config: SourceConfig, selectedSchema?: any, secret?: string): Promise<CollectorExecutionResult>;
}

export const COLLECTOR_ADAPTERS_TOKEN = 'COLLECTOR_ADAPTERS_TOKEN';
