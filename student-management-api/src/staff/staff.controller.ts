import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth/jwt-auth.guard.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { Roles } from '../auth/roles.decorator.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import type { AuthenticatedUser } from '../auth/current-user.decorator.js';
import { AccountStatus, AccountType } from '../users/entities/user.entity.js';
import { UpdateAccountStatusDto } from '../users/dto/update-account-status.dto.js';
import { CreateStaffDto } from './dto/create-staff.dto.js';
import { UpdateStaffDto } from './dto/update-staff.dto.js';
import { StaffService } from './staff.service.js';

@Controller('staff')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(AccountType.SUPER_ADMIN)
export class StaffController {
  constructor(private readonly staffService: StaffService) {}

  @Post()
  create(@Body() dto: CreateStaffDto, @CurrentUser() actor: AuthenticatedUser) { return this.staffService.create(dto, actor); }

  @Get()
  findAll() { return this.staffService.findAll(); }

  @Get('me')
  @Roles(AccountType.STAFF, AccountType.SUPER_ADMIN)
  findMine(@CurrentUser() actor: AuthenticatedUser) { return this.staffService.findMine(actor); }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) { return this.staffService.findOne(id); }

  @Patch(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateStaffDto, @CurrentUser() actor: AuthenticatedUser) {
    return this.staffService.update(id, dto, actor);
  }

  @Patch(':id/status')
  setStatus(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateAccountStatusDto, @CurrentUser() actor: AuthenticatedUser) {
    return this.staffService.setStatus(id, dto.status as AccountStatus, dto.reason, actor);
  }
}
