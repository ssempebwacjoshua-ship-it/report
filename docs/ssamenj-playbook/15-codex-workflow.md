# Codex Workflow

## Working rules for Codex in SSAMENJ repos

- Read `AGENTS.md` and `docs/ssamenj-playbook/00-index.md` before changing code.
- Start every task by declaring exactly one target module when the work is module-specific.
- Summarize the planned change before making large edits.
- Keep diffs small and scoped.
- Do not make broad refactors unless the task explicitly needs them.
- Preserve tenant isolation, auth, permissions, audit logs, upload safety, and safe errors.
- Prefer reusable components and tokens over page-specific styling when the same pattern repeats.
- Run targeted tests for the changed area.
- Run the build before handoff for larger changes.

## Task-start rule

Use this format at the start of every task:

```text
Scope:
Only touch this module: <module-name>

Allowed touch points:
<exact files or folders>

Do not touch:
<high-risk or unrelated modules>
```

If the task truly requires touching another module, stop and explain why before editing.

Before edits, always run:

- `git status -sb`
- `git branch --show-current`

If the worktree has unrelated dirty files, stop and report them before editing.

## Module migration workflow

Module migration is first a behavior-preserving relocation, not a rewrite.

During a module move, do not change:

- public API paths;
- HTTP methods;
- request bodies;
- response shapes;
- permission checks;
- auth behavior;
- tenant isolation behavior;
- rate limits;
- audit behavior;
- business calculations;
- report formulas;
- import logic;
- NFC scan behavior;
- wallet/canteen money logic;
- Smart Pages billing logic;
- UI design;
- Prisma schema;
- migrations;
- env vars.

Only update imports, exports, registration paths, and tests required to keep the same behavior working.

If a bug is discovered during a module move, document it as a follow-up unless it blocks compilation or the moved module's existing tests.

Do not split a large file and move it in the same task unless the user explicitly requests both.

Preferred sequence:

1. Move the file into its owning module without behavior changes.
2. Verify tests/build.
3. In a later task, split the large file internally.
4. Verify tests/build again.

## Prisma generate lock recovery on Windows

On Windows, `npm run db:generate` may fail with:

```text
EPERM: operation not permitted, rename ... node_modules\prisma\query_engine-windows.dll.node.tmp... -> query_engine-windows.dll.node
```

This usually means Node, Prisma Studio, the VS Code TypeScript server, a dev server, a test watcher, antivirus, or another local process has locked the Prisma query engine DLL.

Workflow when this happens:

1. Do not edit schema, migrations, or runtime code to try to fix the lock.
2. Stop dev servers, Prisma Studio, test watchers, and local app processes.
3. Close VS Code if needed.
4. In PowerShell, use PowerShell syntax:

```powershell
Remove-Item -Recurse -Force .\node_modules\prisma
Remove-Item -Recurse -Force .\node_modules\.prisma
```

5. Then run:

```powershell
npm install
npm run db:generate
```

6. If deletion is denied, restart Windows and run the same commands before opening VS Code.
7. Use the repo script `npm run db:generate`, not plain `npx prisma generate`, unless explicitly instructed.
8. After successful generation, run the relevant verification checks.
9. Never delete `prisma/`, `prisma/schema.prisma`, or migration folders.

## Typecheck debt during module migration

During enterprise module migration, `npm run typecheck` may fail because of known repo-wide TypeScript or test debt unrelated to the current move.

When that happens:

1. Do not fix repo-wide TypeScript or test debt inside a module migration task.
2. Only fix typecheck errors clearly caused by the current move, such as broken import paths, broken export paths, incorrect shim paths, or missing moved-file references.
3. If errors are pre-existing or outside the moved module, report them as `typecheck failed with known repo-wide errors outside this relocation`.
4. Continue the migration only if targeted tests for the moved module pass or the failure is confirmed pre-existing, `npm run build` passes, and changed files remain limited to the scoped move.
5. Create a separate dedicated task for repo-wide typecheck cleanup.
6. Do not mix relocation work with broad test fixture updates, stale type cleanup, Prisma schema changes, or unrelated refactors.

