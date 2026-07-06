# Logging, Audit Logs, and Safe Errors

## Request logging

- Log request IDs.
- Log route, action, school ID, and actor ID when useful.
- Keep log fields structured.
- Prefer event names like `student.import.commit`, `scan.dry_run`, and `scan.import_failed`.

## Never log

- Passwords
- JWTs
- API secrets
- Payment secrets
- Raw file contents
- Raw OCR text unless it is scrubbed and truly needed
- Sensitive tenant data beyond what is needed for debugging

## Audit-required actions

- Login and token changes
- Student creation and updates where material
- Import dry-runs and commits
- Upload and extraction completion
- Report issue, approval, issuance, and release
- NFC scans, charges, fee holds, and reversals
- Permission or role changes

## Safe error behavior

- Production errors should be short and actionable.
- Do not expose stack traces in response bodies.
- Do not expose raw provider or database errors.
- Validation errors should be translated to stable codes and field details.
- A request ID should be returned with failures so support can trace the event.

## Audit log pattern

- `schoolId`
- `action`
- `correlationId`
- `details`
- `createdAt`

