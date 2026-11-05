import { validate } from 'class-validator';
import { LoginUserDto } from './login-user.dto.js';

describe('LoginUserDto', () => {
  it('accepts a valid email and a password of at least eight characters', async () => {
    const dto = Object.assign(new LoginUserDto(), {
      email: 'student@example.com',
      password: 'password8',
    });

    await expect(validate(dto)).resolves.toHaveLength(0);
  });

  it('rejects invalid emails and passwords shorter than eight characters', async () => {
    const dto = Object.assign(new LoginUserDto(), {
      email: 'not-an-email',
      password: 'short',
    });

    const errors = await validate(dto);
    const constraints = errors.flatMap((error) =>
      Object.keys(error.constraints ?? {}),
    );

    expect(constraints).toContain('isEmail');
    expect(constraints).toContain('minLength');
  });
});
