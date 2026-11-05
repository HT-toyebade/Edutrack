import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AccountType } from '../users/entities/user.entity.js';
import { ROLES_KEY } from './roles.decorator.js';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const roles = this.reflector.getAllAndOverride<AccountType[]>(ROLES_KEY, [
      context.getHandler(), context.getClass(),
    ]);
    if (!roles?.length) return true;
    const request = context.switchToHttp().getRequest<{ user?: { accountType?: AccountType } }>();
    if (!request.user?.accountType || !roles.includes(request.user.accountType)) {
      throw new ForbiddenException('Your account does not have permission to perform this action.');
    }
    return true;
  }
}
