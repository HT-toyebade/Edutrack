import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity('email_outbox')
export class EmailOutbox {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 120 })
  kind: string;

  @Column()
  recipient: string;

  @Column({ name: 'template_data', type: 'jsonb' })
  templateData: Record<string, unknown>;

  @Column({ default: 'pending', length: 20 })
  status: 'pending' | 'processing' | 'sent' | 'failed';

  @Column({ default: 0, name: 'attempt_count' })
  attemptCount: number;

  @Column({ name: 'next_attempt_at', type: 'timestamptz', nullable: true })
  nextAttemptAt: Date | null;

  @Column({ name: 'last_error_code', type: 'varchar', length: 80, nullable: true })
  lastErrorCode: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
