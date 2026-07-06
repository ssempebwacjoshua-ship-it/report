# Testing Standard

## Required test layers

- Unit tests for shared utilities and services.
- API tests for routes and middleware.
- UI tests for shell, dashboard, forms, and state handling.
- Security tests for tenant isolation and permission boundaries.
- Upload rejection tests for file safety rules.
- Import dry-run and commit tests.
- Build verification.

## Current commands

- `npm run test`
- `npm run test:critical`
- `npm run build`
- `npm run typecheck`
- `npm run lint`

## When to use targeted tests

- Use targeted tests after small changes in one module.
- Use the critical smoke suite after touching auth, tenant isolation, uploads, dashboards, or route protection.
- Use the full build before handing off larger changes or anything that changes shared UI, backend routing, or deployment behavior.

## Current critical smoke coverage in this repo

- Login and role access
- NFC gate auth flow
- Student client and passport photo upload
- Document intelligence routes and service flow
- Parent report page

## Testing rules

- Prefer existing tests over writing ad hoc scripts.
- Add route tests when route behavior changes.
- Add UI tests when visible states change.
- Add security tests when tenant rules or permissions change.
- Add upload tests whenever file-validation logic changes.

