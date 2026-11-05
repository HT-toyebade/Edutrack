# EduTrack Phase 1 API Contract

**Contract basis:** This document describes the backend implementation in this workspace as inspected on 2026-11-05. It does not claim that migrations have been applied or that a deployed API has been runtime-tested. Where implementation details are inconsistent or incomplete, they are called out rather than inferred.

Base URL for local development: `http://localhost:3000`. The Vite development proxy may expose the same API under `/api`; `/api` is not a backend route prefix.

## Conventions and shared rules

### Headers and authentication

JSON request bodies use `Content-Type: application/json`. Authenticated requests must include:

```http
Authorization: Bearer <accessToken>
```

`POST /users/login` and `POST /invitations/accept` are public. All other Phase 1 endpoints require a valid Bearer JWT; `GET /` is a public scaffold route. JWTs expire after one hour. For each protected request, the JWT strategy loads the account from the database, requires `status: "active"`, and checks that Student/Staff accounts have their corresponding profile. Role authorization uses the database-loaded account type, not a role supplied by the client.

Only active accounts can log in or continue using an existing token. `pending`, `inactive`, and `suspended` accounts receive `401`; an active Student/Staff account missing its profile receives `409`. Status changes therefore take effect on the next protected request.

The login and invitation-acceptance handlers are throttled to five requests per 60-second throttler window. The configured response for excess requests is `429`.

### Account and profile response shapes

Account type is one of `super_admin`, `staff`, `student`; account status is one of `pending`, `active`, `inactive`, `suspended`.

Account identity:

```json
{
  "id": 12,
  "email": "ada@example.test",
  "accountType": "student",
  "status": "active"
}
```

Student profile (including legacy profiles with no linked account):

```json
{
  "id": 42,
  "userId": 12,
  "firstName": "Ada",
  "lastName": "Okafor",
  "email": "ada@example.test",
  "status": "active"
}
```

For an unlinked legacy Student, `userId` and `status` are `null`. Those rows remain in staff-visible directory results; they are not automatically linked to a User.

Staff profile:

```json
{
  "id": 8,
  "userId": 21,
  "email": "staff@example.test",
  "firstName": "Ada",
  "lastName": "Okafor",
  "phoneNumber": "+2348000000000",
  "department": "Science",
  "designation": "Coordinator",
  "status": "pending"
}
```

All shown IDs are JSON numbers. Dates are serialized as ISO-8601 strings. Fields shown in response schemas below are the fields explicitly returned by the service; entity timestamps and password hashes are not included.

### Error response convention

NestJS's default HTTP exception handler is used; there is no project-specific exception filter. Typical response:

```json
{
  "statusCode": 400,
  "message": "A descriptive message",
  "error": "Bad Request"
}
```

Validation errors use a `message` array of constraint strings, for example:

```json
{
  "statusCode": 400,
  "message": ["email must be an email"],
  "error": "Bad Request"
}
```

The usual status meanings in this API are:

| Status | Meaning                                                                                                                      |
| ------ | ---------------------------------------------------------------------------------------------------------------------------- |
| `400`  | DTO validation, invalid integer path parameter, invalid status transition, missing suspension reason, or invalid `beforeId`. |
| `401`  | Missing/invalid/expired JWT; inactive account; invalid login; invalid, expired, revoked or already-used invitation.          |
| `403`  | Role denied or a Student requests another Student's profile/invitation.                                                      |
| `404`  | Requested profile or invitation does not exist.                                                                              |
| `409`  | Duplicate email, incomplete account/profile setup, or invitation/account lifecycle conflict.                                 |
| `429`  | Throttler limit exceeded on login or invitation acceptance.                                                                  |
| `500`  | Unexpected/unmapped server or persistence error. Do not rely on an internal error message as a stable API contract.          |

An otherwise active Student/Staff User with no corresponding profile can receive `409` on any protected route: the JWT strategy performs this profile check before route authorization.

Unknown body properties are stripped by the global validation pipe (`whitelist: true`); they are not configured to produce an error. DTO validation runs with transformation enabled. `ParseIntPipe` rejects non-integer path IDs with `400`.

