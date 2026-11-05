import { Body, Controller, Get, Param, ParseIntPipe, Post, Query } from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator.js';
import type { AuthenticatedUser } from '../auth/current-user.decorator.js';
import { InvitationsService } from './invitations.service.js';
import { AcceptInvitationDto } from './dto/accept-invitation.dto.js';
import { UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth/jwt-auth.guard.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { Roles } from '../auth/roles.decorator.js';
import { AccountType } from '../users/entities/user.entity.js';
import { ThrottlerGuard } from '@nestjs/throttler';
import { ListInvitationsQueryDto } from './dto/list-invitations-query.dto.js';

@Controller('invitations')
export class InvitationsController {
  constructor(private readonly invitations: InvitationsService) {}

  @Post('accept')
  @UseGuards(ThrottlerGuard)
  accept(@Body() dto: AcceptInvitationDto) { return this.invitations.accept(dto); }

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(AccountType.STAFF, AccountType.SUPER_ADMIN)
  list(@Query() query: ListInvitationsQueryDto, @CurrentUser() actor: AuthenticatedUser) {
    return this.invitations.list(query, actor);
  }

  @Post(':id/revoke')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(AccountType.STAFF, AccountType.SUPER_ADMIN)
  revoke(@Param('id', ParseIntPipe) id: number, @CurrentUser() actor: AuthenticatedUser) { return this.invitations.revoke(id, actor); }

  @Post(':id/resend')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(AccountType.STAFF, AccountType.SUPER_ADMIN)
  resend(@Param('id', ParseIntPipe) id: number, @CurrentUser() actor: AuthenticatedUser) { return this.invitations.resend(id, actor); }
}
