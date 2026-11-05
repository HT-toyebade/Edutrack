import { SetMetadata } from '@nestjs/common';
import { AccountType } from '../users/entities/user.entity.js';

export const ROLES_KEY = 'required-roles';
export const Roles = (...roles: AccountType[]) => SetMetadata(ROLES_KEY, roles);
