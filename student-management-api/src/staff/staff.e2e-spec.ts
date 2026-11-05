import 'reflect-metadata';
import {
  INestApplication,
  ValidationPipe,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { getRepositoryToken } from '@nestjs/typeorm';
import request from 'supertest';
import { JwtAuthGuard } from '../auth/jwt-auth/jwt-auth.guard.js';
import { JwtStrategy } from '../auth/jwt.strategy.js';
import { AccountType, User } from '../users/entities/user.entity.js';
import { Staff } from './entities/staff.entity.js';
import { StaffController } from './staff.controller.js';
import { StaffRoleGuard } from './staff-role.guard.js';
import { StaffService } from './staff.service.js';

describe('Staff API (e2e)', () => {
  let app: INestApplication;
  let jwtService: JwtService;
  let staffToken: string;
  let studentToken: string;
  const secret = 'staff-e2e-test-secret-not-for-production';
  const passwordHashSentinel = 'test-only-password-hash-do-not-return';
  const users = new Map<number, User>();
  const profiles: Staff[] = [];
  let nextStaffId = 500;

  const staffRepository = {
    create: (values: Partial<Staff>) => values as Staff,
    save: async (profile: Staff) => {
      if (!profile.id) {
        profile.id = nextStaffId++;
        profiles.push(profile);
      }
      return profile;
    },
    find: async () => [...profiles].sort((a, b) => a.id - b.id),
    findOne: async (options: {
      where: { id?: number; user?: { id: number } };
    }) =>
      profiles.find((profile) =>
        options.where.id !== undefined
          ? profile.id === options.where.id
          : profile.user.id === options.where.user?.id,
      ) ?? null,
    remove: async (profile: Staff) => {
      const index = profiles.findIndex((item) => item.id === profile.id);
      if (index >= 0) profiles.splice(index, 1);
      return profile;
    },
  };

  const eligibleUsersQuery = {
    leftJoin: () => eligibleUsersQuery,
    where: () => eligibleUsersQuery,
    andWhere: () => eligibleUsersQuery,
    select: () => eligibleUsersQuery,
    addSelect: () => eligibleUsersQuery,
    orderBy: () => eligibleUsersQuery,
    getRawMany: async () =>
      [...users.values()]
        .filter(
          (user) =>
            user.accountType === AccountType.STAFF &&
            !profiles.some((profile) => profile.user.id === user.id),
        )
        .map(({ id, email }) => ({ id, email })),
  };

  const userRepository = {
    findOne: async (options: { where: { id: number } }) =>
      users.get(options.where.id) ?? null,
    createQueryBuilder: () => eligibleUsersQuery,
  };

  const profileBody = (userId: number) => ({
    userId,
    firstName: 'Ada',
    lastName: 'Okafor',
    phoneNumber: '+2348000000000',
    department: 'Science',
    designation: 'Coordinator',
  });

  const withBearer = (httpRequest: request.Test, token?: string) =>
    token ? httpRequest.set('Authorization', `Bearer ${token}`) : httpRequest;

  const endpointRequest = (
    method: 'POST' | 'GET' | 'PATCH' | 'DELETE',
    path: string,
    body?: object,
  ) => {
    const httpRequest =
      method === 'POST'
        ? request(app.getHttpServer()).post(path)
        : method === 'GET'
          ? request(app.getHttpServer()).get(path)
          : method === 'PATCH'
            ? request(app.getHttpServer()).patch(path)
            : request(app.getHttpServer()).delete(path);
    return body ? httpRequest.send(body) : httpRequest;
  };

  const staffEndpoints = () => [
    ['POST', '/staff', profileBody(41)],
    ['GET', '/staff'],
    ['GET', '/staff/eligible-users'],
    ['GET', '/staff/500'],
    ['PATCH', '/staff/500', { designation: 'Head' }],
    ['DELETE', '/staff/500'],
  ] as const;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [JwtModule.register({ secret })],
      controllers: [StaffController],
      providers: [
        StaffService,
        JwtAuthGuard,
        StaffRoleGuard,
        JwtStrategy,
        { provide: ConfigService, useValue: { getOrThrow: () => secret } },
        { provide: getRepositoryToken(Staff), useValue: staffRepository },
        { provide: getRepositoryToken(User), useValue: userRepository },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();

    jwtService = moduleRef.get(JwtService);
    staffToken = await jwtService.signAsync({
      sub: 41,
      email: 'staff-e2e@example.test',
      accountType: AccountType.STAFF,
    });
    studentToken = await jwtService.signAsync({
      sub: 42,
      email: 'student-e2e@example.test',
      accountType: AccountType.STUDENT,
    });
  });

  beforeEach(() => {
    profiles.splice(0, profiles.length);
    users.clear();
    nextStaffId = 500;
    users.set(41, {
      id: 41,
      email: 'staff-e2e@example.test',
      passwordHash: passwordHashSentinel,
      accountType: AccountType.STAFF,
    } as User);
    users.set(42, {
      id: 42,
      email: 'student-e2e@example.test',
      passwordHash: passwordHashSentinel,
      accountType: AccountType.STUDENT,
    } as User);
  });

  afterEach(() => {
    profiles.splice(0, profiles.length);
    users.clear();
  });

  afterAll(async () => app.close());

  it.each(staffEndpoints())('%s %s rejects missing and invalid JWTs', async (method, path, body) => {
    for (const token of [undefined, 'malformed.invalid.token']) {
      await withBearer(endpointRequest(method, path, body), token).expect(401);
    }
  });

  it.each(staffEndpoints())('%s %s rejects student JWTs', async (method, path, body) => {
    await withBearer(endpointRequest(method, path, body), studentToken).expect(403);
  });

  it('supports staff CRUD and never returns password hashes', async () => {
    const created = await withBearer(
      request(app.getHttpServer()).post('/staff').send(profileBody(41)),
      staffToken,
    ).expect(201);
    expect(created.body).toMatchObject({
      id: 500,
      userId: 41,
      email: 'staff-e2e@example.test',
      firstName: 'Ada',
      lastName: 'Okafor',
      department: 'Science',
      designation: 'Coordinator',
    });
    expect(JSON.stringify(created.body)).not.toContain(passwordHashSentinel);

    await withBearer(
      request(app.getHttpServer()).post('/staff').send(profileBody(41)),
      staffToken,
    ).expect(409);

    await withBearer(
      request(app.getHttpServer()).post('/staff').send(profileBody(42)),
      staffToken,
    ).expect(403);

    const listed = await withBearer(
      request(app.getHttpServer()).get('/staff'),
      staffToken,
    ).expect(200);
    expect(listed.body).toHaveLength(1);
    expect(JSON.stringify(listed.body)).not.toContain(passwordHashSentinel);

    const fetched = await withBearer(
      request(app.getHttpServer()).get('/staff/500'),
      staffToken,
    ).expect(200);
    expect(fetched.body.id).toBe(500);
    expect(JSON.stringify(fetched.body)).not.toContain(passwordHashSentinel);

    const updated = await withBearer(
      request(app.getHttpServer()).patch('/staff/500').send({
        designation: 'Department Head',
      }),
      staffToken,
    ).expect(200);
    expect(updated.body.designation).toBe('Department Head');
    expect(JSON.stringify(updated.body)).not.toContain(passwordHashSentinel);

    await withBearer(
      request(app.getHttpServer()).delete('/staff/500'),
      staffToken,
    ).expect(200);
    expect(profiles).toHaveLength(0);
  });

  it('returns only eligible staff account IDs and emails to staff users', async () => {
    const profiledStaffUser = {
      id: 43,
      email: 'profiled-staff-e2e@example.test',
      passwordHash: passwordHashSentinel,
      accountType: AccountType.STAFF,
    } as User;
    users.set(profiledStaffUser.id, profiledStaffUser);
    profiles.push({
      id: 499,
      user: profiledStaffUser,
      firstName: 'Already',
      lastName: 'Profiled',
      phoneNumber: '+2348000000001',
      department: 'Science',
      designation: 'Teacher',
    } as Staff);

    const response = await withBearer(
      request(app.getHttpServer()).get('/staff/eligible-users'),
      staffToken,
    ).expect(200);

    expect(response.body).toEqual([
      { id: 41, email: 'staff-e2e@example.test' },
    ]);
    expect(JSON.stringify(response.body)).not.toContain('passwordHash');
    expect(JSON.stringify(response.body)).not.toContain(passwordHashSentinel);
    expect(response.body).not.toContainEqual(
      expect.objectContaining({ id: 42, email: 'student-e2e@example.test' }),
    );
    expect(response.body).not.toContainEqual(
      expect.objectContaining({ id: 43, email: profiledStaffUser.email }),
    );
  });

  it('returns 404 for missing staff profiles on fetch, update, and delete', async () => {
    await withBearer(
      request(app.getHttpServer()).get('/staff/999'),
      staffToken,
    ).expect(404);
    await withBearer(
      request(app.getHttpServer()).patch('/staff/999').send({ designation: 'Head' }),
      staffToken,
    ).expect(404);
    await withBearer(
      request(app.getHttpServer()).delete('/staff/999'),
      staffToken,
    ).expect(404);
  });
});