## Endpoint inventory

The backend controllers expose the routes below. `POST` routes use Nest's default success status `201`; `GET` and `PATCH` routes return `200`. The root `GET /` is the scaffold's `"Hello World!"` response, not a Phase 1 feature.

| Method and route               | Purpose                                               | Auth / permitted role                                  |
| ------------------------------ | ----------------------------------------------------- | ------------------------------------------------------ |
| `GET /`                        | Scaffold greeting                                     | Public                                                 |
| `POST /users/login`            | Sign in                                               | Public; throttled                                      |
| `GET /users/me`                | Read current account                                  | Any active role                                        |
| `PATCH /users/me`              | Change own email                                      | Any active role                                        |
| `GET /students`                | Student directory                                     | `staff`, `super_admin`                                 |
| `GET /students/me`             | Read the Student profile linked to current account    | Active JWT; intended for `student`                     |
| `GET /students/:id`            | Read one Student                                      | `staff`, `super_admin`; `student` only for own profile |
| `POST /students`               | Register Student account/profile and issue invitation | `staff`, `super_admin`                                 |
| `PATCH /students/:id`          | Update Student profile                                | `staff`, `super_admin`                                 |
| `PATCH /students/:id/status`   | Change linked Student account status                  | `super_admin`                                          |
| `GET /staff`                   | Staff directory                                       | `super_admin`                                          |
| `GET /staff/me`                | Read own Staff profile                                | `staff`, `super_admin`                                 |
| `GET /staff/:id`               | Read Staff profile                                    | `super_admin`                                          |
| `POST /staff`                  | Create Staff account/profile and issue invitation     | `super_admin`                                          |
| `PATCH /staff/:id`             | Update Staff profile/account email                    | `super_admin`                                          |
| `PATCH /staff/:id/status`      | Change linked Staff account status                    | `super_admin`                                          |
| `GET /invitations`             | List and filter invitations                         | `super_admin`; `staff` for Student invitations they created |
| `POST /invitations/accept`     | Set a password and activate an invited account        | Public; token required; throttled                      |
| `POST /invitations/:id/revoke` | Revoke an unused invitation                           | `super_admin`; `staff` for Student invitations they created |
| `POST /invitations/:id/resend` | Revoke old invitation and create replacement          | `super_admin`; `staff` for Student invitations they created |
| `GET /dashboard/overview`      | Super Admin dashboard counts                          | `super_admin`                                          |
| `GET /audit-events`            | Read audit events                                     | `super_admin`                                          |

There is **no** `POST /users/register`, `GET /staff/eligible-users`, `DELETE /students/:id`, `DELETE /staff/:id`, or invitation/outbox delivery-status endpoint. These are **NOT IMPLEMENTED**. The registration DTO files are not wired to a registration controller route.

### `GET /` (scaffold only)

- **Authentication/role:** None.
- **Headers:** None required.
- **Path/query/body:** None.
- **Success (`200`):** Plain string `Hello World!`.
- **Errors:** No application-specific errors are defined.

## Authentication and own account

### `POST /users/login`

Validates credentials and returns a one-hour JWT. Role information is not accepted from the request.

- **Authentication:** None.
- **Headers:** `Content-Type: application/json`.
- **Body:**

```json
{ "email": "ada@example.test", "password": "fictional-password" }
```

`email`: string accepted by `IsEmail`; `password`: string with minimum length 8. Email is trimmed and lower-cased for lookup.

- **Success (`201`):**

```json
{
  "accessToken": "<jwt>",
  "tokenType": "Bearer",
  "id": 12,
  "email": "ada@example.test",
  "accountType": "student"
}
```

- **Errors:** `400` validation; `401` unknown email, invalid password, or non-active account (same credential error); `409` a Student/Staff account has no corresponding profile; `429` throttled.
- **Lifecycle:** Only `active` accounts authenticate. Super Admin does not require a Student/Staff profile.

### `GET /users/me`

- **Authentication/role:** Bearer JWT; any active account type.
- **Headers:** `Authorization`.
- **Query/path/body:** None.
- **Success (`200`):** Account identity object described above.
- **Errors:** `401` missing/invalid/expired token or account no longer active; `409` active Student/Staff account is missing its profile.

