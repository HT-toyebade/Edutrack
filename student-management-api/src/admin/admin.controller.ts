import { Controller, Get, UseGuards } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtAuthGuard } from '../auth/jwt-auth/jwt-auth.guard.js';
import { Roles } from '../auth/roles.decorator.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { AccountStatus, AccountType, User } from '../users/entities/user.entity.js';
import { Student } from '../student/entities/student.entity/student.entity.js';
import { Staff } from '../staff/entities/staff.entity.js';

@Controller('dashboard')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(AccountType.SUPER_ADMIN)
export class AdminController {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(Student) private readonly students: Repository<Student>,
    @InjectRepository(Staff) private readonly staff: Repository<Staff>,
  ) {}

  @Get('overview')
  async overview() {
    const [students, staff, users] = await Promise.all([
      this.students.count(), this.staff.count(),
      this.users.createQueryBuilder('user').select('user.status', 'status').addSelect('COUNT(*)', 'count').groupBy('user.status').getRawMany<{ status: AccountStatus; count: string }>(),
    ]);
    return { students, staff, accountsByStatus: Object.fromEntries(users.map((row) => [row.status, Number(row.count)])) };
  }
}
