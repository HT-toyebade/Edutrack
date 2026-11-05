import { Controller, Get, Query, UseGuards, BadRequestException } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth/jwt-auth.guard.js';
import { Roles } from '../auth/roles.decorator.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { AccountType } from '../users/entities/user.entity.js';
import { AuditService } from './audit.service.js';

@Controller('audit-events')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(AccountType.SUPER_ADMIN)
export class AuditController {
  constructor(private readonly audit: AuditService) {}

  @Get()
  list(@Query('limit') limit?: string, @Query('beforeId') beforeId?: string) {
    const parsedLimit = limit ? Number(limit) : 100;
    const parsedBefore = beforeId === undefined ? undefined : Number(beforeId);
    if (parsedBefore !== undefined && (!Number.isInteger(parsedBefore) || parsedBefore < 1)) throw new BadRequestException('beforeId must be a positive integer.');
    return this.audit.list(Number.isInteger(parsedLimit) ? parsedLimit : 100, parsedBefore);
  }
}
