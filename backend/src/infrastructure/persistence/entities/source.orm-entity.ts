import { Column, CreateDateColumn, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';
import { SourceStatus, SourceType } from '../../../domain/enums/common.enums';

@Entity('sources')
export class SourceOrmEntity {
  @PrimaryColumn('varchar', { length: 50 })
  id: string;

  @Column('varchar', { length: 50 })
  organizationId: string;

  @Column('varchar', { length: 150 })
  name: string;

  @Column('varchar', { length: 50 })
  type: SourceType;

  @Column('jsonb')
  config: Record<string, any>;

  @Column('text', { nullable: true })
  encryptedSecret: string | null;

  @Column('jsonb', { nullable: true })
  selectedSchema: Record<string, any> | null;

  @Column('varchar', { length: 50, default: SourceStatus.UNVERIFIED })
  status: SourceStatus;

  @Column('boolean', { default: false })
  autoSync: boolean;

  @Column('int', { default: 30 })
  syncIntervalSeconds: number;

  @Column('timestamp with time zone', { nullable: true })
  lastVerifiedAt: Date | null;

  @Column('timestamp with time zone', { nullable: true })
  lastRunAt: Date | null;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamp with time zone' })
  updatedAt: Date;
}
