import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import * as bcrypt from 'bcrypt';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import request from 'supertest';
import { AppModule } from '../app.module.js';
import { AccountType, User } from '../users/entities/user.entity.js';
import { Staff } from './entities/staff.entity.js';

describe('Staff persistence against PostgreSQL (e2e)', () => {
  let app: INestApplication;
  let userRepository: Repository<User>;
  let staffRepository: Repository<Staff>;
  let temporaryUserId: number | undefined;
  let accessToken: string;
  const email = `staff-persistence-${randomUUID()}@example.test`;
  let testPasswordHash: string;

  afterAll(async () => {
    if (app) {
      if (temporaryUserId !== undefined) {
        const profile = await staffRepository.findOne({
          where: { user: { id: temporaryUserId } },
        });
        if (profile) await staffRepository.remove(profile);
        await userRepository.delete({ id: temporaryUserId });
      }
      await app.close();
    }
  });

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();

    userRepository = app.get<Repository<User>>(getRepositoryToken(User));
    staffRepository = app.get<Repository<Staff>>(getRepositoryToken(Staff));

    testPasswordHash = await bcrypt.hash(randomUUID(), 10);
    const user = await userRepository.save(
      userRepository.create({
        email,
        passwordHash: testPasswordHash,
        accountType: AccountType.STAFF,
      }),
    );
    temporaryUserId = user.id;
    accessToken = await app.get(JwtService).signAsync({
      sub: user.id,
      email: user.email,
      accountType: user.accountType,
    });
  });

  it('persists staff profiles, filters eligible users, and preserves the user on profile deletion', async () => {
    const authorization = `Bearer ${accessToken}`;
    const created = await request(app.getHttpServer())
      .post('/staff')
      .set('Authorization', authorization)
      .send({
        userId: temporaryUserId,
        firstName: 'Temporary',
        lastName: 'Staff',
        phoneNumber: '+2348000000099',
        department: 'E2E Test',
        designation: 'Temporary Tester',
      })
      .expect(201);

    const staffId = created.body.id as number;
    expect(created.body).toMatchObject({ userId: temporaryUserId, email });
    expect(JSON.stringify(created.body)).not.toContain(testPasswordHash);
    expect(await staffRepository.findOne({ where: { id: staffId } })).not.toBeNull();

    const eligible = await request(app.getHttpServer())
      .get('/staff/eligible-users')
      .set('Authorization', authorization)
      .expect(200);
    expect(eligible.body).not.toContainEqual(expect.objectContaining({ id: temporaryUserId }));
    expect(JSON.stringify(eligible.body)).not.toContain(testPasswordHash);

    await request(app.getHttpServer())
      .get(`/staff/${staffId}`)
      .set('Authorization', authorization)
      .expect(200)
      .expect(({ body }) => expect(body.email).toBe(email));

    await request(app.getHttpServer())
      .patch(`/staff/${staffId}`)
      .set('Authorization', authorization)
      .send({ designation: 'Updated Temporary Tester' })
      .expect(200)
      .expect(({ body }) => expect(body.designation).toBe('Updated Temporary Tester'));

    await request(app.getHttpServer())
      .delete(`/staff/${staffId}`)
      .set('Authorization', authorization)
      .expect(200);

    expect(await staffRepository.findOne({ where: { id: staffId } })).toBeNull();
    expect(await userRepository.findOne({ where: { id: temporaryUserId } })).not.toBeNull();
  });
});
