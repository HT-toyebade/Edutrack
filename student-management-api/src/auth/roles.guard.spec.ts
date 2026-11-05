import { ForbiddenException } from '@nestjs/common';
import { AccountType } from '../users/entities/user.entity.js';
import { RolesGuard } from './roles.guard.js';
import { ROLES_KEY } from './roles.decorator.js';

describe('RolesGuard', () => {
  const reflector = { getAllAndOverride: vi.fn() };
  const guard = new RolesGuard(reflector as never);
  const context = (accountType: AccountType) => ({
    getHandler: () => ({}), getClass: () => ({}),
    switchToHttp: () => ({ getRequest: () => ({ user: { accountType } }) }),
  }) as never;

  it('allows an explicitly permitted role', () => {
    reflector.getAllAndOverride.mockReturnValue([AccountType.SUPER_ADMIN]);
    expect(guard.canActivate(context(AccountType.SUPER_ADMIN))).toBe(true);
    expect(reflector.getAllAndOverride).toHaveBeenCalledWith(ROLES_KEY, expect.any(Array));
  });

  it('denies a role outside the route policy', () => {
    reflector.getAllAndOverride.mockReturnValue([AccountType.SUPER_ADMIN]);
    expect(() => guard.canActivate(context(AccountType.STAFF))).toThrow(ForbiddenException);
  });
});
