# Git Branch And Commit Standard

Use Git intentionally and avoid mixing unrelated work.

## Commit-after-task standard

Every completed SSAMENJ task should end with a clean commit.

Default rule:

* One completed task = one commit.
* One feature pass = one commit.
* One fix = one commit.
* Documentation-only work must be committed separately from runtime code.
* Database/migration changes must be committed separately from UI changes where practical.

Before committing:

* Run `git status`.
* Run `git status -sb`.
* Run `git branch --show-current`.
* Confirm the changed files belong to the current task.
* Do not stage unrelated dirty files.
* Do not use `git add .` unless the worktree is clean except for the current task.
* Run relevant tests/build/typecheck where practical.

Commit message format:

* `docs: add SSAMENJ playbook files`
* `feat: complete StayOS bookings workflow`
* `fix: resolve platform route type errors`
* `security: add upload rate limiting`
* `test: cover tenant isolation checks`
* `chore: update env example`

Do not commit when:

* the user explicitly says not to commit
* the task is incomplete and the partial work is risky
* tests fail because of the current task and the failure is not understood
* secrets or production data are present in the diff
* unrelated dirty files cannot be safely separated

If not committing:

* explain why
* list files changed
* list exact suggested `git add` commands
* list tests/build results

## Rules

- One task = one branch where practical.
- One logical change = one commit.
- Docs-only commits separate from runtime commits.
- Do not use `git add .` when unrelated dirty files exist.
- Run tests before commit where practical.
- Preserve local-only commits unless explicitly instructed otherwise.

## Local-only branch protection

If the worktree has unrelated dirty files, stop and report them before editing.

If the active branch is ahead of origin, do not:

- rebase;
- squash;
- reset;
- force push;
- push;
- merge unrelated branches;

unless explicitly instructed.

When staging, use explicit file paths.

## Commit Prefixes

- `docs:` documentation-only changes.
- `feat:` new behavior.
- `fix:` bug fix.
- `test:` test-only changes.
- `refactor:` behavior-preserving restructuring.
- `chore:` maintenance.
- `security:` security hardening.

## Dirty Worktree Rule

If unrelated files are dirty, stage explicit paths only and report what was left untouched.

## Documentation-only verification

When the scope is documentation/guidance only:

- do not edit runtime code;
- do not edit tests;
- do not edit package files;
- do not update snapshots;
- do not run production commands.

Verification should be lightweight:

- `git diff --check`
- `git diff --stat`
