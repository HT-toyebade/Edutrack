import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../users/entities/user.entity.js';
import { JwtAuthGuard } from '../auth/jwt-auth/jwt-auth.guard.js';
import { Staff } from './entities/staff.entity.js';
import { StaffController } from './staff.controller.js';
import { StaffRoleGuard } from './staff-role.guard.js';
import { StaffService } from './staff.service.js';
import { InvitationsModule } from '../invitations/invitations.module.js';
import { AuditModule } from '../audit/audit.module.js';
import { AuthModule } from '../auth/auth.module.js';

@Module({
  imports: [TypeOrmModule.forFeature([Staff, User]), InvitationsModule, AuditModule, AuthModule],
  controllers: [StaffController],
  providers: [StaffService, JwtAuthGuard, StaffRoleGuard],
})
export class StaffModule {}
