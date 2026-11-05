import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSuperAdminAccountType20261104000000 implements MigrationInterface {
  name = 'AddSuperAdminAccountType20261104000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TYPE "users_accounttype_enum" ADD VALUE IF NOT EXISTS 'super_admin'`);
  }

  async down(): Promise<void> {
    throw new Error('Removing an account type is unsafe; use a forward migration after account reconciliation.');
  }
}
