import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module.js';
import { User } from '../users/entities/user.entity.js';
import { Student } from '../student/entities/student.entity/student.entity.js';
import { Staff } from '../staff/entities/staff.entity.js';
import { AdminController } from './admin.controller.js';
import { JwtAuthGuard } from '../auth/jwt-auth/jwt-auth.guard.js';

@Module({
  imports: [TypeOrmModule.forFeature([User, Student, Staff]), AuthModule],
  controllers: [AdminController],
  providers: [JwtAuthGuard],
})
export class AdminModule {}
