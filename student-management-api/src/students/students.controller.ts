import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth/jwt-auth.guard.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { Roles } from '../auth/roles.decorator.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import type { AuthenticatedUser } from '../auth/current-user.decorator.js';
import { AccountStatus, AccountType } from '../users/entities/user.entity.js';
import { UpdateAccountStatusDto } from '../users/dto/update-account-status.dto.js';
import { CreateStudentDto } from './dto/create-student.dto/create-student.dto.js';
import { StudentsService } from './students.service.js';
import { UpdateStudentDto } from './dto/update-student.dto/update-student.dto.js';

@Controller('students')
@UseGuards(JwtAuthGuard, RolesGuard)
export class StudentsController {
  constructor(private readonly students: StudentsService) {}

  @Get('me')
  findMine(@CurrentUser() actor: AuthenticatedUser) { return this.students.findMine(actor); }

  @Post()
  @Roles(AccountType.STAFF, AccountType.SUPER_ADMIN)
  create(@Body() dto: CreateStudentDto, @CurrentUser() actor: AuthenticatedUser) { return this.students.createStudent(dto, actor); }

  @Get()
  @Roles(AccountType.STAFF, AccountType.SUPER_ADMIN)
  async findAll() { return { all: await this.students.findAll() }; }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number, @CurrentUser() actor: AuthenticatedUser) { return this.students.findOne(id, actor); }

  @Patch(':id')
  @Roles(AccountType.STAFF, AccountType.SUPER_ADMIN)
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateStudentDto, @CurrentUser() actor: AuthenticatedUser) {
    return this.students.updateStudent(id, dto, actor);
  }

  @Patch(':id/status')
  @Roles(AccountType.SUPER_ADMIN)
  setStatus(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateAccountStatusDto, @CurrentUser() actor: AuthenticatedUser) {
    return this.students.setStatus(id, { ...dto, status: dto.status as AccountStatus }, actor);
  }
}
