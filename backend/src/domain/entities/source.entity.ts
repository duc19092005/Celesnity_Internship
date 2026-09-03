import { SourceStatus, SourceType } from '../enums/common.enums';

export interface SourceConfig {
  baseUrl?: string;
  url?: string;
  host?: string;
  port?: number;
  database?: string;
  username?: string;
  timeoutMs?: number;
  maxPages?: number;
  brokerUrl?: string;
  topic?: string;
  [key: string]: any;
}

export interface SelectedSchema {
  selectedTable?: string;
  selectedColumns?: string[];
  selectedFields?: string[];
  mapping?: Record<string, string>;
  [key: string]: any;
}

export class Source {
  constructor(
    public id: string,
    public organizationId: string,
    public name: string,
    public type: SourceType,
    public config: SourceConfig,
    public encryptedSecret: string | null = null,
    public selectedSchema: SelectedSchema | null = null,
    public status: SourceStatus = SourceStatus.UNVERIFIED,
    public autoSync: boolean = false,
    public syncIntervalSeconds: number = 30,
    public lastVerifiedAt: Date | null = null,
    public lastRunAt: Date | null = null,
    public createdAt: Date = new Date(),
    public updatedAt: Date = new Date(),
  ) {}

  public markVerified(): void {
    this.status = SourceStatus.VERIFIED;
    this.lastVerifiedAt = new Date();
    this.updatedAt = new Date();
  }

  public markError(): void {
    this.status = SourceStatus.ERROR;
    this.updatedAt = new Date();
  }

  public updateSelection(schema: SelectedSchema): void {
    this.selectedSchema = schema;
    this.updatedAt = new Date();
  }

  public setAutoSync(enabled: boolean, intervalSeconds: number = 30): void {
    this.autoSync = enabled;
    this.syncIntervalSeconds = Math.max(10, intervalSeconds);
    this.updatedAt = new Date();
  }
}
