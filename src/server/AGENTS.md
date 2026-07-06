# Backend Rules

- Backend changes must protect auth, permissions, tenant isolation, request validation, safe errors, audit logs, and rate-limit needs.
- Every new route or mutation must define auth requirement, permission requirement, tenant scope, validation, audit need, rate-limit need, safe error behavior, and tests.
- Never trust frontend-only checks or request body tenant IDs.
- Never expose raw Prisma, provider, or internal errors in production.
- Keep backend diffs small and do not refactor unrelated modules.
