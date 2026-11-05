import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('audit_events')
export class AuditEvent {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'actor_user_id', type: 'integer', nullable: true })
  actorUserId: number | null;

  @Column({ length: 80 })
  action: string;

  @Column({ name: 'target_type', length: 40 })
  targetType: string;

  @Column({ name: 'target_id', type: 'integer', nullable: true })
  targetId: number | null;

  @Column({ type: 'text', nullable: true })
  reason: string | null;

  @Column({ type: 'jsonb', nullable: true })
  changes: Record<string, unknown> | null;

  @CreateDateColumn({ name: 'occurred_at', type: 'timestamptz' })
  occurredAt: Date;
}
