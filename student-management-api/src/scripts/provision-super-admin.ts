import { NestFactory } from '@nestjs/core';
import { ConflictException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { AppModule } from '../app.module.js';
import { AccountStatus, AccountType, User } from '../users/entities/user.entity.js';
import { AuditService } from '../audit/audit.service.js';

export async function provisionInitialSuperAdmin(
  dataSource: DataSource,
  audit: AuditService,
  email: string,
  password: string,
): Promise<'created' | 'already_configured'> {
  const normalizedEmail = email.trim().toLowerCase();
  return dataSource.transaction(async (manager) => {
    await manager.query('SELECT pg_advisory_xact_lock(7719202601)');
    const repository = manager.getRepository(User);
    const admins = await repository.count({ where: { accountType: AccountType.SUPER_ADMIN } });
    const existing = await repository.findOne({ where: { email: normalizedEmail } });
    if (admins > 0) {
      if (existing?.accountType === AccountType.SUPER_ADMIN) return 'already_configured';
      throw new ConflictException('Initial Super Admin has already been provisioned.');
    }
    if (existing) throw new ConflictException('Provisioning email is already in use.');
    const user = await repository.save(repository.create({
      email: normalizedEmail,
      passwordHash: await bcrypt.hash(password, 12),
      accountType: AccountType.SUPER_ADMIN,
      status: AccountStatus.ACTIVE,
    }));
    await audit.record({ actorUserId: null, action: 'super_admin.provisioned', targetType: 'user', targetId: user.id }, manager);
    return 'created';
  });
}

async function run() {
  const email = process.env.SUPER_ADMIN_EMAIL?.trim();
  const password = process.env.SUPER_ADMIN_PASSWORD;
  if (!email || !password || password.length < 12) {
    console.error('Super Admin provisioning requires SUPER_ADMIN_EMAIL and a SUPER_ADMIN_PASSWORD of at least 12 characters.');
    process.exitCode = 1;
    return;
  }
  let app: Awaited<ReturnType<typeof NestFactory.createApplicationContext>> | undefined;
  try {
    app = await NestFactory.createApplicationContext(AppModule, { logger: false });
    const result = await provisionInitialSuperAdmin(
      app.get(DataSource),
      app.get(AuditService),
      email,
      password,
    );
    console.info(result === 'created' ? 'Initial Super Admin provisioned.' : 'Initial Super Admin is already configured.');
  } catch {
    console.error('Super Admin provisioning failed. Verify environment and schema configuration.');
    process.exitCode = 1;
  } finally {
    await app?.close();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) await run();
