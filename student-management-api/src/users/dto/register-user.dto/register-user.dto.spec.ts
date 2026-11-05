import { validate } from 'class-validator';
import { RegisterUserDto } from './register-user.dto.js';

describe('RegisterUserDto', () => {
  it('strips an attempted staff role through the application whitelist policy', async () => {
    const dto = Object.assign(new RegisterUserDto(), {
      email: 'student@example.com',
      password: 'password8',
      accountType: 'staff',
    });
    const errors = await validate(dto, { whitelist: true });
    expect(errors).toHaveLength(0);
    expect(dto).not.toHaveProperty('accountType');
  });
});
