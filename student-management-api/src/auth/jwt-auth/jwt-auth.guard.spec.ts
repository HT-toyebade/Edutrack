import { JwtAuthGuard } from './jwt-auth.guard.js';
import { ExecutionContext, UnauthorizedException } from '@nestjs/common';

describe('JwtAuthGuard', () => {
  it('should be defined', () => {
    expect(new JwtAuthGuard()).toBeDefined();
  });

  it('rejects requests without an authenticated user', () => {
    const guard = new JwtAuthGuard();
    const context = {
      switchToHttp: () => ({ getRequest: () => ({ headers: {} }) }),
    } as ExecutionContext;
    expect(() => guard.handleRequest(null, null, null, context)).toThrow(
      UnauthorizedException,
    );
  });
});
