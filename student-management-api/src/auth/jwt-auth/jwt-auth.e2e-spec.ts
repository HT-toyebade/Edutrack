import { INestApplication, Controller, Get, UseGuards } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { JwtModule, JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { JwtAuthGuard } from './jwt-auth.guard.js';
import { JwtStrategy } from '../jwt.strategy.js';

@Controller('protected-test')
@UseGuards(JwtAuthGuard)
class ProtectedTestController {
  @Get()
  getProtected() {
    return { ok: true };
  }
}

describe('JWT protected routes', () => {
  let app: INestApplication;
  let jwtService: JwtService;
  const secret = 'test-only-secret-with-adequate-length';

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [JwtModule.register({ secret })],
      controllers: [ProtectedTestController],
      providers: [
        JwtAuthGuard,
        JwtStrategy,
        { provide: ConfigService, useValue: { getOrThrow: () => secret } },
      ],
    }).compile();
    app = module.createNestApplication();
    await app.init();
    jwtService = module.get(JwtService);
  });

  afterAll(async () => app.close());

  it.each([undefined, 'Bearer malformed', 'Bearer invalid.signature.token'])(
    'rejects missing or malformed/invalid authorization: %s',
    async (authorization) => {
      const req = request(app.getHttpServer()).get('/protected-test');
      if (authorization) req.set('Authorization', authorization);
      await req.expect(401);
    },
  );

  it('accepts a valid Bearer token', async () => {
    const token = await jwtService.signAsync({ sub: 1, email: 's@example.com', accountType: 'student' });
    await request(app.getHttpServer())
      .get('/protected-test')
      .set('Authorization', `Bearer ${token}`)
      .expect(200)
      .expect({ ok: true });
  });

  it('rejects an expired token', async () => {
    const token = await jwtService.signAsync(
      { sub: 1, email: 's@example.com', accountType: 'student' },
      { expiresIn: -1 },
    );
    await request(app.getHttpServer())
      .get('/protected-test')
      .set('Authorization', `Bearer ${token}`)
      .expect(401);
  });
});
