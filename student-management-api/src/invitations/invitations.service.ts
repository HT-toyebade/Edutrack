import { ConflictException, ForbiddenException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'node:crypto';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { AuditService } from '../audit/audit.service.js';
import { AccountStatus, AccountType, User } from '../users/entities/user.entity.js';
import { EmailOutbox } from '../notifications/entities/email-outbox.entity.js';
import { AuthenticatedUser } from '../auth/current-user.decorator.js';
import { Invitation } from './entities/invitation.entity.js';
import { digestInvitationToken, encryptInvitationToken } from './invitation-crypto.js';
import { AcceptInvitationDto } from './dto/accept-invitation.dto.js';
import { InvitationStatus, ListInvitationsQueryDto } from './dto/list-invitations-query.dto.js';

export interface InvitationListItem {
  id: number;
  email: string;
  accountType: AccountType;
  purpose: string;
  createdAt: Date;
  expiresAt: Date;
  acceptedAt: Date | null;
  revokedAt: Date | null;
  status: InvitationStatus;
  creator: { id: number; email: string } | null;
}

@Injectable()
export class InvitationsService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly audit: AuditService,
    private readonly config: ConfigService,
    @InjectRepository(Invitation) private readonly invitations: Repository<Invitation>,
  ) {}

  async createFor(manager: EntityManager, user: User, actorUserId: number | null): Promise<Invitation> {
    const token = randomBytes(32).toString('base64url');
    const invitation = await manager.getRepository(Invitation).save(manager.getRepository(Invitation).create({
      user,
      tokenDigest: digestInvitationToken(token),
      tokenCiphertext: encryptInvitationToken(token, this.config.getOrThrow<string>('JWT_SECRET')),
      purpose: 'account_activation',
      expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000),
      acceptedAt: null,
      revokedAt: null,
      createdByUserId: actorUserId,
    }));
    const outbox = manager.getRepository(EmailOutbox);
    await outbox.save(outbox.create({
      kind: 'account_invitation',
      recipient: user.email,
      templateData: { invitationId: invitation.id },
      status: 'pending',
      attemptCount: 0,
    }));
    await this.audit.record({ actorUserId, action: 'invitation.issued', targetType: 'invitation', targetId: invitation.id }, manager);
    return invitation;
  }

  async accept(dto: AcceptInvitationDto) {
    const tokenDigest = digestInvitationToken(dto.token);
    return this.dataSource.transaction(async (manager) => {
      const invitation = await manager.getRepository(Invitation).createQueryBuilder('invitation')
        .innerJoinAndSelect('invitation.user', 'user')
        .where('invitation.tokenDigest = :tokenDigest', { tokenDigest })
        .setLock('pessimistic_write')
        .getOne();
      if (!invitation || invitation.revokedAt || invitation.acceptedAt || invitation.expiresAt <= new Date()) {
        throw new UnauthorizedException('Invitation is invalid or expired.');
      }
      const user = invitation.user;
      if (user.status !== AccountStatus.PENDING) throw new ConflictException('This account is not awaiting invitation acceptance.');
      user.passwordHash = await bcrypt.hash(dto.password, 10);
      user.status = AccountStatus.ACTIVE;
      await manager.getRepository(User).save(user);
      invitation.acceptedAt = new Date();
      invitation.tokenCiphertext = 'consumed';
      await manager.getRepository(Invitation).save(invitation);
      await this.audit.record({ actorUserId: user.id, action: 'invitation.accepted', targetType: 'user', targetId: user.id }, manager);
      return { id: user.id, email: user.email, accountType: user.accountType, status: user.status };
    });
  }

  async list(query: ListInvitationsQueryDto, actor: AuthenticatedUser) {
    if (![AccountType.STAFF, AccountType.SUPER_ADMIN].includes(actor.accountType)) {
      throw new ForbiddenException('Your account does not have permission to view invitations.');
    }
    const now = new Date();
    const statusExpression = `CASE
      WHEN invitation.acceptedAt IS NOT NULL THEN '${InvitationStatus.ACCEPTED}'
      WHEN invitation.revokedAt IS NOT NULL THEN '${InvitationStatus.REVOKED}'
      WHEN invitation.expiresAt <= :now THEN '${InvitationStatus.EXPIRED}'
      ELSE '${InvitationStatus.PENDING}'
    END`;
    const builder = this.invitations.createQueryBuilder('invitation')
      .innerJoin('invitation.user', 'recipient')
      .leftJoin(User, 'creator', 'creator.id = invitation.createdByUserId')
      .select('invitation.id', 'id')
      .addSelect('recipient.email', 'email')
      .addSelect('recipient.accountType', 'accountType')
      .addSelect('invitation.purpose', 'purpose')
      .addSelect('invitation.createdAt', 'createdAt')
      .addSelect('invitation.expiresAt', 'expiresAt')
      .addSelect('invitation.acceptedAt', 'acceptedAt')
      .addSelect('invitation.revokedAt', 'revokedAt')
      .addSelect(statusExpression, 'status')
      .addSelect('creator.id', 'creatorId')
      .addSelect('creator.email', 'creatorEmail')
      .setParameter('now', now);

    if (actor.accountType === AccountType.STAFF) {
      builder.andWhere('recipient.accountType = :studentType', { studentType: AccountType.STUDENT })
        .andWhere('invitation.createdByUserId = :actorUserId', { actorUserId: actor.userId });
    }
    if (query.accountType) builder.andWhere('recipient.accountType = :accountType', { accountType: query.accountType });
    if (query.email) builder.andWhere('LOWER(recipient.email) = :email', { email: query.email.trim().toLowerCase() });
    if (query.status) builder.andWhere(`${statusExpression} = :status`, { status: query.status });

    const total = await builder.getCount();
    const rows = await builder.orderBy('invitation.createdAt', 'DESC')
      .addOrderBy('invitation.id', 'DESC')
      .skip((query.page - 1) * query.limit)
      .take(query.limit)
      .getRawMany<{
        id: number; email: string; accountType: AccountType; purpose: string;
        createdAt: Date; expiresAt: Date; acceptedAt: Date | null; revokedAt: Date | null;
        status: InvitationStatus; creatorId: number | null; creatorEmail: string | null;
      }>();

    const items: InvitationListItem[] = rows.map((row) => ({
      id: Number(row.id),
      email: row.email,
      accountType: row.accountType,
      purpose: row.purpose,
      createdAt: row.createdAt,
      expiresAt: row.expiresAt,
      acceptedAt: row.acceptedAt,
      revokedAt: row.revokedAt,
      status: row.status,
      creator: row.creatorId == null ? null : { id: Number(row.creatorId), email: row.creatorEmail! },
    }));
    return { items, total, page: query.page, limit: query.limit, totalPages: Math.ceil(total / query.limit) };
  }

  async revoke(id: number, actor: AuthenticatedUser) {
    return this.dataSource.transaction(async (manager) => {
      const invitation = await manager.getRepository(Invitation).findOne({ where: { id }, relations: { user: true }, lock: { mode: 'pessimistic_write' } });
      if (!invitation) throw new NotFoundException('Invitation not found.');
      this.assertCanManage(invitation.user, invitation.createdByUserId, actor);
      if (invitation.acceptedAt) throw new ConflictException('Accepted invitations cannot be revoked.');
      if (invitation.revokedAt) return { id, status: 'revoked' };
      invitation.revokedAt = new Date();
      invitation.tokenCiphertext = 'revoked';
      await manager.getRepository(Invitation).save(invitation);
      await this.audit.record({ actorUserId: actor.userId, action: 'invitation.revoked', targetType: 'invitation', targetId: id }, manager);
      return { id, status: 'revoked' };
    });
  }

  async resend(id: number, actor: AuthenticatedUser) {
    return this.dataSource.transaction(async (manager) => {
      const repository = manager.getRepository(Invitation);
      const old = await repository.findOne({ where: { id }, relations: { user: true }, lock: { mode: 'pessimistic_write' } });
      if (!old) throw new NotFoundException('Invitation not found.');
      this.assertCanManage(old.user, old.createdByUserId, actor);
      const user = await manager.getRepository(User).findOne({
        where: { id: old.user.id },
        lock: { mode: 'pessimistic_write' },
      });
      if (!user) throw new NotFoundException('Invitation account not found.');
      if (old.acceptedAt || user.status !== AccountStatus.PENDING) throw new ConflictException('Only pending accounts can receive a replacement invitation.');
      const now = new Date();
      const otherOutstanding = await repository.createQueryBuilder('invitation')
        .innerJoin('invitation.user', 'user')
        .where('user.id = :userId', { userId: user.id })
        .andWhere('invitation.id != :id', { id: old.id })
        .andWhere('invitation.acceptedAt IS NULL')
        .andWhere('invitation.revokedAt IS NULL')
        .andWhere('invitation.expiresAt > :now', { now })
        .setLock('pessimistic_write')
        .getMany();
      for (const outstanding of otherOutstanding) {
        outstanding.revokedAt = now;
        outstanding.tokenCiphertext = 'revoked';
        await repository.save(outstanding);
        await this.audit.record({
          actorUserId: actor.userId, action: 'invitation.superseded',
          targetType: 'invitation', targetId: outstanding.id,
        }, manager);
      }
      old.revokedAt = now;
      old.tokenCiphertext = 'revoked';
      await repository.save(old);
      await this.audit.record({ actorUserId: actor.userId, action: 'invitation.resent', targetType: 'invitation', targetId: old.id }, manager);
      const replacement = await this.createFor(manager, user, actor.userId);
      return { id: replacement.id, expiresAt: replacement.expiresAt, status: 'pending_delivery' };
    });
  }

  private assertCanManage(user: User, createdByUserId: number | null, actor: AuthenticatedUser) {
    const admin = actor.accountType === AccountType.SUPER_ADMIN;
    const staffStudent = actor.accountType === AccountType.STAFF
      && user.accountType === AccountType.STUDENT
      && createdByUserId === actor.userId;
    if (!admin && !staffStudent) throw new ForbiddenException('Your account does not have permission to manage this invitation.');
  }
}
