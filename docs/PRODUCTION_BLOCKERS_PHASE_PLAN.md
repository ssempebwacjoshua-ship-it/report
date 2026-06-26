# Production Blockers Phase Plan

This plan tracks the pre-onboarding hardening work for School Connect Reports Lab.
The canonical production-readiness source is the root file:
[`../SCHOOL_CONNECT_REPORT_LAB_PINNED_PRE_ONBOARDING_MASTER.md`](../SCHOOL_CONNECT_REPORT_LAB_PINNED_PRE_ONBOARDING_MASTER.md)

## Phase 0 - Pin the production blocker file

Goal:
- Make the root pinned checklist the official production readiness source.
- Keep `docs/` from drifting by using a pointer copy.
- Add a visible gate in `README.md`.

Acceptance checks:
- `README.md` contains the production readiness gate section near the top.
- The root pinned checklist is the canonical production source.
- `docs/SCHOOL_CONNECT_REPORT_LAB_PINNED_PRE_ONBOARDING_MASTER.md` points to the root file.
- `docs/PRODUCTION_BLOCKERS_PHASE_PLAN.md` exists and lists the follow-on phases.

Commit command:
```powershell
git add README.md SCHOOL_CONNECT_REPORT_LAB_PINNED_PRE_ONBOARDING_MASTER.md docs
git commit -m "Pin production onboarding blocker checklist"
```

## Phase 1 - Token-enforced tenant isolation

Goal:
- Stop cross-tenant reads and writes across routes, services, and public links.

Acceptance checks:
- School A cannot read or write School B data through protected routes.
- Import, report, NFC, wallet, and settings lookups are scoped by token school.
- Cross-tenant tests cover safe `403`/`404` behavior.

Commit command:
```powershell
git add src/server src/shared src/tests
git commit -m "Enforce tenant isolation across production routes"
```

## Phase 2 - RBAC and auth hardening

Goal:
- Centralize auth and permission checks for all protected APIs.

Acceptance checks:
- Disabled users and schools are rejected.
- Stale tokens are rejected.
- Route permissions are enforced consistently.
- Unsafe login debug logs are removed.

Commit command:
```powershell
git add src/server src/shared src/client src/components src/tests
git commit -m "Harden auth and role permissions for production"
```

## Phase 3 - Import integrity and shared score validation

Goal:
- Reject invalid marks before any database write and make scan commits atomic.

Acceptance checks:
- All mark write paths call the same validation logic.
- Invalid marks fail before persistence.
- Duplicate commits do not double-write.
- Error CSV remains downloadable and school-facing.

Commit command:
```powershell
git add src/server src/shared scripts src/tests
git commit -m "Make mark imports atomic and centrally validated"
```

## Phase 4 - Canonical classes, streams, and onboarding foundation

Goal:
- Keep class names system-controlled and let schools manage streams only.

Acceptance checks:
- Onboarding seeds canonical classes by section.
- Bad class/stream data is repaired.
- Class and stream pair invariants pass.
- UI does not expose arbitrary class names.

Commit command:
```powershell
git add prisma src/server src/shared src/client src/components scripts src/tests
git commit -m "Complete canonical class and onboarding foundation"
```

## Phase 5 - Parent report one-page safety and public link parity

Goal:
- Keep preview, print, download, and public links consistent and one page per student.

Acceptance checks:
- Long comments are rejected or safely trimmed.
- Public and internal previews match.
- Revoked or superseded links are blocked safely.
- Report issue actions write audit entries.

Commit command:
```powershell
git add src/server src/shared src/client src/components src/tests
git commit -m "Enforce one-page parent report safety"
```

## Phase 6 - Smart Pages production hardening

Goal:
- Prevent data leaks, duplicate charging, and worker races.

Acceptance checks:
- Only one worker can claim a job.
- Cache reuse is tenant-safe.
- Password unlocks do not expose secrets in query strings.
- Vertical separation between school and lawyer docs is enforced.

Commit command:
```powershell
git add src/server src/shared src/client src/components src/tests
git commit -m "Harden Smart Pages for production safety"
```

## Phase 7 - Audit trail and migration/rollback readiness

Goal:
- Make sensitive actions traceable and migrations safer to operate.

Acceptance checks:
- Critical workflows create audit rows.
- Audit rows are not casually mutated.
- Repair and rollback procedures are documented.
- CI covers generate, test, and build.

Commit command:
```powershell
git add .github docs scripts src/server src/tests
git commit -m "Add production audit and migration safety gates"
```

## Final phase - Full production gate verification

Goal:
- Prove the full release gate before any real school onboarding.

Acceptance checks:
- `npm run db:generate` passes.
- `npm test` passes.
- `npm run build` passes.
- `npm run verify:report-lab` passes.
- `git status --short` is clean except intentional work.

Commit command:
```powershell
git push origin prod-hardening/pre-onboarding-blockers
```
