# School Connect Reports Lab Pre-Onboarding Sign-Off

Last reviewed: 2026-06-26
Branch: `prod-hardening/pre-onboarding-blockers`

This file separates:
- items proven by repository code, tests, and docs
- items that still require manual verification in Railway/Vercel before onboarding a real school

## Repo-Proven Status

- [x] Tenant isolation tests pass
- [x] Canonical classes/streams foundation is implemented
- [x] Student enrollments/class-stream repair tooling exists
- [x] Shared mark validation is centralized
- [x] Reports read finalized marks only
- [x] Parent report content limits are enforced server-side
- [x] Critical report/marks/audit indexes are present in Prisma schema and migrations
- [x] Sensitive workflows write audit logs
- [x] Controlled school onboarding flow exists
- [x] Smart Report Assistant foundation exists with draft-only AI comments, approval actions, and audit events
- [x] Backup and restore scripts exist
- [x] Rollback procedure is documented
- [x] Repair scripts support dry-run-first workflows
- [x] `npm test` passes
- [x] `npm run build` passes

## Manual Platform Checks Still Required

These cannot be fully proven from the repository alone and must be checked in the live deployment platforms.

- [ ] Railway production `DATABASE_URL` points to the real production Postgres database, not localhost and not a test database
- [ ] Railway production `JWT_SECRET` is a strong random value (32+ chars)
- [ ] Railway production `CLIENT_ORIGIN` matches the real frontend origin
- [ ] Railway production `APP_BASE_URL` or `PUBLIC_APP_URL` is set to the branded parent-report domain
- [ ] Railway-only secrets stay in Railway:
  - `DATABASE_URL`
  - `JWT_SECRET`
  - `GEMINI_API_KEY`
  - `PLATFORM_ADMIN_KEY`
  - `INTERNAL_TEST_KEY`
- [ ] Vercel frontend env does not contain backend secrets
- [ ] `GET /api/health/env` is reachable only with the correct `x-internal-test-key`
- [ ] Railway backups are actually scheduled or otherwise operationalized
- [ ] Restore procedure has been rehearsed against a staging/copy database
- [ ] A rollback SQL script exists for any migration being deployed during the first real onboarding

## Evidence in Repo

- Env validation:
  - [validateEnv.ts](C:/Users/ssemp/school-connect-reports-lab/src/server/middleware/validateEnv.ts)
- Health diagnostics:
  - [healthRoutes.ts](C:/Users/ssemp/school-connect-reports-lab/src/server/routes/healthRoutes.ts)
- Deployment guidance:
  - [deployment.md](C:/Users/ssemp/school-connect-reports-lab/docs/deployment.md)
- Backup/restore/rollback guidance:
  - [RUNBOOKS.md](C:/Users/ssemp/school-connect-reports-lab/docs/RUNBOOKS.md)
- Backup script:
  - [db-backup.sh](C:/Users/ssemp/school-connect-reports-lab/scripts/db-backup.sh)
- Restore script:
  - [db-restore.sh](C:/Users/ssemp/school-connect-reports-lab/scripts/db-restore.sh)

## Current Readiness Call

Repository readiness: strong

Operational readiness: pending final Railway/Vercel verification

Real-school onboarding should wait until every item in "Manual Platform Checks Still Required" is confirmed.
