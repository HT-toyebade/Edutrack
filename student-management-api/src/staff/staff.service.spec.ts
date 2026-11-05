import { ConflictException } from '@nestjs/common';
import { AccountStatus, AccountType, User } from '../users/entities/user.entity.js';
import { Staff } from './entities/staff.entity.js';
import { StaffService } from './staff.service.js';
import { User as UserEntity } from '../users/entities/user.entity.js';
import { Student } from '../student/entities/student.entity/student.entity.js';
import type { AuthenticatedUser } from '../auth/current-user.decorator.js';

describe('StaffService', () => {
  const staffRepository = { find: vi.fn(), findOne: vi.fn() };
  const userRepository = { findOne: vi.fn() };
  const invitations = { createFor: vi.fn() };
  const audit = { record: vi.fn().mockResolvedValue(undefined) };
  let service: StaffService;
  const actor: AuthenticatedUser = { userId: 1, email: 'admin@example.test', accountType: AccountType.SUPER_ADMIN, status: AccountStatus.ACTIVE };

  beforeEach(() => { vi.clearAllMocks(); service = new StaffService({} as never, invitations as never, audit as never, staffRepository as never, userRepository as never); });

  it('returns only the current Staff profile from the authenticated user ID', async () => {
    const user = { id: 2, email: 'staff@example.test', accountType: AccountType.STAFF, status: AccountStatus.ACTIVE } as User;
    staffRepository.findOne.mockResolvedValue({ id: 5, user, firstName: 'Ada', lastName: 'Okafor', phoneNumber: '000', department: 'Science', designation: 'Teacher' } as Staff);
    await expect(service.findMine({ ...actor, userId: 2, accountType: AccountType.STAFF })).resolves.toMatchObject({ userId: 2, status: AccountStatus.ACTIVE });
  });

  it('creates a pending Staff account and profile through the transaction manager', async () => {
    const userRepo = {
      findOne: vi.fn().mockResolvedValue(null),
      create: vi.fn((value) => value),
      save: vi.fn(async (value) => ({ id: 22, ...value })),
    };
    const staffRepo = {
      create: vi.fn((value) => value),
      save: vi.fn(async (value) => ({ id: 33, ...value })),
    };
    const studentRepo = { findOne: vi.fn().mockResolvedValue(null) };
    const manager = { getRepository: (entity: unknown) => entity === UserEntity ? userRepo : entity === Student ? studentRepo : staffRepo };
    const dataSource = { transaction: vi.fn(async (callback) => callback(manager)) };
    invitations.createFor.mockResolvedValue({ id: 7, expiresAt: new Date() });
    service = new StaffService(dataSource as never, invitations as never, audit as never, staffRepository as never, userRepository as never);
    const response = await service.create({ email: ' STAFF@example.test ', firstName: 'Ada', lastName: 'Okafor', phoneNumber: '000', department: 'Science', designation: 'Teacher' }, actor);
    expect(userRepo.save).toHaveBeenCalledWith(expect.objectContaining({ email: 'staff@example.test', accountType: AccountType.STAFF, status: AccountStatus.PENDING }));
    expect(invitations.createFor).toHaveBeenCalled();
    expect(response).toMatchObject({ userId: 22, id: 33, email: 'staff@example.test', status: AccountStatus.PENDING, invitation: { id: 7, status: 'pending_delivery' } });
  });

  it('rejects Staff creation when the email belongs to a legacy Student profile', async () => {
    const users = { findOne: vi.fn().mockResolvedValue(null), create: vi.fn(), save: vi.fn() };
    const students = { findOne: vi.fn().mockResolvedValue({ id: 4, user: null }) };
    const manager = { getRepository: (entity: unknown) => entity === UserEntity ? users : entity === Student ? students : {} };
    const dataSource = { transaction: vi.fn(async (callback) => callback(manager)) };
    service = new StaffService(dataSource as never, invitations as never, audit as never, staffRepository as never, userRepository as never);

    await expect(service.create({
      email: 'legacy@example.test', firstName: 'Ada', lastName: 'Okafor', phoneNumber: '000',
      department: 'Science', designation: 'Teacher',
    }, actor)).rejects.toBeInstanceOf(ConflictException);
    expect(users.save).not.toHaveBeenCalled();
    expect(invitations.createFor).not.toHaveBeenCalled();
  });
});
