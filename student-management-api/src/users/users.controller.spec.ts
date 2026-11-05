import { RequestMethod } from '@nestjs/common';
import { METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { UsersController } from './users.controller.js';
import { UsersService } from './users.service.js';

describe('UsersController', () => {
  const usersService = {
    validateUser: vi.fn(),
    generateAccessToken: vi.fn().mockResolvedValue('signed-token'),
    findCurrentUser: vi.fn(),
    updateOwnEmail: vi.fn(),
  };
  let controller: UsersController;

  beforeEach(() => { vi.clearAllMocks(); controller = new UsersController(usersService as unknown as UsersService); });

  it('exposes login but no public registration endpoint', () => {
    expect(Reflect.getMetadata(PATH_METADATA, UsersController)).toBe('users');
    expect(Reflect.getMetadata(PATH_METADATA, UsersController.prototype.login)).toBe('login');
    expect(Reflect.getMetadata(METHOD_METADATA, UsersController.prototype.login)).toBe(RequestMethod.POST);
    expect('register' in UsersController.prototype).toBe(false);
  });

  it('returns only public identity fields and the access token at login', async () => {
    const user = { id: 7, email: 'user@example.test', passwordHash: 'never-return-this', accountType: 'student' };
    usersService.validateUser.mockResolvedValue(user);
    await expect(controller.login({ email: user.email, password: 'fictional-password' })).resolves.toEqual({
      accessToken: 'signed-token', tokenType: 'Bearer', id: 7, email: user.email, accountType: 'student',
    });
  });
});
