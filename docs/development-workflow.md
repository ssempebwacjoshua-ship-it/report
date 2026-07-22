# Development Workflow

## Worktree Hygiene

- Run `git status --short` before editing and start only from a clean worktree.
- Keep one task per branch.
- Do not carry unrelated dirty files into the task branch.
- If unrelated local changes already exist, leave them untouched and report them separately.

## Change Discipline

- Do not mix unrelated features in one deploy.
- Keep public URLs and compatibility redirects stable.
- Production environment changes must be listed separately from code changes.
- Rollback commits should be named intentionally and called out in the final report.

## Verification And Reporting

- Run targeted tests for the area changed before broader verification.
- Include every test/build command actually run in the final report.
- Report failures clearly instead of hiding them.
- Prefer `npm run build` for structural changes that affect routing, middleware, or deployment-sensitive code.
