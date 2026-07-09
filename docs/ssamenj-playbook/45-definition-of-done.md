# Definition Of Done

A SSAMENJ task is done only when the relevant checks are complete.

## Required Completion Checks

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

## Handoff Rule

Final reports must include files changed, commands run, build/test results, risks, skipped checks, and follow-ups.
