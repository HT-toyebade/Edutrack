import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateStaffTable20261103000000 implements MigrationInterface {
  name = 'CreateStaffTable20261103000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "staff" (
        "id" SERIAL NOT NULL,
        "user_id" INTEGER NOT NULL,
        "firstName" VARCHAR(100) NOT NULL,
        "lastName" VARCHAR(100) NOT NULL,
        "phoneNumber" VARCHAR(30) NOT NULL,
        "department" VARCHAR(100) NOT NULL,
        "designation" VARCHAR(100) NOT NULL,
        CONSTRAINT "PK_staff_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_staff_user_id" UNIQUE ("user_id"),
        CONSTRAINT "FK_staff_user_id" FOREIGN KEY ("user_id")
          REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE NO ACTION
      )
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE "staff"');
  }
}
