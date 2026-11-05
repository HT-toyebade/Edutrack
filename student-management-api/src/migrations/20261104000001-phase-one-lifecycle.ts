import { MigrationInterface, QueryRunner } from 'typeorm';

export class PhaseOneLifecycle20261104000001 implements MigrationInterface {
  name = 'PhaseOneLifecycle20261104000001';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TYPE "users_status_enum" AS ENUM ('pending', 'active', 'inactive', 'suspended')`);
    await queryRunner.query(`ALTER TABLE "users" ADD "status" "users_status_enum" NOT NULL DEFAULT 'active'`);
    await queryRunner.query(`ALTER TABLE "users" ADD "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()`);
    await queryRunner.query(`ALTER TABLE "users" ADD "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()`);
    await queryRunner.query(`ALTER TABLE "students" ADD "user_id" INTEGER`);
    await queryRunner.query(`ALTER TABLE "students" ADD "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()`);
    await queryRunner.query(`ALTER TABLE "students" ADD "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()`);
    await queryRunner.query(`CREATE UNIQUE INDEX "UQ_students_user_id" ON "students" ("user_id")`);
    await queryRunner.query(`ALTER TABLE "students" ADD CONSTRAINT "FK_students_user_id" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
    await queryRunner.query(`ALTER TABLE "staff" ADD "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()`);
    await queryRunner.query(`ALTER TABLE "staff" ADD "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()`);

    await queryRunner.query(`CREATE TABLE "invitations" (
      "id" SERIAL NOT NULL,
      "user_id" INTEGER NOT NULL,
      "token_digest" VARCHAR(64) NOT NULL,
      "token_ciphertext" TEXT NOT NULL,
      "purpose" VARCHAR(32) NOT NULL,
      "expires_at" TIMESTAMPTZ NOT NULL,
      "accepted_at" TIMESTAMPTZ,
      "revoked_at" TIMESTAMPTZ,
      "created_by_user_id" INTEGER,
      "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
      CONSTRAINT "PK_invitations_id" PRIMARY KEY ("id"),
      CONSTRAINT "FK_invitations_user_id" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT
    )`);
    await queryRunner.query(`CREATE UNIQUE INDEX "UQ_invitations_token_digest" ON "invitations" ("token_digest")`);
    await queryRunner.query(`CREATE INDEX "IDX_invitations_user_id" ON "invitations" ("user_id")`);

    await queryRunner.query(`CREATE TABLE "audit_events" (
      "id" SERIAL NOT NULL,
      "actor_user_id" INTEGER,
      "action" VARCHAR(80) NOT NULL,
      "target_type" VARCHAR(40) NOT NULL,
      "target_id" INTEGER,
      "reason" TEXT,
      "changes" JSONB,
      "occurred_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
      CONSTRAINT "PK_audit_events_id" PRIMARY KEY ("id")
    )`);
    await queryRunner.query(`CREATE INDEX "IDX_audit_events_target" ON "audit_events" ("target_type", "target_id", "occurred_at")`);
    await queryRunner.query(`CREATE INDEX "IDX_audit_events_actor" ON "audit_events" ("actor_user_id", "occurred_at")`);
    await queryRunner.query(`CREATE FUNCTION "reject_audit_event_mutation"() RETURNS trigger AS $$ BEGIN RAISE EXCEPTION 'audit_events are append-only'; END; $$ LANGUAGE plpgsql`);
    await queryRunner.query(`CREATE TRIGGER "TR_audit_events_append_only" BEFORE UPDATE OR DELETE ON "audit_events" FOR EACH ROW EXECUTE FUNCTION "reject_audit_event_mutation"()`);

    await queryRunner.query(`CREATE TABLE "email_outbox" (
      "id" SERIAL NOT NULL,
      "kind" VARCHAR(120) NOT NULL,
      "recipient" VARCHAR NOT NULL,
      "template_data" JSONB NOT NULL,
      "status" VARCHAR(20) NOT NULL DEFAULT 'pending',
      "attempt_count" INTEGER NOT NULL DEFAULT 0,
      "next_attempt_at" TIMESTAMPTZ,
      "last_error_code" VARCHAR(80),
      "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
      "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
      CONSTRAINT "PK_email_outbox_id" PRIMARY KEY ("id"),
      CONSTRAINT "CHK_email_outbox_status" CHECK ("status" IN ('pending','processing','sent','failed'))
    )`);
    await queryRunner.query(`CREATE INDEX "IDX_email_outbox_pending" ON "email_outbox" ("status", "next_attempt_at", "id")`);
  }

  async down(): Promise<void> {
    throw new Error('Phase 1 account lifecycle migration is intentionally irreversible; use a forward migration.');
  }
}
