# EduTrack Phase 1 API Readiness

**Review date:** 2026-11-05  
**Backend workspace:** `C:\Users\OyebadeToluwani\student-management-api`  
**Frontend workspace:** `C:\Users\OyebadeToluwani\edutrack-frontend` (read-only inspection; no frontend files changed)  
**Authoritative contract:** `docs/phase-1-api.md`

## 1. Summary of contract changes

Replaced the abbreviated Phase 1 API overview with an implementation-based contract covering:

- Every production controller endpoint found in `src/`, including the root scaffold endpoint, plus explicitly unimplemented legacy/expected routes.
- Methods, route/path/query parameters, headers, role/access restrictions, DTO constraints, success status and JSON shape, and service/controller-derived error cases.
- Shared account/profile response types, status transitions, invitation lifecycle, audit pagination, dashboard counts, email delivery, legacy data behavior, and frontend compatibility.
- Explicit caveats where code does not provide a complete integration guarantee.

The handover report's important mismatches were rechecked against current code. In particular, Staff creation takes an email and profile fields; Student and Staff creation return direct profile objects extended with invitation metadata; `/staff/eligible-users` and delete routes do not exist; Student listing excludes the Student role; and audit history returns a raw array.

## 2. Complete endpoint inventory

HTTP result codes below describe Nest's default route status unless otherwise stated. Source inspection is not equivalent to executing the route.

| Method and route               | Purpose                                              | Authorization                              | Source                                                                            |
| ------------------------------ | ---------------------------------------------------- | ------------------------------------------ | --------------------------------------------------------------------------------- |
| `GET /`                        | Scaffold greeting, `"Hello World!"`                  | Public                                     | `src/app.controller.ts`                                                           |
| `POST /users/login`            | Authenticate and issue JWT; throttled                | Public                                     | `src/users/users.controller.ts`                                                   |
| `GET /users/me`                | Read current account                                 | Any active role                            | `src/users/users.controller.ts`                                                   |
| `PATCH /users/me`              | Change own email                                     | Any active role                            | `src/users/users.controller.ts`                                                   |
| `GET /students`                | List Student profiles                                | Staff, Super Admin                         | `src/students/students.controller.ts`                                             |
| `GET /students/me`             | Read profile linked to current user                  | Active JWT; profile lookup by user ID      | `src/students/students.controller.ts`                                             |
| `GET /students/:id`            | Read a Student profile                               | Staff/Super Admin any; Student owner only  | `src/students/students.controller.ts`, `StudentsService.assertMayRead`            |
| `POST /students`               | Create pending Student account/profile and invite    | Staff, Super Admin                         | `src/students/students.controller.ts`                                             |
| `PATCH /students/:id`          | Update Student profile                               | Staff, Super Admin                         | `src/students/students.controller.ts`                                             |
| `PATCH /students/:id/status`   | Change Student account status                        | Super Admin                                | `src/students/students.controller.ts`                                             |
| `GET /staff`                   | List Staff profiles                                  | Super Admin                                | `src/staff/staff.controller.ts`                                                   |
| `GET /staff/me`                | Read linked Staff profile                            | Staff, Super Admin                         | `src/staff/staff.controller.ts`                                                   |
| `GET /staff/:id`               | Read Staff profile                                   | Super Admin                                | `src/staff/staff.controller.ts`                                                   |
| `POST /staff`                  | Create pending Staff account/profile and invite      | Super Admin                                | `src/staff/staff.controller.ts`                                                   |
| `PATCH /staff/:id`             | Update Staff profile/account email                   | Super Admin                                | `src/staff/staff.controller.ts`                                                   |
| `PATCH /staff/:id/status`      | Change Staff account status                          | Super Admin                                | `src/staff/staff.controller.ts`                                                   |
| `GET /invitations`             | Filtered, paginated invitation metadata              | Super Admin; Staff-owned Student invites   | `src/invitations/invitations.controller.ts`, `InvitationsService.list`             |
| `POST /invitations/accept`     | Set password and activate invited account; throttled | Public with valid token                    | `src/invitations/invitations.controller.ts`                                       |
| `POST /invitations/:id/revoke` | Revoke invitation                                    | Super Admin any; Staff invitations they created for Students | `src/invitations/invitations.controller.ts`, `InvitationsService.assertCanManage` |
| `POST /invitations/:id/resend` | Revoke old invite and create replacement             | Super Admin any; Staff invitations they created for Students | `src/invitations/invitations.controller.ts`, `InvitationsService.assertCanManage` |
| `GET /dashboard/overview`      | Super Admin counts                                   | Super Admin                                | `src/admin/admin.controller.ts`                                                   |
| `GET /audit-events`            | Read audit events, cursor by ID                      | Super Admin                                | `src/audit/audit.controller.ts`                                                   |