## Migration contract boundaries

Route registration files are contract boundaries:

- `src/server/modules/registerAuthRoutes.ts`
- `src/server/modules/registerCommunicationRoutes.ts`
- `src/server/modules/registerNfcRoutes.ts`
- `src/server/modules/registerOwnerRoutes.ts`
- `src/server/modules/registerPlatformRoutes.ts`
- `src/server/modules/registerPublicRoutes.ts`
- `src/server/modules/registerReportsRoutes.ts`
- `src/server/modules/registerSmartPagesRoutes.ts`
- `src/server/modules/registerWorkers.ts`

During migration, they may import routes from `src/modules/<module>`, but they must preserve middleware order, mount paths, auth gates, permission gates, tenant context order, public/private separation, and worker startup behavior.

Frontend route split files are also contract boundaries:

- `src/app/routes/publicRoutes.tsx`
- `src/app/routes/protectedRoutes.tsx`
- `src/app/routes/nfcRoutes.tsx`
- `src/app/routes/ownerRoutes.tsx`
- `src/app/routes/reportsRoutes.tsx`
- `src/app/routes/smartPagesRoutes.tsx`
- `src/app/routes/routeHelpers.tsx`

During migration, they may import pages from `src/modules/<module>`, but they must preserve URL paths, guards, redirects, lazy-loading behavior, role-aware redirects, `PermissionGuard` usage, public-only route behavior, and `AppShell`/`OwnerShell` boundaries.

Do not redesign pages or navigation during route migration.

## Cross-module import rule

Allowed:

- import from the same module;
- import from `src/modules/shared`;
- import from another module's public index/contract file, if intentionally exported.

Not allowed:

- direct imports of another module's private internals;
- new circular module dependencies.

If at least two modules truly need the same logic, move it to `src/modules/shared` with tests.

## High-risk module rule

These areas require separate explicit tasks:

- auth/login/session/password reset/account setup;
- tenant isolation and permissions;
- students and guardian data;
- marks imports and scan imports;
- report calculations and ranking;
- report issue/release/public links;
- NFC reader gateway;
- NFC attendance scans;
- NFC offline mode;
- NFC wallet/canteen transactions;
- gate security/pass-outs/visitors;
- Smart Pages billing;
- Smart Pages extraction/AI/OCR;
- production migrations;
- seed/repair scripts;
- deployment configuration.

Do not include high-risk areas in a broad migration unless the task is specifically scoped to that area and the required tests are identified first.

## Documentation sync rule

At the end of every task, Codex must check whether any module README, architecture doc, or playbook file needs to be updated.

This is required when the task:

- moves a file into or out of a module;
- creates a new route, service, client, page, test, permission, audit event, job, or integration;
- changes ownership of any file or behavior;
- adds a compatibility shim;
- changes public API paths, frontend routes, or route registration;
- changes high-risk flows such as auth, imports, reports, NFC, Smart Pages, billing, or tenant isolation.

If documentation is needed, update it in the same task unless the user explicitly requested runtime-only work.

If documentation is not needed, the final handoff must say:

```text
Documentation update needed: no
```

If documentation is needed but skipped, the final handoff must say:

```text
Documentation update needed: yes, skipped because <reason>
```

For module migration tasks, update the owning module README after every committed move so the migration map stays truthful.

## Reporting rules

- Report current branch.
- Report whether the branch is ahead of origin.
- Report files changed.
- Report the module touched.
- Report whether runtime behavior changed.
- Report whether auth/permission changed.
- Report whether tenant isolation changed.
- Report whether Prisma/migration changed.
- Report tests run.
- Report build/typecheck result.
- Report whether a documentation update was needed.
- Report whether documentation was updated.
- Report documentation files updated, if any.
- Report why documentation was skipped, if it was needed but not updated.
- Report risks or skipped checks.
- Report the next safest step.
