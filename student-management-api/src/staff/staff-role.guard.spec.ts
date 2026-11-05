import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { AccountType } from '../users/entities/user.entity.js';
import { StaffRoleGuard } from './staff-role.guard.js';

describe('StaffRoleGuard', () => {
  const guard = new StaffRoleGuard();
  const makeContext = (accountType?: AccountType) =>
    ({
      switchToHttp: () => ({ getRequest: () => ({ user: { accountType } }) }),
    }) as ExecutionContext;

  it('allows staff accounts', () => {
    expect(guard.canActivate(makeContext(AccountType.STAFF))).toBe(true);
  });

  it('rejects student accounts', () => {
    expect(() => guard.canActivate(makeContext(AccountType.STUDENT))).toThrow(
      ForbiddenException,
    );
  });
});
