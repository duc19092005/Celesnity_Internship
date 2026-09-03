import { CollectionRunStatus } from '../enums/common.enums';

export interface CollectionErrorDetail {
  code: string;
  message: string;
  rowNumber?: number;
  rawExcerpt?: string;
  occurredAt: Date;
}

export class CollectionRun {
  constructor(
    public id: string,
    public organizationId: string,
    public sourceId: string,
    public status: CollectionRunStatus = CollectionRunStatus.PENDING,
    public startedAt: Date = new Date(),
    public finishedAt: Date | null = null,
    public durationMs: number = 0,
    public observedCount: number = 0,
    public normalizedCount: number = 0,
    public acceptedCount: number = 0,
    public duplicateCount: number = 0,
    public conflictCount: number = 0,
    public rejectedCount: number = 0,
    public errorCount: number = 0,
    public errors: CollectionErrorDetail[] = [],
    public createdAt: Date = new Date(),
  ) {}

  public finish(status: CollectionRunStatus): void {
    this.status = status;
    this.finishedAt = new Date();
    this.durationMs = this.finishedAt.getTime() - this.startedAt.getTime();
  }

  public addError(code: string, message: string, rowNumber?: number, rawExcerpt?: string): void {
    this.errors.push({
      code,
      message,
      rowNumber,
      rawExcerpt,
      occurredAt: new Date(),
    });
    this.errorCount = this.errors.length;
  }
}
