import { IsBoolean, IsEnum, IsInt, IsNotEmpty, IsObject, IsOptional, IsString, Max, Min } from 'class-validator';
import { SourceType } from '../../domain/enums/common.enums';

export class RegisterSourceDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsEnum(SourceType)
  type: SourceType;

  @IsObject()
  config: Record<string, any>;

  @IsString()
  @IsOptional()
  secret?: string;

  @IsObject()
  @IsOptional()
  selectedSchema?: Record<string, any>;
}

export class SaveSelectionDto {
  @IsObject()
  @IsNotEmpty()
  selection: Record<string, any>;
}

export class AutoSyncDto {
  @IsBoolean()
  enabled: boolean;

  @IsInt()
  @Min(10)
  @Max(86400)
  @IsOptional()
  intervalSeconds?: number;
}

export class BlockBatchDto {
  @IsString()
  @IsNotEmpty()
  reason: string;
}

export class ResumeBatchDto {
  @IsString()
  @IsOptional()
  note?: string;
}

export class AcknowledgeExceptionDto {
  @IsString()
  @IsNotEmpty()
  exceptionKey: string;

  @IsString()
  @IsOptional()
  note?: string;
}

export class AddBatchNoteDto {
  @IsString()
  @IsNotEmpty()
  note: string;
}

export class UpdateStaleThresholdDto {
  @IsInt()
  @Min(1)
  @Max(1440)
  minutes: number;
}
