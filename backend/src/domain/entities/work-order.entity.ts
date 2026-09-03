export class WorkOrder {
  constructor(
    public workOrderId: string,
    public organizationId: string,
    public customerName: string,
    public targetQuantity: number,
    public plannedStartDate: Date,
    public plannedEndDate: Date,
    public status: string = 'PLANNED',
    public createdAt: Date = new Date(),
  ) {}
}
