# API Route Template

Every route must define the following before implementation.

## Route Contract

- Route path:
- Method:
- Auth requirement:
- Permission requirement:
- Tenant/school/company/property scope:
- Request validation:
- Rate-limit need:
- Audit need:
- Success response:
- Safe error responses:
- Tests:

## Required Tests Where Practical

- Unauthenticated request is blocked.
- Unauthorized role/permission is blocked.
- Cross-tenant or cross-company/property access is blocked.
- Invalid input returns a safe validation envelope.
- Success path returns the documented response shape.

## Safety Rules

- Never trust frontend-only checks.
- Never trust tenant, school, company, branch, property, or booking IDs from the body until validated against authenticated scope.
- Never expose raw Prisma, provider, or internal errors in production.
