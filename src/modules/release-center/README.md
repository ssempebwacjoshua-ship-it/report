# Release Center Module

## Purpose

Owns report-link issuance, bulk release operations, revoke/sent tracking, and parent-facing report delivery flows.

## Owned Public Routes

- Public parent report access flows
- Current public paths:
  - `/api/p/:token`
  - `/api/p/:token/downloaded`
- Route registration files:
  - `src/server/modules/registerReportsRoutes.ts`
  - `src/server/modules/registerPublicRoutes.ts`

## Owned Frontend Routes/Pages

- Browser: `/report-lab/reports/release`, parent/public report access flows
- Current legacy files:
  - `src/pages/ReleaseCenterPage.tsx`
  - `src/pages/ParentReportPage.tsx`

## Owned Server Routes

- API: `/api/reports/release-*`, `/api/reports/issue-*`, `/api/p/:token`, `/api/p/:token/downloaded`
- Current route files still outside the module:
  - `src/server/routes/releaseCenterRoutes.ts`
  - `src/server/routes/parentRoutes.ts`

## Owned Services

- Report issue/release, issued-link, parent delivery, and release workflow services
- Current legacy files still outside the module:
  - `src/server/services/issuedReportLinkService.ts`
  - `src/server/services/reportLinkService.ts`

## Owned Repositories

- None isolated yet

## Owned Client API Files

- Current legacy files:
  - `src/client/releaseCenterClient.ts`

## Owned Tests

- Current legacy tests still outside the module:
  - `src/tests/routes/releaseCenterRoutes.test.ts`
  - `src/tests/routes/releaseCenterWorkflow.test.ts`
  - `src/tests/routes/parentRoutes.test.ts`
  - `src/tests/ui/ReleaseCenterPage.test.tsx`
  - `src/tests/ui/ParentReportPage.test.tsx`
  - `src/tests/shared/reportReleaseMessage.test.ts`

## Owned Prisma Models, If Any

- `IssuedReport`

## Owned Permissions

- Report release/issue/revoke/send permissions
- Exact permission names must be mapped during module migration

## Owned Audit Events

- Report issue, revoke, resend, and parent-download audit events
- Exact event names must be mapped during module migration

## Shared Dependencies

- Reports for issuance-ready data and report content
- Communications for outbound release messaging
- Shared auth and public token handling

## External Providers/Integrations

- Outbound communications providers through communications module boundaries

## Background Jobs/Workers

- Bulk release/send flows where applicable

## High-Risk Flows

- Public parent links
- Report issuance/release
- Parent download tracking

## Migration Status

- Skeleton only
- Ownership contract defined
- Runtime files not moved yet

## Known Legacy Files Still Outside The Module

- `src/pages/ReleaseCenterPage.tsx`
- `src/pages/ParentReportPage.tsx`
- `src/client/releaseCenterClient.ts`
- `src/server/routes/releaseCenterRoutes.ts`
- `src/server/routes/parentRoutes.ts`
- `src/server/services/issuedReportLinkService.ts`
- `src/server/services/reportLinkService.ts`
- `src/shared/reportReleaseMessage.ts`
