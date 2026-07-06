# Git Branch And Commit Standard

Use Git intentionally and avoid mixing unrelated work.

## Rules

- One task = one branch where practical.
- One logical change = one commit.
- Docs-only commits separate from runtime commits.
- Do not use `git add .` when unrelated dirty files exist.
- Run tests before commit where practical.

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
