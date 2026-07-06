# CI Standard

CI should catch production-breaking changes before merge.

## Expected Checks

- Typecheck.
- Tests.
- Build.
- Dependency scan.
- Secret scan.
- Lint if available.
- Migration check where applicable.

## Rules

- Do not invent unavailable commands.
- Document repo-specific commands.
- If a check fails due to pre-existing unrelated runtime work, report the exact failure and do not hide it.
- High-risk changes need targeted security or tenant-isolation tests in addition to generic CI.
