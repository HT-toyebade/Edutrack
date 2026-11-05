import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { AccountStatus, AccountType } from '../users/entities/user.entity.js';

export interface AuthenticatedUser {
  userId: number;
  email: string;
  accountType: AccountType;
  status: AccountStatus;
}

export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthenticatedUser =>
    context.switchToHttp().getRequest<{ user: AuthenticatedUser }>().user,
);
