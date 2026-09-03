export class EntityNotFoundException extends Error {
  constructor(entityName: string, id: string) {
    super(`${entityName} with ID '${id}' was not found.`);
    this.name = 'EntityNotFoundException';
  }
}

export class SourceNotFoundException extends EntityNotFoundException {
  constructor(id: string) {
    super('Source', id);
  }
}

export class BatchNotFoundException extends EntityNotFoundException {
  constructor(id: string) {
    super('Batch', id);
  }
}

export class WorkOrderNotFoundException extends EntityNotFoundException {
  constructor(id: string) {
    super('WorkOrder', id);
  }
}

export class CollectionRunNotFoundException extends EntityNotFoundException {
  constructor(id: string) {
    super('CollectionRun', id);
  }
}

export class AdapterNotFoundException extends Error {
  constructor(sourceType: string) {
    super(`No collector adapter found for source type '${sourceType}'.`);
    this.name = 'AdapterNotFoundException';
  }
}

export class InvalidOperationException extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidOperationException';
  }
}
