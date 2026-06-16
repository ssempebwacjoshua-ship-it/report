# School Connect Reports Lab — Pinned Pre-Onboarding Master Checklist

**Purpose:** This is the single pinned file for School Connect Reports Lab before onboarding real schools.

**Current verdict:** The system is a strong prototype/report lab, but **not yet safe for real school onboarding** until the blocker items below are complete.

**Repository context:** `school-connect-reports-lab` / GitHub repo `ssempebwacjoshua-ship-it/report`

---

## 0. Mandatory Working Rules for Every Agent

Every Claude/Codex/Gemini implementation prompt must start with:

> Before coding, read and follow the project’s SKILLS, coworker, and subagent instructions. Use the correct subagent/workflow where required.

Operational rules:

- Work phase by phase.
- One phase, test, commit, stop.
- Do **not** use `git add .`.
- Never commit `.env` or secrets.
- Do not weaken safety validation to make a demo pass.
- Office-PC-first workflow. Do not spend time on mobile/PWA unless explicitly re-scoped.
- Do not touch Smart Pages, Document Cleaner, or unrelated modules while fixing reports/imports/classes.
- For school-facing UI, no UUIDs or technical jargon.
- Every dashboard/action must be real, or disabled with a clear explanation.
- Parent report preview/print/download/public link must remain exactly **one page per student**.

---

## 1. Non-Negotiable Product Rules

### 1.1 Tenant Isolation

- Every school is a separate tenant.
- A user belongs to a school.
- Backend must use `req.user.schoolId` from the verified token.
- `schoolCode` may identify a school, but must not be used as security.
- If client sends `schoolCode` that does not match token schoolId, return `403`.
- School A must never read/write School B students, marks, reports, settings, branding, imports, or audit logs.

### 1.2 Canonical Classes and Streams

System controls class names. School operators manage streams only.

Canonical classes:

- Nursery / Pre-primary:
  - Baby Class / `BABY`
  - Middle Class / `MIDDLE`
  - Top Class / `TOP`
- Primary:
  - `P1`, `P2`, `P3`, `P4`, `P5`, `P6`, `P7`
- Secondary:
  - Senior 1 / `S1`
  - Senior 2 / `S2`
  - Senior 3 / `S3`
  - Senior 4 / `S4`
  - Senior 5 / `S5`
  - Senior 6 / `S6`

Not allowed as classes:

- `Senior 1 A`
- `Senior 1 B`
- `S1B`
- `P4 Blue`

Correct:

```text
Class: Senior 1
Stream: B
```

### 1.3 Marks

- Scores must be `0–100`.
- This rule must apply to Gemini imports, CSV, Excel, manual edit, teacher upload, and seed scripts.
- After marks are finalized, teachers cannot silently edit them.
- Any edit after finalization must require approval and audit trail.

### 1.4 AI/Gemini

- Gemini may assist; it must not own final school decisions.
- Gemini must not invent marks, students, subjects, attendance, comments, positions, signatures, or approvals.
- AI report comments are drafts until approved.
- AI comments must have hard server-side character limits.
- AI output cannot break one-page parent reports.

### 1.5 Reports

- Final reports read finalized marks only.
- Parent report link `/parent/r/:token` must match internal final preview.
- Parent report preview/print/download must fit exactly one page per student.
- Bulk printing belongs to internal report/marksheet workflows, not public parent links.

---

## 2. Current Known Status Snapshot

### Completed or Mostly Present

- `schoolId` exists on many core models.
- JWT payload includes `schoolId`.
- Gemini OCR has structured JSON response and deterministic mark validation.
- Gemini extraction and commit reject invalid marks in the marksheet flow.
- Some useful indexes already exist on marks/enrollments.
- Gemini connectivity diagnostics and retry handling were hardened.
- Health endpoint exists for Gemini diagnostics.

### Still Incomplete / Risky