### Explicitly not implemented

- `POST /users/register` (registration DTO exists but no controller route).
- `GET /staff/eligible-users` (frontend legacy route; no backend controller route).
- `DELETE /students/:id` and `DELETE /staff/:id` (no delete controller methods; consistent with Phase 1 no-permanent-delete requirement).
- Email-outbox delivery-status endpoint.
- Dashboard-summary endpoints for Staff or Students.
- Password-change/reset endpoint and account-type-change endpoint.
- API to link/reconcile a legacy Student record to a User.

## 3. Role and permission matrix

All authenticated access uses a valid Bearer JWT whose User, status, and account type are reloaded from the database for each request. Only active accounts pass authentication.

| Capability                                 | `super_admin`                                                        | `staff`                  | `student`                                             |
| ------------------------------------------ | -------------------------------------------------------------------- | ------------------------ | ----------------------------------------------------- |
| Login / current account / own email update | Yes                                                                  | Yes                      | Yes                                                   |
| Student directory `GET /students`          | Yes                                                                  | Yes                      | No (`403`)                                            |
| Read Student by ID                         | Any                                                                  | Any                      | Own linked Student only; other/unlinked Student `403` |
| `GET /students/me`                         | Route allowed; returns linked Student if one exists, otherwise `409` | Same                     | Own linked profile; `409` if missing                  |
| Create/update Student profile              | Yes                                                                  | Yes                      | No (`403`)                                            |
| Change Student status                      | Yes                                                                  | No (`403`)               | No (`403`)                                            |
| Staff directory/create/update/status       | Yes                                                                  | No (`403`)               | No (`403`)                                            |
| `GET /staff/me`                            | Route allowed; normally no Staff profile, so `409`                   | Own linked profile       | No (`403`)                                            |
| Accept invitation                          | Public token holder                                                  | Public token holder      | Public token holder                                   |
| List/revoke/resend invitations             | Any invitation; filters supported                                    | Only Student invitations created by that Staff user | No |
| Dashboard overview / audit history         | Yes                                                                  | No (`403`)               | No (`403`)                                            |

The role guard is applied per controller/handler, and invitation service checks target account type after route-level authorization. There is no client-controlled role claim used to grant access.

## 4. Request and response schema verification

### Verified against DTOs/services/controllers

- **Login:** `LoginUserDto`: email validated by `IsEmail`; password string, minimum 8. `201` `{accessToken, tokenType, id, email, accountType}`.
- **Own email:** `UpdateOwnAccountDto`: `{email}` validated as email. `200` account `{id,email,accountType,status}`. Student linked profile email is updated transactionally.
- **Student create:** `CreateStudentDto`: `{email,firstName,lastName}`; email validation, first/last string + `IsNotEmpty`, no maximum length. `201` direct Student object plus `invitation:{id,expiresAt,status}`. There is no `{message,student}` wrapper.
- **Student update:** Partial create DTO fields. `200` direct Student response.
- **Student status:** `{status,reason?}`. Status uses `AccountStatus`; reason optional string max 500, required nonblank for suspension. `200` `{id,userId,status}`.
- **Staff create:** `CreateStaffDto` requires `{email,firstName,lastName,phoneNumber,department,designation}`; lengths: first/last 100, phone 30, department/designation 100. It creates the User internally. `201` direct Staff object plus invitation metadata; no `userId` request.
- **Staff update:** Partial create DTO fields, `200` direct Staff object.
- **Staff status:** Same status/reason DTO and response shape as Student status.
- **Invitation accept:** `{token,password}`; token string, password string minimum 8. `201` `{id,email,accountType,status}`.
- **Invitation list:** `200` `{items,total,page,limit,totalPages}`. Each item contains `id,email,accountType,purpose,createdAt,expiresAt,acceptedAt,revokedAt,status,creator`; `creator` is null when unavailable. Tokens/digests/ciphertext/password data are not returned. Status is derived at query time; accepted takes precedence over revoked, revoked over expiry.
- **Invitation revoke:** `201` `{id,status:"revoked"}`. Already-revoked requests return same body. Accepted invitations return `409`.
- **Invitation resend:** `201` `{id,expiresAt,status:"pending_delivery"}` for the replacement. Previous row is revoked and its encrypted delivery token is cleared before a replacement is created in the same transaction.
- **Dashboard:** `200` `{students,staff,accountsByStatus}`; status buckets absent from grouped query are omitted, not zero-filled.
- **Audit:** `200` raw array of audit entity fields `{id,actorUserId,action,targetType,targetId,reason,changes,occurredAt}`. Descending ID; `limit` default 100 and service clamp 1–200; `beforeId` exclusive cursor. No other filters or cursor metadata.

