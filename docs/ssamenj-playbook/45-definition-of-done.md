# Definition Of Done

A SSAMENJ task is done only when the relevant checks are complete.

## Required Completion Checks

- Exactly one target module was declared before edits when the task was module-specific.
- UI works.
- Mobile works.
- Backend validates.
- Permissions work.
- Tenant isolation works.
- Safe errors work.
- Audit logs added where needed.
- Tests pass.
- Build passes.
- Docs updated.
- `.env.example` updated where needed.
- Database changes reviewed for destructive migration risk.
- Production backup/PITR confirmed before risky migrations.
- `.env.example` updated for DB URLs where needed.
- Seed/test scripts guarded against production `DATABASE_URL`.
- Data retention/delete/archive behavior documented where relevant.
- No unrelated files touched.

## Behavior-preserving migration completion checks

- The module was moved toward `src/modules/<module>` as the target architecture.
- Public API paths were preserved.
- HTTP methods were preserved.
- Request bodies and response shapes were preserved.
- Auth behavior, permission checks, and tenant isolation behavior were preserved.
- Rate limits and audit behavior were preserved.
- Business calculations and product logic were not rewritten as part of the move.
- Route registration files preserved middleware order, mount paths, auth gates, permission gates, tenant context order, public/private separation, and worker startup behavior.
- Frontend route files preserved URL paths, guards, redirects, lazy-loading behavior, role-aware redirects, `PermissionGuard` usage, and shell boundaries.
- No Prisma schema, migration, or env var changes were made as part of the module move.
- Baseline tests for the moved module were identified before edits.
- Post-move targeted tests ran.
- Affected route/client/UI tests ran.
- Typecheck ran.
- Build ran.
- Critical tests ran when the moved module touched auth, permissions, tenant isolation, reports, imports, NFC, Smart Pages, or public links.

## Handoff Rule

Final reports must include current branch, whether the branch is ahead of origin, files changed, module touched, whether runtime behavior changed, whether auth/permission changed, whether tenant isolation changed, whether Prisma/migration changed, commands run, build/test results, skipped checks, risks, and next safest steps.