### `PATCH /users/me`

Changes only the authenticated account's email. No password-change endpoint is implemented.

- **Authentication/role:** Bearer JWT; any active account type.
- **Headers:** `Authorization`, `Content-Type`.
- **Body:**

```json
{ "email": "new@example.test" }
```

`email`: string accepted by `IsEmail`. The service trims and lower-cases it. A linked Student profile's email is updated in the same transaction. Staff profile email is read through the linked User, so no separate Staff email column is updated.

- **Success (`200`):** Updated account identity object, including `status`.
- **Errors:** `400` invalid email; `401` invalid/non-active session; `409` email already registered or Student profile setup incomplete.
- **Uniqueness note:** Email is normalized to lowercase. The service checks for matching Student profile emails, including unlinked legacy rows, before changing a User email. There is no database-level cross-table unique constraint, so writes from independent clients may still race.

## Student endpoints

### `GET /students`

- **Purpose:** List all Student profiles, including unlinked legacy rows.
- **Authentication/roles:** Bearer JWT; `staff`, `super_admin`.
- **Query/path/body:** None.
- **Success (`200`):**

```json
{
  "all": [
    {
      "id": 42,
      "userId": 12,
      "firstName": "Ada",
      "lastName": "Okafor",
      "email": "ada@example.test",
      "status": "active"
    }
  ]
}
```

`all` is an array ordered by ascending profile ID. For unlinked legacy rows, `userId` and `status` are `null`.

- **Errors:** `401` invalid/non-active session; `403` Student role; `409` active Staff account missing its profile.

### `GET /students/me`

- **Purpose:** Read the profile whose linked User ID matches the authenticated account.
- **Authentication/role:** Bearer JWT. The controller does not add a role restriction; a Student uses this for their own profile. It is not a directory endpoint.
- **Headers:** `Authorization`.
- **Query/path/body:** None.
- **Success (`200`):** One Student profile object.
- **Errors:** `401` invalid/non-active session; `409` no Student profile linked to the authenticated user. This also applies if a Staff/Super Admin requests this route without a linked Student profile.

### `GET /students/:id`

- **Purpose:** Read one Student profile.
- **Authentication/roles:** Bearer JWT; Staff and Super Admin can read any Student; a Student can read only the profile linked to their own User ID. This ownership check is enforced in `StudentsService`.
- **Path:** `id` is parsed as an integer.
- **Query/body:** None.
- **Success (`200`):** One Student profile object.
- **Errors:** `400` non-integer ID; `401` invalid/non-active session; `403` Student attempts to read another or unlinked Student; `404` profile not found; `409` active Student/Staff account missing its own profile.

### `POST /students`

Creates a pending Student User and linked profile, a time-limited invitation, email-outbox work, and an audit event in one database transaction.

- **Authentication/roles:** Bearer JWT; `staff`, `super_admin`.
- **Headers:** `Authorization`, `Content-Type`.
- **Body:**

```json
{
  "email": "learner@example.test",
  "firstName": "Ada",
  "lastName": "Okafor"
}
```

`email`: valid email string, trimmed and lowercased before validation. `firstName` and `lastName`: non-empty after trimming; the DTO defines no maximum name length.

- **Success (`201`):** The implementation returns the profile object **directly**, extended with invitation metadata; it does not return a `{ "message": ..., "student": ... }` wrapper:

```json
{
  "id": 42,
  "userId": 12,
  "firstName": "Ada",
  "lastName": "Okafor",
  "email": "learner@example.test",
  "status": "pending",
  "invitation": {
    "id": 7,
    "expiresAt": "2026-11-07T10:00:00.000Z",
    "status": "pending_delivery"
  }
}
```

`pending_delivery` is the response label at creation time; delivery is asynchronous and the outbox may later send or fail. No raw token is returned.

- **Errors:** `400` invalid body; `401` invalid/non-active session; `403` Student role; `409` incomplete Staff account setup or duplicate email in User/Student records.

### `PATCH /students/:id`

