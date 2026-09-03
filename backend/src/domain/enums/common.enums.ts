export enum BatchStatus {
  PLANNED = 'PLANNED',
  IN_PROGRESS = 'IN_PROGRESS',
  BLOCKED = 'BLOCKED',
  COMPLETED = 'COMPLETED',
}

export enum SourceType {
  REST_API = 'REST_API',
  WEB_CRAWLER = 'WEB_CRAWLER',
  POSTGRESQL = 'POSTGRESQL',
  MQTT = 'MQTT',
}

export enum Disposition {
  ACCEPTED = 'ACCEPTED',
  DUPLICATE = 'DUPLICATE',
  CONFLICT = 'CONFLICT',
  REJECTED = 'REJECTED',
}

export enum ManagementAction {
  BLOCK = 'BLOCK',
  RESUME = 'RESUME',
  ACKNOWLEDGE = 'ACKNOWLEDGE',
  NOTE = 'NOTE',
}

export enum QualityStatus {
  PASS = 'PASS',
  FAIL = 'FAIL',
  UNKNOWN = 'UNKNOWN',
}

export enum CollectionRunStatus {
  PENDING = 'PENDING',
  RUNNING = 'RUNNING',
  SUCCEEDED = 'SUCCEEDED',
  PARTIAL_SUCCESS = 'PARTIAL_SUCCESS',
  FAILED = 'FAILED',
}

export enum SourceStatus {
  UNVERIFIED = 'UNVERIFIED',
  VERIFIED = 'VERIFIED',
  ERROR = 'ERROR',
}
