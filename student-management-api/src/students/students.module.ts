import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StudentsService } from './students.service.js';
import { StudentsController } from './students.controller.js';
import { Student } from '../student/entities/student.entity/student.entity.js';
import { User } from '../users/entities/user.entity.js';
import { InvitationsModule } from '../invitations/invitations.module.js';
import { AuditModule } from '../audit/audit.module.js';
import { AuthModule } from '../auth/auth.module.js';
import { JwtAuthGuard } from '../auth/jwt-auth/jwt-auth.guard.js';

@Module({
  imports: [TypeOrmModule.forFeature([Student, User]), InvitationsModule, AuditModule, AuthModule],
  providers: [StudentsService, JwtAuthGuard],
  controllers: [StudentsController],
})
export class StudentsModule {}
