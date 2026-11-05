import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import * as bcrypt from 'bcrypt';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import request from 'supertest';
import { AppModule } from '../app.module.js';
import { AccountType, User } from './entities/user.entity.js';

describe('Authentication persistence against PostgreSQL (e2e)', () => {
  let app: INestApplication;
  let userRepository: Repository<User>;
  const email = `auth-persistence-${randomUUID()}@example.test`;
  const password = `Temporary-${randomUUID()}-Password`;
  let temporaryUserId: number | undefined;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
    userRepository = app.get<Repository<User>>(getRepositoryToken(User));
  });

  afterAll(async () => {
    if (temporaryUserId !== undefined) {
      await userRepository.delete({ id: temporaryUserId });
    }
    await app?.close();
  });

  it('registers as student despite a role injection attempt, then logs in without exposing the hash', async () => {
    const registered = await request(app.getHttpServer())
      .post('/users/register')
      .send({ email, password, accountType: AccountType.STAFF })
      .expect(201);
    temporaryUserId = registered.body.id;

    expect(registered.body).toMatchObject({ email, accountType: AccountType.STUDENT });
    expect(registered.body).not.toHaveProperty('password');
    expect(registered.body).not.toHaveProperty('passwordHash');

    const user = await userRepository.findOne({ where: { email } });
    expect(user).not.toBeNull();
    expect(user!.id).toBe(temporaryUserId);
    expect(user!.accountType).toBe(AccountType.STUDENT);
    expect(user!.passwordHash).not.toBe(password);
    await expect(bcrypt.compare(password, user!.passwordHash)).resolves.toBe(true);

    const loggedIn = await request(app.getHttpServer())
      .post('/users/login')
      .send({ email, password })
      .expect(201);
    expect(loggedIn.body).toMatchObject({
      tokenType: 'Bearer',
      id: user!.id,
      email,
      accountType: AccountType.STUDENT,
    });
    expect(loggedIn.body.accessToken).toEqual(expect.any(String));
    expect(loggedIn.body).not.toHaveProperty('password');
    expect(loggedIn.body).not.toHaveProperty('passwordHash');

    await request(app.getHttpServer())
      .post('/users/login')
      .send({ email, password: `${password}-wrong` })
      .expect(401);
  });
});
