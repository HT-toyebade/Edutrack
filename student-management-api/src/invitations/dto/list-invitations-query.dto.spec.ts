import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { describe, expect, it } from 'vitest';
import { CreateStudentDto } from '../../students/dto/create-student.dto/create-student.dto.js';
import { CreateStaffDto } from '../../staff/dto/create-staff.dto.js';
import { UpdateOwnAccountDto } from '../../users/dto/update-own-account.dto.js';
import { ListInvitationsQueryDto } from './list-invitations-query.dto.js';

describe('Phase 1 input normalization', () => {
  it('trims and lowercases email consistently for Student, Staff, and own-account DTOs', async () => {
    const student = plainToInstance(CreateStudentDto, {
      firstName: ' Ada ',
      lastName: ' Lovelace ',
      email: ' ADA@EXAMPLE.TEST ',
    });
    const staff = plainToInstance(CreateStaffDto, {
      firstName: ' Grace ',
      lastName: ' Hopper ',
      email: ' GRACE@EXAMPLE.TEST ',
      phoneNumber: ' 123 ',
      department: ' CS ',
      designation: ' Lead ',
    });
    const ownAccount = plainToInstance(UpdateOwnAccountDto, {
      email: ' USER@EXAMPLE.TEST ',
    });

    expect([student.email, staff.email, ownAccount.email]).toEqual([
      'ada@example.test',
      'grace@example.test',
      'user@example.test',
    ]);
    expect(await validate(student)).toHaveLength(0);
    expect(await validate(staff)).toHaveLength(0);
    expect(await validate(ownAccount)).toHaveLength(0);
  });

  it('rejects whitespace-only required profile fields after trimming', async () => {
    const student = plainToInstance(CreateStudentDto, {
      firstName: '   ',
      lastName: 'Learner',
      email: 's@example.test',
    });
    const staff = plainToInstance(CreateStaffDto, {
      firstName: 'Grace',
      lastName: 'Hopper',
      email: 'g@example.test',
      phoneNumber: ' ',
      department: 'CS',
      designation: 'Lead',
    });
    expect(
      (await validate(student)).some((error) => error.property === 'firstName'),
    ).toBe(true);
    expect(
      (await validate(staff)).some((error) => error.property === 'phoneNumber'),
    ).toBe(true);
  });

  it('normalizes email filters and rejects invalid or out-of-range pagination', async () => {
    const query = plainToInstance(ListInvitationsQueryDto, {
      email: ' PERSON@EXAMPLE.TEST ',
      page: '2',
      limit: '100',
    });
    expect(query).toMatchObject({
      email: 'person@example.test',
      page: 2,
      limit: 100,
    });
    expect(await validate(query)).toHaveLength(0);
    const invalid = plainToInstance(ListInvitationsQueryDto, {
      page: '0',
      limit: '101',
    });
    expect(await validate(invalid)).not.toHaveLength(0);
  });
});
