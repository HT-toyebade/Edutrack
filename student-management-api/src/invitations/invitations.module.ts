import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module.js';
import { AuditModule } from '../audit/audit.module.js';
import { NotificationsModule } from '../notifications/notifications.module.js';
import { Invitation } from './entities/invitation.entity.js';
import { InvitationsController } from './invitations.controller.js';
import { InvitationsService } from './invitations.service.js';
import { JwtAuthGuard } from '../auth/jwt-auth/jwt-auth.guard.js';
import { ThrottlerModule } from '@nestjs/throttler';

@Module({
  imports: [TypeOrmModule.forFeature([Invitation]), AuthModule, AuditModule, NotificationsModule, ThrottlerModule.forRoot([{ ttl: 60_000, limit: 5 }])],
  controllers: [InvitationsController],
  providers: [InvitationsService, JwtAuthGuard],
  exports: [InvitationsService],
})
export class InvitationsModule {}
