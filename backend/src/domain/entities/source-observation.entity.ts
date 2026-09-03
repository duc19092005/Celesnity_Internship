export class SourceObservation {
  constructor(
    public id: string,
    public organizationId: string,
    public sourceId: string,
    public collectionRunId: string,
    public rawPayload: Record<string, any>,
    public sourceRecordId: string | null = null,
    public observedAt: Date = new Date(),
    public createdAt: Date = new Date(),
  ) {}
}
