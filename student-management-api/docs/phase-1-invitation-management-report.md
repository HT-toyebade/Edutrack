# EduTrack Phase 1 Invitation Management and API Readiness

**Backend workspace:** `C:\Users\OyebadeToluwani\student-management-api`  
**Frontend workspace:** `C:\Users\OyebadeToluwani\edutrack-frontend` (not modified)  
**Contract:** [phase-1-api.md](./phase-1-api.md)  
**Readiness record:** [phase-1-api-readiness.md](./phase-1-api-readiness.md)

## 1. Summary

Implemented `GET /invitations` with bounded pagination, validated status/account-type/email filters, a token-free administrative projection, query-time expiry status, and database-enforced role/creator scoping. Tightened Staff invitation actions to invitations they created for Student accounts. Resend now clears the addressed token material, supersedes any other current outstanding invitation for the account, and creates the replacement in the same transaction.

Required profile text is trimmed before validation; email is normalized to lowercase. Student, Staff, and own-account email changes now check for email collisions across User and Student records in their write transactions. No schema migration was made, and no existing legacy Student row was linked, changed, or deleted.

## 2. Endpoint and response

### `GET /invitations`

- Authenticated active `super_admin` and `staff` only; Students receive `403`.
- Super Admin can list all invitations. Staff can list only Student invitations created by that Staff user.
- Optional filters: `status` (`pending|accepted|expired|revoked`), `accountType` (`super_admin|staff|student`), and case-insensitive exact `email`.
- Pagination: `page` defaults to `1`; `limit` defaults to `25` and is limited to `1..100`. Invalid query values return `400`.
- Results sort by creation time descending, then ID descending.
- Expired status is computed at read time; no background update is needed.
- Only administrative fields are selected. Raw token, digest, encrypted token, password and password hash are not returned.

```json
{
  "items": [{
    "id": 9,
    "email": "ada@example.test",
    "accountType": "student",
    "purpose": "account_activation",
    "createdAt": "2026-11-05T10:00:00.000Z",
    "expiresAt": "2026-11-07T10:00:00.000Z",
    "acceptedAt": null,
    "revokedAt": null,
    "status": "pending",
    "creator": { "id": 4, "email": "staff@example.test" }
  }],
  "total": 1,
  "page": 1,
  "limit": 25,
  "totalPages": 1
}
```

`creator` is `null` if creator information is unavailable. An empty result has `items: []`, `total: 0`, and `totalPages: 0`.

### Invitation status and actions

Status precedence is: `acceptedAt` set → `accepted`; otherwise `revokedAt` set → `revoked`; otherwise `expiresAt <= now` → `expired`; otherwise `pending`.

| Actor | List | Revoke/resend |
|---|---|---|
| Super Admin | All school invitations | All appropriate invitations |
| Staff | Student invitations created by that Staff user | Only those same invitations |
| Student | Forbidden | Forbidden |

`POST /invitations/accept` retains its existing row lock, digest validation, 48-hour expiry, account-pending check, transactional activation and single-use behavior. Tests cover rejection of expired, revoked and accepted invitations. Revoke rejects accepted invitations; resend requires a pending account. Resend revokes outstanding unaccepted/unexpired sibling invitations for the account and overwrites their encrypted delivery-token material with a sentinel before issuing the replacement. No token is written to response or application log by these paths.

## 3. Validation and email uniqueness

- Student and Staff create DTOs trim required text before validation; whitespace-only required fields fail.
- Student, Staff and own-account email inputs are trimmed and lowercased before validation. Service-level normalization remains in place for non-HTTP callers.
- Student creation/update checks User and Student emails. Staff creation/update checks User uniqueness plus Student email conflicts. Own-account email update checks Student conflicts and keeps a linked Student profile email synchronized.
- Existing unlinked legacy Students remain unlinked and unchanged.
- No global cross-table unique constraint or migration was added. Existing database conflicts were not inspected. Application checks are transactional but do not prevent races from independent database clients; a database-level guarantee requires a reviewed migration/data-cleanup plan.
- Empty PATCH objects remain accepted as no-op updates; this was outside the requested change.

## 4. Files changed