- Tenant isolation is not yet absolute across every route/query.
- Some protected workflows still rely on `schoolCode` fallback in dev/local paths.
- Canonical class repair is incomplete: dropdown improved, but student/enrollment/stream/mark migration is not fully done.
- Extractor currently blocks students because they are not fully migrated to the selected canonical class/stream.
- Shared score validation is not centralized across all mark entry paths.
- Smart Report Assistant context loader is not yet built.
- AI comment length limits and approval flow are not yet implemented.
- Audit log exists but is not proven append-only or complete for all critical actions.
- Production onboarding/provisioning flow is not finished.

---

## 3. Final Blocker List Before Real School Onboarding

These are the **7 non-negotiable blockers**.

### BLOCKER 1 — Token-Enforced Tenant Isolation

**Goal:** No cross-school leak is possible.

Must have:

- Global authenticated school context resolver.
- Protected routes must use token schoolId.
- No production fallback to `SCU-PREVIEW`.
- Client-provided `schoolCode`, `classId`, `studentId`, `batchId`, or `reportId` must be checked against token schoolId.
- Cross-tenant tests for students, reports, marks import, settings, documents, parent link, and audit logs.

Acceptance tests:

```text
School A token attempts to:
- fetch School B students
- commit marks into School B
- open School B report
- edit School B settings
- use School B import batch

Expected: 403.
```

---

### BLOCKER 2 — Canonical Classes, Streams, and Enrollment Repair

**Goal:** Classes are system-controlled; streams are school-controlled.

Must have:

- School section selection: Nursery / Primary / Secondary / combined.
- Canonical classes seeded for selected sections.
- Operators can add/edit/deactivate streams, not classes.
- Existing bad data migrated:
  - `Senior 1 A` → `Senior 1` + stream `A`
  - `Senior 1 B` → `Senior 1` + stream `B`
- Every active `ClassEnrollment.streamId` must belong to the same `classId`.
- Every `SubjectMark.streamId` must belong to the same `classId`.
- Options endpoint must only return valid canonical class + stream pairings.
- Do not weaken “student belongs to class” extractor safety.

Acceptance tests:

```text
Smart Marksheet Import:
Class: Senior 1
Stream: B
Subject: Mathematics
Term: Term 1
Exam Type: EOT

Expected:
- expected students count is 24/25 for the marksheet, not 3
- rows are not blocked as “student does not belong to this class”
- no class dropdown option says Senior 1 B or S1B
```

---

### BLOCKER 3 — Shared Score Validation Engine

**Goal:** Bad marks never reach the database.

Must have:

- Shared backend function: `validateScore()`.
- Reject empty, non-numeric, `<0`, `>100`.
- Used by:
  - Gemini scan commit
  - CSV import
  - Excel import
  - manual mark edit
  - teacher upload
  - seed scripts
- Tests for all entry paths.

Acceptance tests:

```text
Try saving:
- -1
- 101
- 990
- empty
- text

Expected: rejected before database write.
```

---

### BLOCKER 4 — Parent Report One-Page Safety

**Goal:** Parent report never spills pages.

Must have:

- Hard server-side character limits:
  - class teacher comment
  - head teacher comment
  - conduct/progression
  - AI-generated draft comments
- Same final content for:
  - internal preview
  - print
  - download
  - public parent link
- Overflow stress tests.
- No public parent link missing comments/sign/date sections.

Acceptance tests:

```text
Submit a 1,500-character comment.
Expected:
- server rejects or trims safely
- parent report still one page
- public link equals internal final preview
```

---

### BLOCKER 5 — Critical Database Indexes

**Goal:** Reports stay fast as schools grow.

Must review/add indexes based on final schema.

Recommended indexes:

```prisma
// SubjectMark
@@index([schoolId, academicYearId, termId, classId, streamId, assessmentType, status])
@@index([schoolId, studentId, academicYearId, termId, assessmentType])
@@index([schoolId, subjectId, academicYearId, termId, assessmentType])

// ClassEnrollment
// Prefer adding schoolId directly to ClassEnrollment before onboarding.
@@index([schoolId, academicYearId, termId, classId, streamId, isActive, status])
@@index([schoolId, studentId, academicYearId, termId])

// AuditLog
@@index([schoolId, action, createdAt])
@@index([schoolId, correlationId])
```