Updates Student profile fields. For linked Students, changing email updates User and Student together in a transaction. Editing an unlinked legacy Student does not create/link an account.

- **Authentication/roles:** Bearer JWT; `staff`, `super_admin`. Students do not update this profile route; they may change their own email using `PATCH /users/me`.
- **Path:** `id` integer.
- **Headers:** `Authorization`, `Content-Type`.
- **Body:** Any subset of the create fields:

```json
{ "firstName": "Ada", "lastName": "Okafor", "email": "new@example.test" }
```

Each provided value has the same validation as the corresponding create field. An empty object is accepted by the current `PartialType` DTO and acts as a no-op update. Text values are trimmed before validation; email is trimmed and lowercased. Student profile email updates check both User and Student records, including unlinked legacy rows, while preserving the existing Student–User link.

- **Success (`200`):** Updated Student profile object, without invitation metadata.
- **Errors:** `400` invalid ID/body; `401` invalid/non-active session; `403` Student role; `404` profile not found; `409` incomplete Student/Staff account setup or duplicate email detected by the User/Student unique constraints.

### `PATCH /students/:id/status`

Changes the status of a linked Student account. An unlinked legacy Student has no account status to change.

- **Authentication/roles:** Bearer JWT; `super_admin` only.
- **Path:** `id` integer.
- **Headers:** `Authorization`, `Content-Type`.
- **Body:**

```json
{ "status": "suspended", "reason": "Fictional policy reason" }
```

`status`: one of the four account status strings. `reason`: optional string, maximum 500 characters; required and non-blank when setting `suspended`.

- **Success (`200`):**

```json
{ "id": 42, "userId": 12, "status": "suspended" }
```

- **Errors:** `400` invalid DTO/status transition, malformed ID, or missing suspension reason; `401` invalid/non-active session; `403` non-Super Admin; `404` missing profile or unlinked Student.

## Staff endpoints

### `GET /staff`

- **Authentication/roles:** Bearer JWT; `super_admin` only.
- **Query/path/body:** None.
- **Success (`200`):** Array of Staff profile objects, ordered by ascending ID. Each object has `id`, `userId`, `email`, `firstName`, `lastName`, `phoneNumber`, `department`, `designation`, and `status`.
- **Errors:** `401` invalid/non-active session; `403` Staff or Student role; `409` active Staff account missing its profile.

### `GET /staff/me`

- **Authentication/roles:** Bearer JWT; `staff`, `super_admin`.
- **Query/path/body:** None.
- **Success (`200`):** One Staff profile object.
- **Errors:** `401` invalid/non-active session; `403` Student role; `409` incomplete Staff account setup or no Staff profile linked to this account (normally the case for Super Admin).

### `GET /staff/:id`

- **Authentication/roles:** Bearer JWT; `super_admin` only.
- **Path:** `id` integer.
- **Query/body:** None.
- **Success (`200`):** One Staff profile object.
- **Errors:** `400` non-integer ID; `401` invalid/non-active session; `403` Staff or Student role; `404` profile not found; `409` active Student/Staff account missing its profile.

### `POST /staff`

Creates a pending Staff User and linked Staff profile, invitation, outbox task, and audit event transactionally. This API creates the User itself; it does not take a pre-existing `userId`.

- **Authentication/roles:** Bearer JWT; `super_admin` only.
- **Headers:** `Authorization`, `Content-Type`.
- **Body (all fields required):**

```json
{
  "email": "staff@example.test",
  "firstName": "Ada",
  "lastName": "Okafor",
  "phoneNumber": "+2348000000000",
  "department": "Science",
  "designation": "Coordinator"
}
```

`email`: valid email string, trimmed and lowercased before validation. `firstName`, `lastName`, `phoneNumber`, `department`, `designation`: non-empty after trimming; maximum lengths respectively 100, 100, 30, 100, 100.

- **Success (`201`):** Staff profile object directly, extended with:

