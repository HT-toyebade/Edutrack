import { UnauthorizedException, ConflictException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { UsersService } from './users.service.js';
import { AccountStatus, AccountType } from './entities/user.entity.js';
import { User } from './entities/user.entity.js';
import { Student } from '../student/entities/student.entity/student.entity.js';
import { Staff } from '../staff/entities/staff.entity.js';

describe('UsersService', () => {
  const userRepository = { findOne: vi.fn() };
  const studentRepository = { findOne: vi.fn() };
  const staffRepository = { findOne: vi.fn() };
  const jwt = { signAsync: vi.fn().mockResolvedValue('signed-token') };
  const dataSource = { transaction: vi.fn() };
  const audit = { record: vi.fn() };
  let service: UsersService;
  const user = { id: 7, email: 'student@example.test', passwordHash: '', accountType: AccountType.STUDENT, status: AccountStatus.ACTIVE } as User;

  beforeEach(async () => {
    vi.clearAllMocks();
    user.status = AccountStatus.ACTIVE;
    user.accountType = AccountType.STUDENT;
    user.email = 'student@example.test';
    user.passwordHash = await bcrypt.hash('correct-password', 4);
    userRepository.findOne.mockResolvedValue(user);
    studentRepository.findOne.mockResolvedValue({ id: 1, user } as Student);
    staffRepository.findOne.mockResolvedValue({ id: 1, user } as Staff);
    service = new UsersService(userRepository as never, studentRepository as never, staffRepository as never, jwt as never, dataSource as never, audit as never);
  });

  it('accepts an active account with a required profile and signs only the subject claim', async () => {
    await expect(service.validateUser(user.email, 'correct-password')).resolves.toBe(user);
    await expect(service.generateAccessToken(user)).resolves.toBe('signed-token');
    expect(jwt.signAsync).toHaveBeenCalledWith({ sub: 7 });
  });

  it('returns the same authentication error for unknown user, wrong password, and inactive user', async () => {
    userRepository.findOne.mockResolvedValue(null);
    await expect(service.validateUser('missing@example.test', 'x')).rejects.toBeInstanceOf(UnauthorizedException);
    userRepository.findOne.mockResolvedValue(user);
    await expect(service.validateUser(user.email, 'wrong-password')).rejects.toBeInstanceOf(UnauthorizedException);
    user.status = AccountStatus.SUSPENDED;
    await expect(service.validateUser(user.email, 'correct-password')).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('blocks accounts that do not have the matching profile', async () => {
    studentRepository.findOne.mockResolvedValue(null);
    await expect(service.validateUser(user.email, 'correct-password')).rejects.toBeInstanceOf(ConflictException);
  });

  it('returns safe identity fields for the current account', async () => {
    await expect(service.findCurrentUser(user.id)).resolves.toEqual({ id: 7, email: user.email, accountType: user.accountType, status: user.status });
  });

  it('normalizes and synchronizes a Student own-email update in one transaction', async () => {
    const linkedProfile = { id: 1, user, email: user.email } as Student;
    const users = {
      findOne: vi.fn().mockResolvedValue(user),
      save: vi.fn().mockImplementation(async (record) => record),
    };
    const students = {
      findOne: vi.fn().mockImplementation(({ where }) => where.email ? null : linkedProfile),
      save: vi.fn().mockImplementation(async (record) => record),
    };
    const manager = { getRepository: (entity: unknown) => entity === User ? users : students };
    dataSource.transaction.mockImplementation(async (callback) => callback(manager));

    await expect(service.updateOwnEmail(user.id, ' NEW@EXAMPLE.TEST ')).resolves.toMatchObject({ email: 'new@example.test' });
    expect(user.email).toBe('new@example.test');
    expect(linkedProfile.email).toBe('new@example.test');
    expect(users.save).toHaveBeenCalledWith(user);
    expect(students.save).toHaveBeenCalledWith(linkedProfile);
  });

  it('rejects own-email changes that conflict with an unlinked legacy Student', async () => {
    const users = { findOne: vi.fn().mockResolvedValue(user), save: vi.fn() };
    const students = {
      findOne: vi.fn().mockResolvedValue({ id: 2, user: null, email: 'taken@example.test' }),
      save: vi.fn(),
    };
    const manager = { getRepository: (entity: unknown) => entity === User ? users : students };
    dataSource.transaction.mockImplementation(async (callback) => callback(manager));

    await expect(service.updateOwnEmail(user.id, 'taken@example.test')).rejects.toBeInstanceOf(ConflictException);
    expect(users.save).not.toHaveBeenCalled();
  });
});
