# Database migration runbook

TypeORM `synchronize` remains disabled. Runtime and CLI data sources register the same ordered migrations and use `migrationsTransactionMode: each` so the PostgreSQL enum expansion commits separately from migrations that begin using the new label.

## Baseline behavior

`BaselineUsersStudents20261102000000` is the reproducible baseline for `users` and `students`.

- On an empty database, it creates the legacy User and Student schema.
- If both tables already exist, it verifies their columns, types, nullability, ID defaults, Student/Staff account enum labels, primary keys, email uniqueness, and absence of unexpected foreign keys. If they match, it performs no schema or row changes and TypeORM records the baseline as applied.
- If only one table exists, or schema verification fails, the migration throws before recording itself as applied. Resolve schema drift manually before retrying.
- The existing `CreateStaffTable20261103000000` migration remains in history and creates Staff after the baseline on new installations. Existing installations that already applied it keep that record; the baseline runs as a no-op verifier.

## Existing database adoption

1. Take a database backup and confirm the configured target is the intended non-production environment.
2. Review the current migration status with `npm run build` followed by `node --env-file-if-exists=.env ./node_modules/typeorm/cli.js migration:show -d dist/data-source.js`.
3. Inspect schema definitions and constraints independently. Do not rely only on table names or counts.
4. Run `npm run migration:run`. The baseline itself verifies the existing User/Student shape and aborts on mismatch. It does not recreate matching tables or assign/link any existing Student or User rows.
5. Verify migration history and data counts after the migration. In particular, verify each legacy Student remains present with `user_id IS NULL`, and all pre-existing Users remain present with unchanged account types.

Do not use this procedure against production until backup, schema review, and deployment approval are complete. Do not manually insert baseline migration rows; using the guarded baseline `up` ensures the verification executes before TypeORM records the migration.

## Fresh database

Create an empty database with the required privileges, configure its connection, build, then run `npm run migration:run`. The baseline creates Users/Students, the retained Staff migration creates Staff, and subsequent additive migrations introduce account lifecycle, invitation, outbox, Student linkage, and audit structures.

## Rollback

The baseline and lifecycle migrations are intentionally irreversible. Do not run `npm run migration:revert` for production recovery; it can remove foundational tables or violate historical retention. Prefer application rollback plus forward corrective migrations. Restore from a verified backup only under the database recovery procedure. Review each future migration's data impact and recovery plan before execution.

## Legacy data acceptance check

No migration assigns `students.user_id`. The three legacy Student records remain nullable and unlinked. The database migration should be followed by aggregate checks for total Student count, null `user_id` count, total User count, Staff migration history, and constraint/index presence. Never print individual student records during this verification.
