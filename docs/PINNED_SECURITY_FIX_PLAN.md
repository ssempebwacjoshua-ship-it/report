# PINNED SECURITY FIX PLAN — Report Lab + SSAMENJ Platform

Use this as the standing instruction for all security and production-readiness fixes.

Repos:
1. C:\Users\ssemp\school-connect-reports-lab
2. C:\Users\ssemp\ssamenj-platform

Main rule:
All completed work must end in main. Do not create confusing long-lived branches like console-live or owner-console-live. Use short feature branches only when needed, then merge to main.

Global safety rules:
- Do not drop, reset, truncate, or recreate any production database.
- Do not run prisma migrate dev against Railway/production DB.
- Use prisma migrate deploy for production DB.
- Do not commit secrets, DATABASE_URL values, JWT secrets, invite tokens, or API keys.
- Do not redesign UI unless the task specifically asks for UI.
- Do not batch unrelated fixes together.
- Do not push until tests and build pass.
- Report root cause, files changed, commands run, and test/build results after each phase.

==================================================
PHASE 1 — REPORT LAB: FIX BROKEN TESTS / DB SCHEMA DRIFT
==================================================

Priority: Immediate
Repo: C:\Users\ssemp\school-connect-reports-lab

Problem:
npm test fails because Subject.componentFinalMode is missing in the DB/test schema path, causing onboarding/provisioning flows to return 500.

Goal:
Make Report Lab test suite pass before broader security refactors.

Tasks:
1. Inspect prisma/schema.prisma for Subject.componentFinalMode.
2. Inspect prisma/migrations to confirm whether the column exists in migration history.
3. Inspect test DB setup and onboarding/provisioning tests.
4. Add/fix the required migration or test setup so Subject.componentFinalMode exists where tests expect it.
5. Do not remove componentFinalMode unless proven obsolete.
6. Run:
   - npx prisma generate
   - npm test
   - npm run build

Expected output:
- Root cause
- Files changed
- Commands run
- npm test result
- npm run build result

Commit message:
Fix Report Lab schema drift

==================================================
PHASE 2 — REPORT LAB: FILE UPLOAD HARDENING
==================================================

Priority: High
Repo: C:\Users\ssemp\school-connect-reports-lab

Problem:
File uploads use multer/memory upload paths and spreadsheet imports. This creates DoS and unsafe file parsing risk.

Goal:
Make uploads safer without breaking marks/student import.

Tasks:
1. Audit all multer usage.
2. Add strict upload limits:
   - max file size
   - max files
   - reject empty files
3. Add allowed MIME/extension checks.
4. Where practical, validate file signatures/magic numbers, not only extensions.
5. Return clear safe errors for invalid/oversized uploads.
6. Add tests for:
   - valid upload still works
   - oversized file rejected
   - invalid file type rejected
   - empty file rejected
7. Run:
   - npm test
   - npm run build
   - npm audit

Commit message:
Harden Report Lab uploads

==================================================
PHASE 3 — REPORT LAB: XLSX RISK REDUCTION
==================================================

Priority: High
Repo: C:\Users\ssemp\school-connect-reports-lab

Problem:
xlsx is flagged by npm audit and is used for import/export behavior.

Goal:
Reduce spreadsheet parsing/export risk without breaking school workflows.

Tasks:
1. Audit every import/use of xlsx.
2. Identify whether a safe replacement is practical.
3. If replacement is risky, isolate usage and enforce strict file limits.
4. Add spreadsheet formula-injection protection for exported or user-visible spreadsheet values beginning with:
   - =
   - +
   - -
   - @
5. Add tests for formula-like values.
6. Add tests ensuring existing import/export still works.
7. Run:
   - npm test
   - npm run build
   - npm audit

Do not blindly upgrade xlsx if it breaks import/export.

Commit message:
Reduce Report Lab spreadsheet risk

==================================================
PHASE 4 — REPORT LAB: BASE SERVER SECURITY
==================================================

Priority: Medium-High
Repo: C:\Users\ssemp\school-connect-reports-lab

Problem:
The server needs stronger default HTTP security protections.

Goal:
Add safe baseline Express hardening.

Tasks:
1. Add Helmet early in server bootstrap.
2. Add rate limiting:
   - stricter limits for auth routes
   - stricter limits for upload/import routes
   - reasonable global default limit
3. Confirm CORS is not overly broad in production.
4. Confirm JSON/body size limits are appropriate.
5. Ensure production errors do not leak stack traces.
6. Add tests where practical.
7. Run:
   - npm test
   - npm run build