- `src/invitations/invitations.controller.ts` — protected list route and query DTO binding.
- `src/invitations/invitations.service.ts` — safe listing, derived statuses, Staff creator enforcement, resend invalidation and user-status locking.
- `src/invitations/dto/list-invitations-query.dto.ts` — filters, defaults and pagination validation.
- `src/invitations/invitations.service.spec.ts` — access, filtering, pagination, projection, resend and acceptance rejection tests.
- `src/invitations/dto/list-invitations-query.dto.spec.ts` — query validation and DTO normalization tests.
- `src/students/dto/create-student.dto/create-student.dto.ts`, `src/staff/dto/create-staff.dto.ts`, `src/users/dto/update-own-account.dto.ts` — trim/normalize before validation.
- `src/students/students.service.ts`, `src/staff/staff.service.ts`, `src/users/users.service.ts` — cross-table email conflict checks and normalized writes.
- `src/students/students.service.spec.ts`, `src/staff/staff.service.spec.ts` — email-conflict and creation tests.
- `docs/phase-1-api.md` — authoritative endpoint contract, permissions, schemas and validation behavior.
- `docs/phase-1-api-readiness.md` — updated inventory, resolved gaps, checks and remaining blockers.
- `docs/phase-1-invitation-management-report.md` — this report.

No dependency, configuration, migration, frontend or database file was changed for this task.

## 5. Verification

Final commands and results:

| Command | Result |
|---|---|
| `npm run lint` | **Passed**, exit 0. |
| `npx tsc --noEmit --incremental false -p tsconfig.build.json` | **Passed**, exit 0; no output, no build artifacts emitted. |
| `npx vitest run src/invitations/invitations.service.spec.ts src/invitations/dto/list-invitations-query.dto.spec.ts src/invitations/invitation-crypto.spec.ts src/staff/staff.service.spec.ts src/students/students.service.spec.ts src/users/users.service.spec.ts` | **Passed:** 6 files, 26 tests. No database or external email service used. |
| `npx prettier --write src/invitations/dto/list-invitations-query.dto.ts src/invitations/dto/list-invitations-query.dto.spec.ts src/invitations/invitations.service.spec.ts` | **Passed** for the three newly added TypeScript files. |
| `npx prettier --check src/invitations/dto/list-invitations-query.dto.ts src/invitations/dto/list-invitations-query.dto.spec.ts src/invitations/invitations.service.spec.ts` | **Passed:** all matched new files use Prettier style. |
| `git diff --check` | **Passed**; Git printed existing LF-to-CRLF working-copy warnings for other modified backend files. |
| Broad formatting check | **Failed:** Prettier reported formatting differences in 15 touched files. No broad rewrite was made to avoid unrelated formatting changes to existing files. |

The broad formatting command was:

```text
npx prettier --check src/invitations/invitations.controller.ts src/invitations/invitations.service.ts src/invitations/invitations.service.spec.ts src/invitations/dto/list-invitations-query.dto.ts src/invitations/dto/list-invitations-query.dto.spec.ts src/students/dto/create-student.dto/create-student.dto.ts src/staff/dto/create-staff.dto.ts src/students/students.service.ts src/students/students.service.spec.ts src/staff/staff.service.ts src/staff/staff.service.spec.ts src/users/users.service.ts src/users/dto/update-own-account.dto.ts docs/phase-1-api.md docs/phase-1-api-readiness.md
```

The first focused Vitest run had three test-double setup failures (20 tests); the mocks were corrected and the final run passed all 26 tests. The final successful command is listed above.

Not run:

- PostgreSQL-backed endpoint, integration or e2e tests; no approved disposable database was identified.
- Migration status inspection or migration execution.
- Build (would write `dist`); TypeScript no-emit check was used instead.
- SMTP, live HTTP or browser testing. No email was sent.

The invitation status SQL and ownership predicates have unit-level coverage, but actual generated SQL and PostgreSQL lock/transaction behavior remain unverified.

## 6. Remaining limitations and blockers

1. **Database verification:** Before database-backed tests, identify an approved disposable PostgreSQL instance and inspect its migration state. Do not use an unidentified or production database.
2. **Cross-table email uniqueness:** No schema constraint protects against concurrent independent writers, and existing cross-table conflicts were not scanned. A database-level guarantee needs migration/data review.
3. **Email delivery:** Outbox processing is not exercised; there is no outbox-status API. Delivery status remains unavailable to clients.
4. **Empty updates:** Empty PATCH requests remain accepted as no-op updates.
5. **Runtime contract:** Route guards, SQL, joins, pagination and transaction behavior were not exercised over HTTP/PostgreSQL.

## 7. Frontend integration decision

**Contract-driven frontend implementation may proceed** using `docs/phase-1-api.md`, including the invitation list and management permission rules. **Full backend/frontend integration is not yet verified or ready to declare complete** until the new query executes against an approved PostgreSQL environment and database-backed HTTP/e2e tests pass. Frontend files were not changed.
