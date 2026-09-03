import { ManagementAction } from '../enums/common.enums';

export class ManagementEvent {
  constructor(
    public id: string,
    public organizationId: string,
    public batchId: string,
    public action: ManagementAction,
    public actorId: string,
    public actorName: string,
    public reason: string | null = null,
    public note: string | null = null,
    public exceptionKey: string | null = null,
    public timestamp: Date = new Date(),
    public createdAt: Date = new Date(),
  ) {}
}
