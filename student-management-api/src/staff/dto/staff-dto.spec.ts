import 'reflect-metadata';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { CreateStaffDto } from './create-staff.dto.js';
import { UpdateStaffDto } from './update-staff.dto.js';

describe('Staff DTOs', () => {
  it('validates and transforms staff creation fields', async () => {
    const dto = plainToInstance(CreateStaffDto, {
      email: 'ada@example.test',
      firstName: 'Ada',
      lastName: 'Okafor',
      phoneNumber: '+2348000000000',
      department: 'Science',
      designation: 'Coordinator',
    });
    expect(await validate(dto)).toHaveLength(0);
    expect(dto.email).toBe('ada@example.test');
  });

  it('rejects invalid emails and missing required create fields', async () => {
    const dto = plainToInstance(CreateStaffDto, { email: 'not-an-email' });
    expect(await validate(dto)).not.toHaveLength(0);
  });

  it('does not allow changing the user relationship in updates', async () => {
    const dto = plainToInstance(UpdateStaffDto, {
      userId: 9,
      designation: 'Head',
    });
    const errors = await validate(dto, { whitelist: true });
    expect(errors).toHaveLength(0);
    expect(dto).not.toHaveProperty('userId');
  });
});
