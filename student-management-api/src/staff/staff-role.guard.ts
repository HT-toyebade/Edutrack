import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { AccountType } from '../users/entities/user.entity.js';

@Injectable()
export class StaffRoleGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<{
      user?: { accountType?: AccountType };
    }>();

    if (request.user?.accountType !== AccountType.STAFF) {
      throw new ForbiddenException('Staff account required');
    }

    return true;
  }
}