```json
{
  "id": 8,
  "userId": 21,
  "email": "staff@example.test",
  "firstName": "Ada",
  "lastName": "Okafor",
  "phoneNumber": "+2348000000000",
  "department": "Science",
  "designation": "Coordinator",
  "status": "pending",
  "invitation": {
    "id": 9,
    "expiresAt": "2026-11-07T10:00:00.000Z",
    "status": "pending_delivery"
  }
}
```

- **Errors:** `400` validation; `401` invalid/non-active session; `403` Staff or Student role; `409` email already registered as a User or Student profile.
- **Uniqueness note:** This endpoint checks both User and Student profile emails and never links a legacy Student row. The schema does not provide a cross-table unique constraint.

### `PATCH /staff/:id`

Updates Staff profile and optionally the linked User email. There is no Staff self-edit endpoint; `PATCH /users/me` is the own-account email route.

- **Authentication/roles:** Bearer JWT; `super_admin` only.
- **Path:** `id` integer.
- **Headers:** `Authorization`, `Content-Type`.
- **Body:** Any subset of `email`, `firstName`, `lastName`, `phoneNumber`, `department`, `designation`, each with the create field's validation and length rules. Text is trimmed before validation; email is lowercased. Empty object is accepted as a no-op.
- **Success (`200`):** Updated Staff profile object (without invitation).
- **Errors:** `400` invalid ID/body; `401` invalid/non-active session; `403` Staff or Student role; `404` profile not found; `409` incomplete Student/Staff account setup or duplicate User/Student email.

### `PATCH /staff/:id/status`

- **Authentication/roles:** Bearer JWT; `super_admin` only.
- **Path:** `id` integer.
- **Headers:** `Authorization`, `Content-Type`.
- **Body:** Same status/reason schema and validation as `PATCH /students/:id/status`.
- **Success (`200`):** `{ "id": 8, "userId": 21, "status": "inactive" }`.
- **Errors:** `400` invalid DTO/status transition, malformed ID, or missing suspension reason; `401` invalid/non-active session; `403` Staff or Student role; `404` profile not found.

## Invitation endpoints

Invitations are created as part of successful Student/Staff creation. No separate invitation-create endpoint exists.

For all invitation management operations, Super Admin may manage invitations across the school. Staff may list, revoke, or resend only Student invitations whose `createdByUserId` matches the authenticated Staff user. Student users cannot use invitation-management endpoints. This creator check is enforced by service/query logic in addition to the route role guard.

### `GET /invitations`

- **Purpose:** List invitation metadata for account onboarding administration.
- **Authentication/roles:** Valid active JWT; `super_admin` can list school-wide invitations. `staff` can list only invitations for Student accounts created by that same Staff user. Student is forbidden.
- **Headers:** Authorization bearer token.
- **Query parameters:** All are optional. `status` is `pending|accepted|expired|revoked`; `accountType` is `super_admin|staff|student`; `email` is a case-insensitive exact recipient-email match (trimmed/lowercased); `page` is an integer >=1, default `1`; `limit` is an integer from 1 through 100, default `25`. Invalid values return `400`; values are rejected, not clamped.
- **Status derivation:** `acceptedAt != null` => `accepted`; otherwise `revokedAt != null` => `revoked`; otherwise `expiresAt <= current time` => `expired`; otherwise `pending`. Expiry is derived at read time and does not require a background database update.
- **Success (`200`):**

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

`items` contains only the fields shown. `creator` is `null` when the creator is not available. For an empty result, `items` is `[]`, `total` and `totalPages` are `0`. No raw token, token digest, encrypted delivery token, password, or password hash is selected or returned. Rows are ordered by `createdAt DESC`, then `id DESC`.

- **Errors:** `400` invalid query; `401` missing/invalid/non-active JWT; `403` Student or unauthorized role.
- **Ownership:** Staff restrictions are applied in the database query (`recipient.accountType=student` and `createdByUserId=current user ID`), not only in the UI. Super Admin filters are unrestricted by creator.

### `POST /invitations/accept`

- **Purpose:** Consume an invitation and set the invited account password.
- **Authentication/roles:** Public; token possession required.
- **Headers:** `Content-Type`.
- **Body:**

```json
{ "token": "<invitation-token>", "password": "fictional-password" }
```

