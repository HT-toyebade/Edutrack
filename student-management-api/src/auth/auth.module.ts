import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtStrategy } from './jwt.strategy.js';
import { User } from '../users/entities/user.entity.js';
import { Student } from '../student/entities/student.entity/student.entity.js';
import { Staff } from '../staff/entities/staff.entity.js';
import { RolesGuard } from './roles.guard.js';

@Module({
  imports: [PassportModule, TypeOrmModule.forFeature([User, Student, Staff])],
  providers: [JwtStrategy, RolesGuard],
  exports: [PassportModule, RolesGuard],
})
export class AuthModule {}