The exact sample schemas and endpoint error/status inventory are in `docs/phase-1-api.md`.

### Response-shape and validation findings

1. **Legacy frontend response expectations:** Frontend Student create expects `{message, student}`; backend returns a Student object plus invitation. Frontend Staff create submits `userId`; backend requires email and creates the User. Recommended smallest safe correction: adapt frontend types/clients to the backend contract; do not add a legacy response wrapper or eligible-user flow unless the supervisor explicitly changes the API decision.
2. **Whitespace-only names/profile values — resolved in source:** Required text fields are trimmed before class-validator checks, so whitespace-only required values fail. Email values are trimmed and lowercased before validation.
3. **Empty PATCH bodies:** `PartialType` makes all properties optional and no DTO enforces at least one field. `{}` is accepted and still follows update/audit logic. Frontend should avoid sending empty updates; backend owner should decide whether to reject them.
4. **Audit `limit` parsing:** Invalid/non-integer values fall back to 100 rather than returning 400; integer values are clamped. This is implementation behavior, not strict validation.
5. **Status DTO:** `pending` is an enum-valid request value, but no transition from pending is allowed via status routes; service returns `400`.
6. **Creation invitation label:** `"pending_delivery"` is returned before asynchronous email processing completes. It is not a live outbox status and is not queryable later.
7. **Invitation management — implemented in source:** `GET /invitations` supports status/account-type/email filters and page/limit pagination; Super Admin is school-wide, Staff is restricted to their own created Student invitations. Listing returns an explicit safe projection. Revoke/resend now apply the same Staff creator rule, and resend overwrites the previous encrypted delivery token.
8. **Cross-table email uniqueness — application checks resolved; schema limitation remains:** Student and Staff creation and relevant Student/Staff/own-account email updates check both User and Student tables in transactions. No cross-table database constraint was introduced because that would require approved migration and existing-data review; concurrent independent writers can still race. Legacy Student rows are neither altered nor linked.

## 5. Error response conventions

No application exception filter or custom response mapper was found. Nest standard error responses use `statusCode`, `message`, and `error`; validation `message` can be an array. This was source-verified through default `ValidationPipe`/Nest exception usage, not HTTP integration-tested.

Per endpoint, documented likely errors follow controller pipes, guards, DTO validators, and explicit service exceptions. Unexpected persistence errors may surface as `500`. In particular:

- Invalid integer `:id` is `400`.
- Invalid `beforeId` is `400`; invalid `limit` does not fail.
- Wrong route role is `403`; Student ownership violation is `403`.
- Duplicate account/profile email and incomplete account profile are `409`.
- Invalid credentials, invalid/inactive JWT and unusable invitation are `401`.
- The app configures five requests per minute on login and invitation acceptance only; other routes do not explicitly apply the throttler guard.

## 6. Frontend integration mismatches

Frontend inspected read-only at `C:\Users\OyebadeToluwani\edutrack-frontend`; it has no `.git` directory, so file history/worktree state could not be verified.

