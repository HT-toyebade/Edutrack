import { IsEnum, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { AccountStatus } from '../entities/user.entity.js';

export class UpdateAccountStatusDto {
  @IsEnum(AccountStatus)
  status: AccountStatus;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  reason?: string;
}
