import { Source, SourceConfig, SelectedSchema } from '../../../domain/entities/source.entity';
import { SourceStatus, SourceType } from '../../../domain/enums/common.enums';
import { ISourceRepository } from '../../../domain/repositories';
import { IEncryptionService } from '../../ports';

export interface RegisterSourceInput {
  organizationId: string;
  name: string;
  type: SourceType;
  config: SourceConfig;
  secret?: string;
  selectedSchema?: SelectedSchema;
}

export class RegisterSourceUseCase {
  constructor(
    private readonly sourceRepo: ISourceRepository,
    private readonly encryptionService: IEncryptionService,
  ) {}

  public async execute(input: RegisterSourceInput): Promise<Source> {
    const id = `src-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    let encryptedSecret: string | null = null;

    if (input.secret && input.secret.trim() !== '') {
      encryptedSecret = this.encryptionService.encrypt(input.secret);
    }

    const source = new Source(
      id,
      input.organizationId,
      input.name,
      input.type,
      input.config,
      encryptedSecret,
      input.selectedSchema ?? null,
      SourceStatus.UNVERIFIED,
      false,
      30,
      null,
      null,
      new Date(),
      new Date(),
    );

    return this.sourceRepo.save(source);
  }
}