`token`: string (the current DTO does not impose non-empty or maximum-length constraints). `password`: string, minimum length 8.

- **Success (`201`):** `{ "id": 12, "email": "ada@example.test", "accountType": "student", "status": "active" }`.
- **Errors:** `400` invalid body; `401` unknown, expired, revoked, or already accepted token; `409` invitation's account is no longer pending; `429` throttled.
- **Lifecycle:** Expiry is 48 hours after issuance. Acceptance transaction-locks the invitation row, hashes the new password, changes account `pending → active`, marks invitation accepted, and prevents reuse. Token digest is SHA-256; encrypted delivery token uses AES-256-GCM keyed from `JWT_SECRET`. Raw token is not returned by management responses.

### `POST /invitations/:id/revoke`

- **Purpose:** Revoke an unused invitation; does not change account status.
- **Authentication/roles:** Bearer JWT; `super_admin` for any account's invitation; `staff` only if the invitation belongs to a Student account. Students cannot manage invitations.
- **Path:** `id` integer.
- **Headers:** `Authorization`.
- **Query/body:** None.
- **Success (`201`):** `{ "id": 9, "status": "revoked" }`. Repeating a revoke on an already revoked invitation returns the same shape. The encrypted token is cleared on this path.
- **Errors:** `400` malformed ID; `401` invalid/non-active session; `403` wrong role or Staff targets a non-Student invitation; `404` invitation not found; `409` accepted invitation cannot be revoked.

### `POST /invitations/:id/resend`

- **Purpose:** Revoke the addressed invitation and issue a replacement with a new 48-hour expiry and outbox delivery task.
- **Authentication/roles:** Same role/target rules as revoke.
- **Path:** `id` integer.
- **Headers:** `Authorization`.
- **Query/body:** None.
- **Success (`201`):**

```json
{
  "id": 10,
  "expiresAt": "2026-11-07T10:00:00.000Z",
  "status": "pending_delivery"
}
```

- **Errors:** `400` malformed ID; `401` invalid/non-active session; `403` wrong role/target; `404` invitation not found; `409` invitation was accepted or account is not pending.
- **Note:** Implementation permits resending an already revoked/expired invitation if its account remains pending. The prior invitation is marked revoked; only the replacement can be accepted. Outbox delivery state is not exposed by an API.

## Account status lifecycle

Statuses are stored on User accounts. Only Super Admin may use status-update routes. Invitation acceptance is the only implemented `pending → active` operation; Super Admin status endpoints reject all transitions from `pending`.

| From        | To          | Permitted actor/path                                     | Additional rule                                  |
| ----------- | ----------- | -------------------------------------------------------- | ------------------------------------------------ |
| `pending`   | `active`    | Public invitation acceptance, `POST /invitations/accept` | Valid, unused, unexpired invitation required.    |
| `active`    | `inactive`  | Super Admin, Student or Staff status endpoint            | No reason required.                              |
| `active`    | `suspended` | Super Admin, Student or Staff status endpoint            | Non-blank `reason` required (maximum 500 chars). |
| `inactive`  | `active`    | Super Admin, Student or Staff status endpoint            | —                                                |
| `suspended` | `active`    | Super Admin, Student or Staff status endpoint            | —                                                |
| `suspended` | `inactive`  | Super Admin, Student or Staff status endpoint            | —                                                |

All other transitions, including `pending → inactive`, `pending → suspended`, and setting a status to its current value, return `400`. Inactive and suspended accounts cannot authenticate; previously issued JWTs are rejected on the next request.

## Super Admin dashboard

### `GET /dashboard/overview`

- **Purpose:** Counts for the Super Admin landing dashboard.
- **Authentication/roles:** Bearer JWT; `super_admin` only.
- **Query/path/body:** None.
- **Success (`200`):**

```json
{
  "students": 3,
  "staff": 2,
  "accountsByStatus": {
    "active": 4,
    "pending": 1
  }
}
```

Counts are integers. `students` and `staff` count profile rows, including unlinked legacy Student rows. `accountsByStatus` contains only status keys returned by the grouped database query; absent statuses are omitted rather than zero-filled.

