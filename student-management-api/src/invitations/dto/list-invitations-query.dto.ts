import { Transform, Type } from 'class-transformer';
import { IsEmail, IsEnum, IsInt, IsOptional, Max, Min } from 'class-validator';
import { AccountType } from '../../users/entities/user.entity.js';

export enum InvitationStatus {
  PENDING = 'pending',
  ACCEPTED = 'accepted',
  EXPIRED = 'expired',
  REVOKED = 'revoked',
}

export class ListInvitationsQueryDto {
  @IsOptional()
  @IsEnum(InvitationStatus)
  status?: InvitationStatus;

  @IsOptional()
  @IsEnum(AccountType)
  accountType?: AccountType;

  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail()
  email?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 25;
}
