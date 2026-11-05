import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Reproducible baseline for the pre-existing users/students schema.
 * On an empty database it creates both tables. On an existing database it
 * verifies the exact legacy shape and performs no DDL or data changes.
 */
export class BaselineUsersStudents20261102000000 implements MigrationInterface {
  name = 'BaselineUsersStudents20261102000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    const users = await queryRunner.hasTable('users');
    const students = await queryRunner.hasTable('students');
    if (users !== students) {
      throw new Error('Cannot baseline a partial users/students schema. Reconcile it manually.');
    }
    if (users && students) {
      await this.verifyExistingSchema(queryRunner);
      return;
    }

    await queryRunner.query(`CREATE TYPE "users_accounttype_enum" AS ENUM ('student', 'staff')`);
    await queryRunner.query(`CREATE TABLE "users" (
      "id" SERIAL NOT NULL,
      "email" CHARACTER VARYING NOT NULL,
      "passwordHash" CHARACTER VARYING NOT NULL,
      "accountType" "users_accounttype_enum" NOT NULL DEFAULT 'student',
      CONSTRAINT "PK_users_id" PRIMARY KEY ("id"),
      CONSTRAINT "UQ_users_email" UNIQUE ("email")
    )`);
    await queryRunner.query(`CREATE TABLE "students" (
      "id" SERIAL NOT NULL,
      "firstName" CHARACTER VARYING NOT NULL,
      "lastName" CHARACTER VARYING NOT NULL,
      "email" CHARACTER VARYING NOT NULL,
      CONSTRAINT "PK_students_id" PRIMARY KEY ("id"),
      CONSTRAINT "UQ_students_email" UNIQUE ("email")
    )`);
  }

  async down(): Promise<void> {
    // Baseline migrations are intentionally irreversible to protect existing data.
    throw new Error('The users/students baseline is irreversible; use a forward migration.');
  }

  private async verifyExistingSchema(queryRunner: QueryRunner): Promise<void> {
    const columns = await queryRunner.query(`
      SELECT table_name, column_name, data_type, udt_name, is_nullable, column_default, character_maximum_length
      FROM information_schema.columns
      WHERE table_schema = current_schema() AND table_name IN ('users', 'students')
      ORDER BY table_name, ordinal_position
    `) as Array<{ table_name: string; column_name: string; data_type: string; udt_name: string; is_nullable: string; column_default: string | null; character_maximum_length: number | null }>;
    const actual = columns.map((c) => `${c.table_name}.${c.column_name}:${c.data_type}:${c.udt_name}:${c.is_nullable}`).sort();
    const expected = [
      'students.email:character varying:varchar:NO',
      'students.firstName:character varying:varchar:NO',
      'students.id:integer:int4:NO',
      'students.lastName:character varying:varchar:NO',
      'users.accountType:USER-DEFINED:users_accounttype_enum:NO',
      'users.email:character varying:varchar:NO',
      'users.id:integer:int4:NO',
      'users.passwordHash:character varying:varchar:NO',
    ].sort();
    if (JSON.stringify(actual) !== JSON.stringify(expected)) {
      throw new Error('Existing users/students schema differs from the baseline; no migration changes were made.');
    }
    const defaultFor = (table: string, column: string) => columns.find((c) => c.table_name === table && c.column_name === column)?.column_default;
    if (!String(defaultFor('users', 'id')).includes('users_id_seq') ||
        !String(defaultFor('students', 'id')).includes('students_id_seq') ||
        !String(defaultFor('users', 'accountType')).includes('student')) {
      throw new Error('Existing users/students defaults differ from the baseline; no migration changes were made.');
    }
    const enumLabels = await queryRunner.query(`
      SELECT e.enumlabel FROM pg_enum e JOIN pg_type t ON t.oid=e.enumtypid
      WHERE t.typname='users_accounttype_enum' ORDER BY e.enumsortorder
    `) as Array<{ enumlabel: string }>;
    if (enumLabels.map((row) => row.enumlabel).join(',') !== 'student,staff') {
      throw new Error('Existing account type enum differs from the baseline; no migration changes were made.');
    }
    const constraints = await queryRunner.query(`
      SELECT conrelid::regclass::text AS table_name, contype, pg_get_constraintdef(oid, true) AS definition
      FROM pg_constraint WHERE conrelid IN ('users'::regclass, 'students'::regclass)
    `) as Array<{ table_name: string; contype: string; definition: string }>;
    const hasUserEmailUnique = constraints.some((c) => c.table_name === 'users' && c.contype === 'u' && c.definition.includes('(email)'));
    const hasStudentEmailUnique = constraints.some((c) => c.table_name === 'students' && c.contype === 'u' && c.definition.includes('(email)'));
    const hasPrimaryKeys = ['users', 'students'].every((name) => constraints.some((c) => c.table_name === name && c.contype === 'p' && c.definition.includes('(id)')));
    if (!hasUserEmailUnique || !hasStudentEmailUnique || !hasPrimaryKeys) {
      throw new Error('Existing users/students constraints differ from the baseline; no migration changes were made.');
    }
    if (constraints.some((c) => c.contype === 'f')) {
      throw new Error('Existing users/students foreign keys differ from the baseline; no migration changes were made.');
    }
  }
}
