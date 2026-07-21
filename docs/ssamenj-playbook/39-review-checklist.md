# Review Checklist

Codex must answer these before handoff or commit.

- Current branch.
- Branch ahead of origin?
- Files changed.
- Module touched.
- Business logic changed?
- Auth/permission affected?
- Tenant isolation affected?
- Database migration added?
- Env vars added?
- Upload/import affected?
- AI/RAG affected?
- Audit logs added?
- Tests run?
- Build result?
- Risks?
- Follow-ups?

## Module migration review questions

- Was exactly one target module declared before edits?
- Was the task limited to behavior-preserving relocation rather than rewrite?
- Were public API paths, HTTP methods, request/response contracts, auth behavior, permissions, tenant isolation, rate limits, and audit behavior preserved?
- Were route registration files treated as contract boundaries without mount-path changes?
- Were frontend route split files treated as contract boundaries without URL/guard/redirect changes?
- Were cross-module imports limited to the same module, `src/modules/shared`, or intentional public contracts?
- Were any large files both moved and split in the same task? If yes, was that explicitly requested?
- Were high-risk areas kept out unless the task was explicitly scoped to them?
- Were baseline tests for the moved module identified before edits?
- After the move, were the same targeted tests, affected tests, typecheck, and build run?
- If runtime behavior was intentionally changed, was that separately approved?

## Rule

If a checklist item is not applicable, say so. If a check was skipped, explain why.