Acceptance tests:

```text
- 250-student class report loads reliably.
- Report query count does not grow linearly per student.
- EXPLAIN ANALYZE confirms index usage for main report query.
```

---

### BLOCKER 6 — Append-Only Audit Trail for Critical Actions

**Goal:** Every sensitive school action is traceable.

Must log:

- school created
- user invited/activated/disabled
- class/stream setup changes
- student enrollment changes
- marks imported
- marks edited
- marks finalized
- finalized marks reopened
- comments generated/edited/approved
- reports issued
- reports revoked/superseded
- parent links released
- AI suggestion accepted/rejected

Minimum for first production:

- No update/delete audit routes.
- Audit rows always include `schoolId`, action, actor, timestamp, correlationId/details.
- Tests prove critical workflows create audit rows.

Stronger later:

- DB trigger or permissions preventing audit row updates/deletes.

Acceptance tests:

```text
Commit Gemini marks.
Expected:
- marks saved
- import batch updated
- audit log created

Try changing finalized mark.
Expected:
- approval required
- audit entry records request/approval/change
```

---

### BLOCKER 7 — Controlled School Onboarding Flow

**Goal:** No accidental tenant setup mistakes.

Must have:

- Platform owner creates school.
- Platform owner chooses school sections.
- System seeds canonical classes.
- Platform owner creates/invites first admin/operator.
- Normal schools do not self-create tenants yet.
- School branding is platform-managed by default.
- School users only access their assigned tenant.

Acceptance tests:

```text
Create a new school:
- school record created
- canonical classes seeded
- first admin assigned to that school
- admin login token contains correct schoolId
- admin cannot access SCU-PREVIEW
```

---

## 4. High Priority Before Serious Pilot

These should follow blockers, but can be phased after the first safety pass.

### HIGH 1 — Smart Report Assistant Context Loader

Build `reportAssistantContextService`.

Rules:

- No Prisma calls inside per-student loops.
- Use batched queries.
- Assemble with Maps in memory.
- Validate class/stream/school context.
- Return readiness summary.

Must check:

- missing students
- missing marks
- unfinalized marks
- missing subjects
- missing comments
- invalid marks
- duplicate marks
- attendance if required
- grading scale
- report issue readiness

---

### HIGH 2 — Bulk CSV/Excel Import Safety

Must have:

- Validate entire file first.
- Commit in chunks.
- Use import batch / idempotency.
- Avoid one huge transaction for thousands of rows.
- No partial silent failure.
- Downloadable error CSV.

---

### HIGH 3 — AI Report Assistant Safety

Must have:

- Gemini unavailable fallback.
- AI output max length.
- AI comments drafts only.
- Approval required.
- Audit accepted/rejected AI suggestions.
- No invented facts.
- UI explains missing data honestly.

---

### HIGH 4 — Production Secrets and Environment

Must verify:

- `GEMINI_API_KEY` only in Railway backend.
- No key in Vercel frontend.
- `JWT_SECRET` strong in production.
- `DATABASE_URL` correct.
- `CLIENT_ORIGIN` correct.
- `INTERNAL_TEST_KEY` only for internal/test routes.
- No `.env` committed.
- Health checks safe and not leaking secrets.

---

### HIGH 5 — Backup, Migration, and Rollback

Must have:

- Backup command documented.
- Restore command documented.
- Repair scripts have dry-run mode.
- Migrations tested on copy/staging database.
- Rollback plan for schema changes.
- No destructive live repair without dry-run summary.

---

## 5. Medium Priority

- Cache school settings, grading scale, headers, branding.
- Add audit log partitioning only when volume grows.
- Add 1,000,000-row performance test later.
- Add office-PC UI render performance checks for very large classes.
- Add advanced assistant analytics later.

---

## 6. Phase-by-Phase Execution Plan

### Phase 1 — Tenant Isolation

Deliverables:

- `requireAuth` and `resolveSchoolContext`.
- All protected routes use token schoolId.
- Remove unsafe production fallback.
- Cross-school tests.

Commit:

```powershell
git add src/server src/tests
git commit -m "Enforce token-scoped school tenant isolation"
```

---

### Phase 2 — Canonical Classes and Streams

Deliverables:

- School section setup.
- Canonical class seeding.
- Stream management only.
- Full migration of old class+stream data.
- Class/stream invariant tests.
- Import options show correct class/stream pairings.

Commit:

```powershell
git add prisma src/server src/shared src/scripts src/tests src/components
git commit -m "Complete canonical class stream foundation"
```

---

### Phase 3 — Shared Mark Validation

Deliverables:

- `validateScore()`.
- All mark write paths use it.
- Tests for invalid marks across every import/edit path.

Commit:

```powershell
git add src/server src/shared src/tests
git commit -m "Centralize score validation across mark workflows"
```

---

### Phase 4 — Report One-Page Safety

Deliverables:

- Comment max lengths.
- Server-side validation.
- Print/preview/public link consistency tests.
- Overflow stress test.

Commit:

```powershell
git add src/server src/components src/pages src/tests
git commit -m "Enforce one-page report content limits"
```

---

### Phase 5 — Indexes and Report Performance

Deliverables:

- Critical composite indexes.
- Report query tests.
- 250-student class performance test.

Commit:

```powershell
git add prisma src/server src/tests
git commit -m "Add production indexes for reports and marks"
```

---

### Phase 6 — Audit Trail

Deliverables:

- Audit all sensitive workflows.
- No audit mutation routes.
- Audit tests.

Commit:

```powershell
git add src/server src/tests
git commit -m "Harden audit trail for report workflows"
```

---

### Phase 7 — Controlled School Onboarding

Deliverables:

- Platform-owner school creation flow.
- Section selection.
- First admin invite/create.
- Branding default setup.
- Tests.

Commit:

```powershell
git add src/server src/pages src/components src/tests
git commit -m "Add controlled school onboarding flow"
```

---

### Phase 8 — Smart Report Assistant

Only start after blockers are done.

Deliverables:

- Report assistant context loader.
- Readiness checklist.
- AI comment drafting as draft-only.
- Approval workflow.
- AI audit trail.
- Gemini output caps.

Commit:

```powershell
git add src/server src/components src/pages src/tests
git commit -m "Add safe Smart Report Assistant foundation"
```

---

## 7. Verification Commands

Run before considering any phase done:

```powershell
npm run test
npm run build
git status --short
```

Tenant isolation check:

```text
School A token + School B resource = 403
```

Class/stream check:

```text
Class Senior 1 + Stream B:
expectedStudents count = 24/25 for the sample marksheet
```

Report check:

```text
Internal preview = public parent link = print/download content
One page per student
```

---

## 8. Do Not Do These

- Do not hide bad data in dropdown only; migrate it properly.
- Do not weaken “student belongs to class” validation.
- Do not allow arbitrary class creation by school operators.
- Do not let Gemini write approved comments directly.
- Do not let schoolCode override token schoolId.
- Do not issue reports from DRAFT marks.
- Do not allow public parent report to omit comments/sign/date sections.
- Do not let parent report spill to page 2.
- Do not commit `.env`.
- Do not use `git add .`.

---

## 9. Final Definition of Safe to Onboard First School

A real school can be onboarded only when:

```text
[ ] Tenant isolation tests pass.
[ ] Canonical classes/streams are fully repaired and seeded.
[ ] Student enrollments match canonical class/stream.
[ ] Marks validation is centralized.
[ ] Reports read finalized marks only.
[ ] Parent report is always one page.
[ ] Audit logs exist for sensitive actions.
[ ] Critical indexes are applied.
[ ] School setup/onboarding is controlled.
[ ] Secrets are backend-only.
[ ] Backup/rollback process is documented.
[ ] npm run test passes.
[ ] npm run build passes.
```

Until all above are checked, School Connect Reports Lab remains a report lab/prototype, not production onboarding-ready.