Commit message:
Add Report Lab server security hardening

==================================================
PHASE 5 — REPORT LAB: MOVE AUTH FROM LOCALSTORAGE TO HTTPONLY COOKIES
==================================================

Priority: High but careful
Repo: C:\Users\ssemp\school-connect-reports-lab

Problem:
Auth tokens in localStorage are stealable via XSS or malicious browser extensions.

Goal:
Move auth sessions toward HttpOnly cookies.

Important:
Plan first. This can break login if frontend/backend are on different domains.

Tasks:
1. Audit current login/session flow.
2. Identify all localStorage token reads/writes.
3. Update backend login to set HttpOnly cookie.
4. Use Secure cookie in production.
5. Carefully choose SameSite:
   - SameSite=Strict or Lax if frontend/API are same-site.
   - SameSite=None; Secure may be required if Vercel frontend and Railway API are cross-site.
6. Update frontend API client to use credentials.
7. Update logout to clear cookie.
8. Add CSRF protection or a safe CSRF strategy for cookie-based auth.
9. Add tests for:
   - login sets cookie
   - authenticated request works with cookie
   - logout clears cookie
   - localStorage token is no longer required
   - CSRF-sensitive mutation behavior is protected
10. Run:
   - npm test
   - npm run build

Commit message:
Move Report Lab auth to HttpOnly cookies

==================================================
PHASE 6 — SSAMENJ PLATFORM: OWNER CONSOLE PRODUCT SIMPLIFICATION
==================================================

Priority: Medium
Repo: C:\Users\ssemp\ssamenj-platform

Problem:
Owner console shows technical internal submodules like gate_security, nfc_core, nfc_tags, marks_import, report_generation, pos.*, etc.

Goal:
Owner console should show only top-level sellable products:
- Report Lab
- Smart Pages
- NFC
- Rentals / StayOS

Tasks:
1. Do not delete backend records.
2. Do not break existing entitlements.
3. Hide internal technical modules from owner-facing selectors.
4. Rename owner-facing UI wording:
   - Grant module access -> Grant product access
   - Activate module -> Activate product
   - Module access -> Product access
5. Group existing internal entitlements under their parent product where needed.
6. Add tests proving:
   - dropdown only shows top-level products
   - internal modules do not appear in owner selector
   - granting top-level product still works
   - non-owner cannot grant access
7. Run:
   - npm test
   - npm run build

Commit message:
Simplify owner console product access selector

==================================================
PHASE 7 — SSAMENJ PLATFORM: AUTH REVOCATION HARDENING
==================================================

Priority: Medium
Repo: C:\Users\ssemp\ssamenj-platform

Problem:
Generic requireAuth verifies JWT cryptographically, but may not always re-check user status in DB like owner routes do.

Goal:
Suspended/disabled users should lose access quickly, not only after token expiry.

Tasks:
1. Audit requireAuth and ownerOnly/requirePlatformOwner behavior.
2. Add DB revalidation or a safe cached revalidation for generic authenticated routes.
3. Ensure suspended/disabled users are blocked.
4. Ensure platform owner routes remain protected.
5. Ensure service tokens still work only within intended scope.
6. Add tests for:
   - active user can access auth route
   - suspended user is blocked
   - disabled user is blocked
   - owner route still checks DB status
7. Run:
   - npm test
   - npm run build

Commit message:
Harden platform auth revalidation

==================================================
PHASE 8 — CI/CD SECURITY GATES FOR BOTH REPOS
==================================================

Priority: Medium
Repos:
- C:\Users\ssemp\school-connect-reports-lab
- C:\Users\ssemp\ssamenj-platform

Problem:
Security checks should run automatically before merge/deploy.

Goal:
Add CI checks for tests, build, npm audit, and JS/TS SAST.

Tasks:
1. Add/update .github/workflows/ci.yml.
2. Include:
   - npm ci
   - npm test
   - npm run build
   - npm audit --audit-level=high
3. Add Semgrep for JS/TS:
   - semgrep/semgrep-action
   - config: p/javascript
4. Do not use gosec; this is not a Go repo.
5. Do not add paid tools yet.
6. Run locally where possible.

Commit message:
Add security checks to CI

==================================================
FINAL ACCEPTANCE RULES
==================================================

Before any push to main:
1. git status must be reviewed.
2. npm test must pass.
3. npm run build must pass.
4. npm audit result must be reported.
5. No secrets must appear in git diff.
6. No production DB reset/drop commands.
7. Each phase should be committed separately.