- **Errors:** `401` invalid/non-active session; `403` Staff or Student role.
- A separate endpoint for Student/Staff dashboard summaries is **NOT IMPLEMENTED**.

## Audit history

### `GET /audit-events`

- **Purpose:** Read-only audit event history.
- **Authentication/roles:** Bearer JWT; `super_admin` only.
- **Headers:** `Authorization`.
- **Path/body:** None.
- **Query parameters:**
  - `limit` optional integer. Default `100`; service clamps numeric integers to `1..200`. Non-integer or non-numeric values silently use `100`.
  - `beforeId` optional positive integer. Returns events with `id < beforeId`; invalid/non-positive values return `400`.
  - No actor, action, target, or date filters are implemented.
- **Success (`200`):** A raw array (not an object with `items`/`nextCursor`), ordered by descending event ID and containing at most the effective limit:

```json
[
  {
    "id": 31,
    "actorUserId": 12,
    "action": "student.status_suspended",
    "targetType": "student",
    "targetId": 42,
    "reason": "Fictional policy reason",
    "changes": {
      "before": { "status": "active" },
      "after": { "status": "suspended" }
    },
    "occurredAt": "2026-11-05T09:00:00.000Z"
  }
]
```

`actorUserId`, `targetId`, `reason`, and `changes` may be `null`. `changes` is JSON and varies by action. To request an older page, pass an ID lower than the last event returned as `beforeId`; an empty array means no older events. There is no separate cursor metadata.

- **Errors:** `400` invalid `beforeId`; `401` invalid/non-active session; `403` Staff or Student role.
- **Limit edge behavior:** `limit=0` is clamped to 1; negative integers are clamped to 1; integers above 200 are clamped to 200. This is the service's current behavior, even though clients should send `1..200`.

## Email delivery and operational behavior

Student/Staff creation writes an invitation and email-outbox row in the same transaction as account/profile creation. The email processor sends asynchronously when SMTP is configured, retries delivery errors with backoff, and marks a task failed after six attempts. Missing SMTP leaves tasks pending. Email configuration uses `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, and `EMAIL_FROM`; `INVITATION_BASE_URL` optionally sets the frontend acceptance URL. No endpoint reads outbox state, and creation does not wait for email delivery.

Required profile strings are trimmed before DTO validation, so whitespace-only required fields fail validation. Email values are trimmed and lowercased before validation and persistence. Student/Staff creation and profile/own-account email mutations check for collisions in both User and Student tables, preserving unlinked legacy Students and never auto-linking them. These checks are application-level and run in write transactions; the schema has no cross-table unique constraint, so concurrent writes through independent database clients are not protected by a global uniqueness guarantee. No migration or existing-row cleanup was introduced.

## Legacy records and database contract

`students.user_id` is nullable and unique when non-null. The Phase 1 lifecycle migration adds this relation without assigning existing Student rows to Users. The migration source therefore does not automatically link legacy records; the actual row count, migration application, and data preservation require verification against an approved database. No API for manually linking legacy Student records is implemented.

TypeORM `synchronize` is disabled. See `docs/database-migrations.md` for the migration runbook. Do not run migrations against an unidentified or production database as part of frontend integration.

## Frontend integration contract notes

The backend login account type includes `super_admin`. `POST /students` returns the Student object plus `invitation` directly (not `{message, student}`). `POST /staff` accepts `email` and profile fields and creates its own User; `/staff/eligible-users` and a request `userId` are not part of this API. Student/Staff response fields include account `status`; the Student status is nullable for legacy unlinked rows. Staff directory management is Super Admin-only; Staff gets `GET /staff/me` and Student profiles through `/students/me`. Ordinary permanent-delete calls are not supported. Invitation acceptance, listing/actions, status management, Super Admin overview, and audit history endpoints are described above; outbox-status endpoints do not exist.

The smallest safe frontend compatibility correction is to align frontend API types and flows to these backend responses and role rules, rather than wrapping/changing successful backend responses to preserve the obsolete two-role CRUD contract. Do not implement until the supervisor approves this contract and the remaining response/validation caveats in `docs/phase-1-api-readiness.md`.