| Frontend current assumption                                   | Backend contract                                                           | Consequence                                                                              |
| ------------------------------------------------------------- | -------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `AccountType = 'student'                                      | 'staff'`                                                                   | Includes `super_admin`                                                                   | Frontend rejects Super Admin login response. |
| Generic dashboard, Staff directory shown for Staff            | Staff directory is Super Admin-only; Student gets `/students/me`           | Staff receives `403`; Student's list fetch receives `403`; role dashboards are absent.   |
| Student create expects `{message,student}`                    | Direct Student profile with `userId`, status and invitation                | Client rejects successful response.                                                      |
| Staff create calls `/staff/eligible-users` and sends `userId` | That route is NOT IMPLEMENTED; `POST /staff` receives email/profile fields | Form cannot work against backend.                                                        |
| Student/Staff DTO types omit status/invitation                | Status returned; creates include invitation fields                         | Missing frontend state/types for account lifecycle.                                      |
| No invitation list/accept/revoke/resend calls                  | `GET /invitations` and accept/revoke/resend are implemented                 | Frontend invitation UI still needs implementing against the documented role restrictions. |
| No Super Admin dashboard service                              | `GET /dashboard/overview` exists                                           | Cannot render backend dashboard counts.                                                  |
| No audit API service                                          | `GET /audit-events` exists                                                 | Cannot display audit history.                                                            |
| Student and Staff delete controls call `DELETE`               | No delete routes; permanent deletion is out of Phase 1                     | Requests fail and controls conflict with scope.                                          |
| React Router package installed                                | No Router imports/usages found                                             | Dependency availability is not evidence that route protection/navigation is implemented. |

The contract now documents invitation listing and action ownership. Whitespace-only required profile values and email normalization have been corrected in source; empty PATCH objects remain accepted.

## 7. Implemented but unverified functionality

Source inspection shows code for:

- Database-backed JWT user/status/profile checks and role metadata guard.
- Student record ownership check in `StudentsService.findOne`.
- Transactional Student and Staff creation with profile, pending User, invitation, outbox row, and audit event.
- Transactional Student/Staff profile and status updates.
- Invitation digest (SHA-256), AES-256-GCM encrypted delivery token, 48-hour expiry, acceptance row lock, single-use acceptance, revoke, and resend.
- Filtered/paginated `GET /invitations`; explicit token-free projection; status derived at read time; Staff listing/action access restricted to invitations they created for Student accounts.
- Required profile text trimmed before validation; email normalization to lowercase; transactional application-level checks across User and Student tables for Student/Staff creation and profile/own-account email changes.
- Asynchronous SMTP outbox polling, retry/backoff, and terminal failed state.
- Audit event insertion in business transactions, Super Admin-only read endpoint, and append-only database trigger migration.
- Four migration classes and `synchronize: false`. Lifecycle migration adds a nullable Student `user_id` but performs no automatic account linking.

No database connection or migration status was queried. Source does not prove that the migration state, audit trigger, existing rows, SMTP provider, or outbox processor works in the target environment. There is no evidence here that the actual database contains exactly three legacy records or that all remain unlinked.

## 8. Missing or incomplete backend functionality

- Invitation detail-by-ID and email-outbox delivery-status endpoints remain absent. The list API is available for invitation management; delivery state cannot be queried.
- No invitation-specific authentication UI endpoint beyond token acceptance; frontend must provide the page and submit token/password.
- Empty PATCH body passes validation.
- Cross-table email checks are implemented in application transactions; there is no schema-level unique constraint, so concurrent writes via independent DB clients can race.
- `limit` query parsing silently defaults/clamps; no action/actor/date audit filters exist.
- No response DTO/OpenAPI schema documentation or generated OpenAPI output was found; `docs/phase-1-api.md` is manually maintained.
- No dedicated backend API exists for Staff/Student dashboard summaries, public registration, ordinary delete, or legacy Student linking (delete/public registration absence is intentional for Phase 1).
- API routes and database-dependent flows have not been HTTP/runtime verified.

## 9. Verification results

### Current invitation-management implementation checks

