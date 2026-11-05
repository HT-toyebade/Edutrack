import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import * as bcrypt from 'bcrypt';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import request from 'supertest';
import { AccountType, User } from '../users/entities/user.entity.js';
import { AppModule } from '../app.module.js';
import { Student } from '../student/entities/student.entity/student.entity.js';

describe('Student CRUD API against PostgreSQL (e2e)', () => {
  let app: INestApplication;
  let studentRepository: Repository<Student>;
  let userRepository: Repository<User>;
  let studentAccessToken: string;
  let staffAccessToken: string;
  const temporaryUserIds: number[] = [];
  const createdStudentIds: number[] = [];
  const emailPrefix = `student-crud-e2e-${randomUUID()}`;

  const studentInput = (suffix: string) => ({
    firstName: 'Test',
    lastName: 'Student',
    email: `${emailPrefix}-${suffix}@example.test`,
  });

  const authenticated = (testRequest: request.Test, token: string) =>
    testRequest.set('Authorization', `Bearer ${token}`);

  const withOptionalToken = (testRequest: request.Test, token?: string) =>
    token ? authenticated(testRequest, token) : testRequest;

  async function recordCreatedStudent(response: request.Response) {
    const id = response.body?.student?.id;
    if (typeof id === 'number') createdStudentIds.push(id);
    return id as number | undefined;
  }

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = module.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();

    studentRepository = app.get<Repository<Student>>(getRepositoryToken(Student));
    userRepository = app.get<Repository<User>>(getRepositoryToken(User));

    const studentEmail = `${emailPrefix}-student-user@example.test`;
    const staffEmail = `${emailPrefix}-staff-user@example.test`;
    const studentUser = await userRepository.save(
      userRepository.create({
        email: studentEmail,
        passwordHash: await bcrypt.hash(randomUUID(), 10),
        accountType: AccountType.STUDENT,
      }),
    );
    temporaryUserIds.push(studentUser.id);
    const staffUser = await userRepository.save(
      userRepository.create({
        email: staffEmail,
        passwordHash: await bcrypt.hash(randomUUID(), 10),
        accountType: AccountType.STAFF,
      }),
    );
    temporaryUserIds.push(staffUser.id);
    const jwtService = app.get(JwtService);
    studentAccessToken = await jwtService.signAsync({
      sub: studentUser.id,
      email: studentUser.email,
      accountType: studentUser.accountType,
    });
    staffAccessToken = await jwtService.signAsync({
      sub: staffUser.id,
      email: staffUser.email,
      accountType: staffUser.accountType,
    });
  });

  afterAll(async () => {
    if (app) {
      for (const id of createdStudentIds) {
        await studentRepository.delete({ id });
      }
      for (const id of temporaryUserIds) {
        await userRepository.delete({ id });
      }
      await app.close();
    }
  });

  it('validates input and completes student create, list, read, update, and delete', async () => {
    const protectedRouteFactories = [
      () => request(app.getHttpServer()).get('/students'),
      () => request(app.getHttpServer()).get('/students/2147483647'),
      () => request(app.getHttpServer()).post('/students').send(studentInput('unauthenticated')),
      () => request(app.getHttpServer()).patch('/students/2147483647').send({ firstName: 'Missing' }),
      () => request(app.getHttpServer()).delete('/students/2147483647'),
    ];
    for (const createRoute of protectedRouteFactories) {
      await withOptionalToken(createRoute()).expect(401);
    }
    for (const createRoute of protectedRouteFactories) {
      await withOptionalToken(createRoute(), 'malformed.invalid.jwt').expect(401);
    }

    await authenticated(
      request(app.getHttpServer()).post('/students').send({
        firstName: '',
        lastName: 'Student',
        email: 'not-an-email',
      }),
      staffAccessToken,
    ).expect(400);

    const firstInput = studentInput('first');
    const created = await authenticated(
      request(app.getHttpServer()).post('/students').send(firstInput),
      staffAccessToken,
    ).expect(201);
    const studentId = await recordCreatedStudent(created);
    expect(studentId).toEqual(expect.any(Number));
    expect(created.body.student).toMatchObject(firstInput);

    const duplicate = await authenticated(
      request(app.getHttpServer()).post('/students').send(firstInput),
      staffAccessToken,
    ).expect(409);
    expect(duplicate.body.message).toContain('email already exists');

    const secondInput = studentInput('second');
    const second = await authenticated(
      request(app.getHttpServer()).post('/students').send(secondInput),
      staffAccessToken,
    ).expect(201);
    const secondStudentId = await recordCreatedStudent(second);
    expect(secondStudentId).toEqual(expect.any(Number));

    const list = await authenticated(
      request(app.getHttpServer()).get('/students'),
      studentAccessToken,
    ).expect(200);
    expect(list.body.all).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: studentId, email: firstInput.email }),
        expect.objectContaining({ id: secondStudentId, email: secondInput.email }),
      ]),
    );

    const staffList = await authenticated(
      request(app.getHttpServer()).get('/students'),
      staffAccessToken,
    ).expect(200);
    expect(staffList.body.all).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: studentId, email: firstInput.email }),
        expect.objectContaining({ id: secondStudentId, email: secondInput.email }),
      ]),
    );

    await authenticated(
      request(app.getHttpServer()).get(`/students/${studentId}`),
      studentAccessToken,
    )
      .expect(200)
      .expect(({ body }) => {
        expect(body).toMatchObject({ id: studentId, ...firstInput });
      });

    await authenticated(
      request(app.getHttpServer()).get(`/students/${studentId}`),
      staffAccessToken,
    )
      .expect(200)
      .expect(({ body }) => {
        expect(body).toMatchObject({ id: studentId, ...firstInput });
      });

    await authenticated(
      request(app.getHttpServer())
        .patch(`/students/${studentId}`)
        .send({ email: secondInput.email }),
      staffAccessToken,
    ).expect(409);

    await authenticated(
      request(app.getHttpServer())
        .patch(`/students/${studentId}`)
        .send({ firstName: 'Updated' }),
      staffAccessToken,
    )
      .expect(200)
      .expect(({ body }) => {
        expect(body).toMatchObject({
          id: studentId,
          firstName: 'Updated',
          lastName: firstInput.lastName,
          email: firstInput.email,
        });
      });

    await authenticated(
      request(app.getHttpServer())
        .patch(`/students/${studentId}`)
        .send({ email: 'invalid-email' }),
      staffAccessToken,
    ).expect(400);

    await authenticated(
      request(app.getHttpServer()).get('/students/2147483647'),
      studentAccessToken,
    ).expect(404);
    await authenticated(
      request(app.getHttpServer()).patch('/students/2147483647').send({ firstName: 'Missing' }),
      staffAccessToken,
    ).expect(404);
    await authenticated(
      request(app.getHttpServer()).delete('/students/2147483647'),
      staffAccessToken,
    ).expect(404);

    await authenticated(
      request(app.getHttpServer()).post('/students').send(studentInput('student-write-denied')),
      studentAccessToken,
    ).expect(403);
    await authenticated(
      request(app.getHttpServer()).patch(`/students/${studentId}`).send({ firstName: 'Forbidden' }),
      studentAccessToken,
    ).expect(403);
    await authenticated(
      request(app.getHttpServer()).delete(`/students/${studentId}`),
      studentAccessToken,
    ).expect(403);

    await authenticated(
      request(app.getHttpServer()).delete(`/students/${studentId}`),
      staffAccessToken,
    ).expect(200);
    await authenticated(
      request(app.getHttpServer()).get(`/students/${studentId}`),
      studentAccessToken,
    ).expect(404);

    await authenticated(
      request(app.getHttpServer()).delete(`/students/${secondStudentId}`),
      staffAccessToken,
    ).expect(200);
  });
});
