# Database Data Protection Standard

SSAMENJ production databases contain client data and must be treated as high-value systems. Every project must separate environments, limit access, protect tenant boundaries, and prevent private data leakage through logs, exports, backups, and demos.

## Environment Separation

- Production, staging, development, and test databases must be separate.
- Never run tests, seed scripts, reset scripts, demo scripts, or local experiments against production.
- Test and development data must not contain real client data unless it has been anonymized and approved.
- Staging may use production-like structure, but production data copied into staging must be anonymized unless there is an approved incident-response or migration-validation reason.
- A production `DATABASE_URL` must not be used in local development except controlled read-only emergency access.

## Database URL Classes

Use separate credentials and environment variables by purpose:

- `APP_DATABASE_URL`: application runtime user with only the permissions needed by the app.
- `MIGRATION_DATABASE_URL`: migration/deploy user with schema-change permissions; use only in deployment/migration workflows.
- `READONLY_DATABASE_URL`: read-only investigation/reporting user with no write or schema-change permission.
- `ADMIN_DATABASE_URL`: break-glass only; time-bound, audited, and never used by normal app/runtime/dev workflows.

## Least Privilege

- Application users should not own the database or have broad admin permissions.
- Migration credentials should not be available to the browser, app client bundle, or normal runtime where avoidable.
- Read-only access should be preferred for investigation, support, reporting, and emergency local inspection.
- Break-glass/admin access must have an owner, reason, expiry, and review.

## Tenant Scope

- Every tenant-owned table must carry an enforceable `schoolId`, `tenantId`, `companyId`, or `propertyId`.
- Every tenant-owned query must filter by the token-derived tenant boundary.
- Request body tenant IDs are hints only; they must not override authenticated tenant context.
- Shared/platform-wide rows must be explicitly documented as shared.
- Cross-tenant uniqueness must never be global unless the entity is truly platform-owned.

## Database Access Logging

- Production DB access should be attributable to a human, deployment workflow, service, or break-glass event.
- Log deployment migrations, manual read-only sessions, break-glass sessions, and unusual administrative access.
- Logs must record actor, purpose, timestamp, environment, and request/change reference where practical.
- Do not log raw query results containing private client data.

## Private Data Classification

Classify stored fields and exports using these levels:

- `public`: safe for public pages and marketing content.
- `internal`: operational data visible only to authenticated staff or operators.
- `confidential`: client/student/parent/payment/business data requiring tenant-scoped access.
- `restricted`: secrets, credentials, payment secrets, full private records, raw uploaded contents, raw private OCR text, and incident-sensitive data.

## Logging Rules

Never log:

- Passwords.
- Tokens.
- `DATABASE_URL` values.
- Parent contacts.
- Full student records.
- Payment secrets.
- Uploaded file contents.
- Raw private OCR text.
- Raw provider payloads containing private client data.

Logs should use IDs, counts, statuses, safe error codes, redacted summaries, and request IDs.

## Export Rules

- Export permission is required for private or tenant-owned exports.
- Private exports must be audited with actor, tenant, export type, filters, row count, and request ID where practical.
- Exported files must preserve tenant scope and must not include other tenants' data.
- Spreadsheet exports must escape formula-like values.
- Production backup copies must not be used for demos unless anonymized.
- Demo and training datasets must use fake or anonymized data only.