| Command | Result |
|---|---|
| `npm run lint` | **Passed**, exit 0. |
| `npx tsc --noEmit --incremental false -p tsconfig.build.json` | **Passed**, exit 0; no output and no build artifacts emitted. |
| `npx vitest run src/invitations/invitations.service.spec.ts src/invitations/dto/list-invitations-query.dto.spec.ts src/invitations/invitation-crypto.spec.ts src/staff/staff.service.spec.ts src/students/students.service.spec.ts src/users/users.service.spec.ts` | **Passed:** 6 files, 26 tests. These are unit tests and do not connect to a database. |
| `npx prettier --check` over all touched TypeScript/Markdown files | **Failed:** Prettier reported formatting differences in 15 touched files. Newly added TypeScript files were formatted; broad formatting was not applied to existing files to avoid unrelated rewrites. |
| PostgreSQL e2e/persistence tests, migration-status inspection | **Not run:** No approved disposable database was identified. No migration or database operation was performed. |
| SMTP/browser/live HTTP checks | **Not run:** No real email was sent and no service/browser was started. |

An initial run of the focused Vitest command had three test-double setup failures (20 tests total); after correcting the mocks and adding the action cases, the final run passed all 23 tests.

The following verification results are from the original API-contract audit, before the invitation-management implementation:

| Command                                                                                                                                                                                                                                                      | Result                                                                                                       |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------ |
| `npm run lint`                                                                                                                                                                                                                                               | **Passed**, exit 0 (`oxlint src/ test/`).                                                                    |
| `npx tsc --noEmit --incremental false -p tsconfig.build.json`                                                                                                                                                                                                | **Passed**, exit 0; no output. No build artifacts were emitted by this invocation.                           |
| `npx vitest run src/auth/roles.guard.spec.ts src/invitations/invitation-crypto.spec.ts src/users/dto/login-user.dto/login-user.dto.spec.ts src/staff/dto/staff-dto.spec.ts src/config/validate-environment.spec.ts src/auth/jwt-auth/jwt-auth.guard.spec.ts` | **Passed:** 6 files, 17 tests. These selected tests use unit/pure behavior and do not connect to a database. |
| Controller/service/API e2e tests                                                                                                                                                                                                                             | **Not run**                                                                                                  | E2E and persistence tests may use database/external state; no approved disposable DB was established. |
| `npm run build`                                                                                                                                                                                                                                              | **Not run**                                                                                                  | Writes `dist`; not needed for this documentation change.                                              |
| Migration status / migration execution                                                                                                                                                                                                                       | **Not run**                                                                                                  | No database target was identified; no migrations or DB reads were performed.                          |
| SMTP / browser / live HTTP test                                                                                                                                                                                                                              | **Not run**                                                                                                  | No email was sent and no service/browser was started.                                                 |

Vitest emitted a tooling notice that Vite natively supports TS path resolution and the existing `vite-tsconfig-paths` plugin may be removable. It did not affect the selected test results; no dependency/config change was made.

## 10. Remaining blockers and supervisor decisions

1. Establish an approved disposable PostgreSQL database and verify the current migration state before running database-backed HTTP/e2e tests. Do not run migrations against an unidentified target.
2. Empty PATCH objects remain accepted as no-op updates; decide whether this behavior should change.
3. Frontend must remove delete actions, align all role checks and response schemas, and replace the old Staff onboarding flow. Invitation UI can now target the documented list/action API but must still be implemented and integration-tested.
4. No direct agent activity log establishes the exact Codex stopping moment; this readiness assessment is code-state based.

## 11. Readiness decision

**Contract documentation:** Ready as the implementation-accurate backend reference; endpoint payloads should not need frontend guesswork.

**Backend API for full Phase 1 frontend integration:** **Not yet ready for end-to-end integration.** The invitation contract and application-level validation/authorization gaps are addressed in source, but route behavior, generated SQL, migrations, legacy-data state, email delivery, and transactional behavior have not been verified against an approved database. Cross-table email uniqueness is not schema-enforced. Frontend may implement against the contract, but must not claim integration readiness until database-backed tests pass.

**Frontend Codex:** The API contract is sufficiently explicit for implementation against `docs/phase-1-api.md`; frontend UI/client work may proceed. Defer claims of end-to-end integration readiness until database-backed route/migration verification is run against an approved disposable PostgreSQL environment. No frontend files were modified in this backend task.
