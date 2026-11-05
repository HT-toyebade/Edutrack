import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource, Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { EmailOutbox } from './entities/email-outbox.entity.js';
import { Invitation } from '../invitations/entities/invitation.entity.js';
import { decryptInvitationToken } from '../invitations/invitation-crypto.js';
import { SmtpEmailProvider } from './smtp-email.provider.js';

@Injectable()
export class EmailOutboxProcessor implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(EmailOutboxProcessor.name);
  private timer?: NodeJS.Timeout;
  private running = false;

  constructor(
    private readonly dataSource: DataSource,
    private readonly provider: SmtpEmailProvider,
    private readonly config: ConfigService,
    @InjectRepository(Invitation) private readonly invitations: Repository<Invitation>,
    @InjectRepository(EmailOutbox) private readonly outbox: Repository<EmailOutbox>,
  ) {}

  onModuleInit() {
    this.timer = setInterval(() => void this.processOne(), 5000);
    this.timer.unref();
    void this.processOne();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  async processOne(): Promise<void> {
    if (this.running || !this.config.get<string>('SMTP_HOST')) return;
    this.running = true;
    try {
      const task = await this.dataSource.transaction(async (manager) => {
        const rows = await manager.query(`
          SELECT * FROM email_outbox
          WHERE (status='pending' AND (next_attempt_at IS NULL OR next_attempt_at <= now()))
             OR (status='processing' AND updated_at < now() - interval '5 minutes')
          ORDER BY id FOR UPDATE SKIP LOCKED LIMIT 1
        `) as Array<Record<string, unknown>>;
        if (!rows[0]) return null;
        await manager.query(`UPDATE email_outbox SET status='processing', "updated_at"=now() WHERE id=$1`, [rows[0].id]);
        return rows[0];
      });
      if (!task) return;
      const id = Number(task.id);
      try {
        const data = task.template_data as { invitationId?: number };
        const invitation = data?.invitationId ? await this.invitations.findOne({ where: { id: data.invitationId }, relations: { user: true } }) : null;
        if (!invitation || invitation.acceptedAt || invitation.revokedAt || invitation.expiresAt <= new Date()) {
          await this.outbox.update(id, { status: 'failed', lastErrorCode: 'INVITATION_UNAVAILABLE' });
          return;
        }
        const token = decryptInvitationToken(invitation.tokenCiphertext, this.config.getOrThrow<string>('JWT_SECRET'));
        const base = this.config.get<string>('INVITATION_BASE_URL') ?? 'http://localhost:5173/accept-invitation';
        const url = `${base}${base.includes('?') ? '&' : '?'}token=${encodeURIComponent(token)}`;
        await this.provider.sendInvitation(String(task.recipient), url, `outbox-${id}`);
        await this.outbox.update(id, { status: 'sent', lastErrorCode: null });
      } catch (error) {
        const attempts = Number(task.attempt_count ?? 0) + 1;
        const terminal = attempts >= 6;
        const delaySeconds = Math.min(3600, 30 * 2 ** Math.max(0, attempts - 1));
        await this.outbox.update(id, {
          status: terminal ? 'failed' : 'pending',
          attemptCount: attempts,
          nextAttemptAt: terminal ? null : new Date(Date.now() + delaySeconds * 1000),
          lastErrorCode: this.safeErrorCode(error),
        });
        this.logger.warn(`Invitation email delivery attempt failed (outbox ${id}, attempt ${attempts}).`);
      }
    } catch {
      this.logger.error('Email outbox processing failed.');
    } finally {
      this.running = false;
    }
  }

  private safeErrorCode(error: unknown): string {
    if (error && typeof error === 'object' && 'code' in error && typeof error.code === 'string') {
      return error.code.slice(0, 80).replace(/[^a-zA-Z0-9_-]/g, '_');
    }
    return 'DELIVERY_ERROR';
  }
}
