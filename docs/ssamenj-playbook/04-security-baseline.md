# Security Baseline

Every SSAMENJ project should start with this security baseline.

## What Report Lab already does

- Protected routes are gated by `resolveSchoolContext` and `enforceSchoolRoleAccess`.
- Production requests without valid tenant context return `401`.
- Cross-tenant mismatch between the JWT school and request schoolCode returns `403`.
- Upload flows validate empty files, MIME types, extensions, and file signatures where possible.
- Audit logs already exist for sensitive import actions and several NFC/report actions.

## Required baseline

- Auth required on protected routes.
- Role and permission checks for every sensitive route.
- Tenant isolation on every tenant-owned query and write.
- Rate limiting on login, upload, import, and public token endpoints.
- Safe CORS with explicit allow-listing.
- Secure headers via a dedicated middleware layer.
- Safe error messages only.
- No stack traces in production responses.
- No secrets, tokens, or raw file contents in logs.
- File count limits and size limits on every upload endpoint.
- Reject zero-byte files.
- Validate MIME type and extension together.
- Validate PDF and image signatures where possible.
- Use a dry-run phase before any import commit.
- Audit sensitive actions.
- No direct frontend database access.
- Validate production env vars before startup.

## Current gaps to close in future work

- `src/server/index.ts` currently configures CORS, but it does not yet add rate limiting or a security-headers middleware.
- The generic error handler logs stack traces to server logs.
- Some error responses still expose raw validation detail arrays.
- Public endpoints need route-specific abuse protection, especially auth, imports, and externally reachable token flows.

## Upload safety baseline

- Student import: CSV or XLSX only.
- Scan upload: PNG, JPG, JPEG, WEBP, or PDF only.
- Passport photo: image upload only.
- Never trust `mimetype` alone.
- Use signature checks for XLSX and PDF.
- Use `multer.memoryStorage()` only where the in-memory limit is explicit and acceptable.
- Reject files that are empty, oversized, malformed, or mislabeled.

