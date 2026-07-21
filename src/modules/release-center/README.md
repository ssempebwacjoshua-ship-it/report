# Release Center Module

## Purpose

Owns report-link issuance, bulk release operations, revoke/sent tracking, and parent-facing report delivery flows.

## Owned Public Routes

- Public parent report access flows
- Current public paths:
  - `/api/p/:token`
  - `/api/p/short/:code`
  - `/api/p/:token/downloaded`
  - `/api/p/short/:code/downloaded`
- Route registration files:
  - `src/server/modules/registerReportsRoutes.ts`
  - `src/server/modules/registerPublicRoutes.ts`

## Owned Frontend Routes/Pages

- Browser: `/report-lab/reports/release`
- Parent/public report access flows currently rendered by:
  - `src/pages/ParentReportPage.tsx`
- Current legacy files:
  - `src/pages/ReleaseCenterPage.tsx`
  - `src/pages/ParentReportPage.tsx`

## Owned Server Routes

- API: `/api/reports/release-*`, `/api/reports/issue`, `/api/reports/issue-bulk`, `/api/p/:token`, `/api/p/short/:code`, `/api/p/:token/downloaded`, `/api/p/short/:code/downloaded`
- Current route files still outside the module:
  - `src/server/routes/releaseCenterRoutes.ts`
  - `src/server/routes/parentRoutes.ts`
- Adjacent route file with release-center ownership overlap:
  - `src/server/routes/reportIssueRoutes.ts`

## Owned Services

- Report issue/release, issued-link, parent delivery, and release workflow services
- Current legacy files still outside the module:
  - `src/server/services/issuedReportLinkService.ts`
  - `src/server/services/reportLinkService.ts`

## Owned Repositories

- None isolated yet
- Release-center route files currently depend on shared repositories rather than dedicated release-center repositories

## Owned Client API Files

- Module-owned client files now moved into:
  - `src/modules/release-center/client/releaseCenterClient.ts`
  - `src/modules/release-center/client/issueReportClient.ts`
- Compatibility shims retained at:
  - `src/client/releaseCenterClient.ts`
  - `src/client/issueReportClient.ts`
- Existing runtime imports remain supported through the shims

## Owned Tests

- Current legacy tests still outside the module:
  - `src/tests/routes/releaseCenterRoutes.test.ts`
  - `src/tests/routes/releaseCenterWorkflow.test.ts`
  - `src/tests/routes/parentRoutes.test.ts`
  - `src/tests/routes/reportIssueRoutes.test.ts`
  - `src/tests/ui/ReleaseCenterPage.test.tsx`
  - `src/tests/ui/ParentReportPage.test.tsx`
  - `src/tests/shared/reportReleaseMessage.test.ts`
- Cross-module regression coverage that currently exercises release-center behavior:
  - `src/tests/security/tenantIsolation.test.ts`
  - `src/tests/ui/ReportsPage.test.tsx`

## Owned Prisma Models, If Any

- `IssuedReport`

## Owned Permissions

- Report release/issue/revoke/send permissions
- Parent/public access token enforcement
- Exact permission names must be mapped during route migration

## Owned Audit Events

- Report issue, revoke, resend, sent-marking, open, and download audit events
- Exact event names must be mapped during route and service migration

## Shared Dependencies

- Reports for issuance-ready data and report content
- Communications for outbound release messaging
- Shared auth and public token handling
- Shared report-content sanitization and settings contracts

## External Providers/Integrations

- Outbound communications providers through communications module boundaries

## Background Jobs/Workers

- Bulk release/send flows where applicable
- No dedicated release-center worker entry points isolated yet

## High-Risk Flows

- Public parent links
- Report issuance/release
- Parent download tracking

## Migration Status

- Skeleton only
- Ownership contract defined
- Legacy files mapped
- Release-center client implementations moved into:
  - `src/modules/release-center/client/releaseCenterClient.ts`
  - `src/modules/release-center/client/issueReportClient.ts`
- Compatibility shims retained at:
  - `src/client/releaseCenterClient.ts`
  - `src/client/issueReportClient.ts`
- Existing runtime imports still supported through the shims
- Build passed after both client moves
- `npm run typecheck` still has unrelated repo-wide failures outside release-center client relocations
- Other runtime files not moved yet

## Known Legacy Files Still Outside The Module

### Routes

- `src/server/routes/releaseCenterRoutes.ts`
- `src/server/routes/parentRoutes.ts`
- `src/server/routes/reportIssueRoutes.ts`

### Services

- `src/server/services/issuedReportLinkService.ts`
- `src/server/services/reportLinkService.ts`

### Client API Files

- `src/modules/release-center/client/releaseCenterClient.ts`
- `src/modules/release-center/client/issueReportClient.ts`
- `src/client/releaseCenterClient.ts` (compatibility shim)
- `src/client/issueReportClient.ts` (compatibility shim)

### Pages

- `src/pages/ReleaseCenterPage.tsx`
- `src/pages/ParentReportPage.tsx`

### Components

- No dedicated release-center component folder exists yet
- Current page dependencies still come from shared components:
  - `src/components/SectionLoader.tsx`
  - `src/components/layout/branding.ts`
  - `src/components/reports/StudentReportDetail.tsx`

### Shared Types / Shared Utilities

- No dedicated release-center shared types file exists yet
- Release-center-adjacent shared files currently used by the pages/routes:
  - `src/shared/reportReleaseMessage.ts`
  - `src/shared/types/dashboard.ts`
  - `src/shared/types/reports.ts`
  - `src/shared/types/settings.ts`
  - `src/shared/utils/reportComments.ts`
  - `src/shared/utils/reportContentLimits.ts`

### Tests

- `src/tests/routes/releaseCenterRoutes.test.ts`
- `src/tests/routes/releaseCenterWorkflow.test.ts`
- `src/tests/routes/parentRoutes.test.ts`
- `src/tests/routes/reportIssueRoutes.test.ts`
- `src/tests/ui/ReleaseCenterPage.test.tsx`
- `src/tests/ui/ParentReportPage.test.tsx`
- `src/tests/shared/reportReleaseMessage.test.ts`
- `src/tests/security/tenantIsolation.test.ts`
- `src/tests/ui/ReportsPage.test.tsx`

## Proposed Move Plan

1. Move the pure release-center docs/contracts first.
   - Create `src/modules/release-center/shared/` contracts for release status, issued-link payloads, and parent-message helpers where ownership is clearly release-center-specific.
   - Leave shared report-wide types in reports/shared until ownership is clearer.

2. Move client files without changing API paths.
   - `src/client/releaseCenterClient.ts` has already been moved to `src/modules/release-center/client/releaseCenterClient.ts`.
   - `src/client/issueReportClient.ts` has already been moved to `src/modules/release-center/client/issueReportClient.ts`.
   - Keep `src/client/releaseCenterClient.ts` as a compatibility shim until downstream imports are intentionally repointed.
   - Keep `src/client/issueReportClient.ts` as a compatibility shim until downstream imports are intentionally repointed.
   - Review whether `ReportsPage.tsx` should continue consuming the release-center-owned issue client or whether that boundary should move during later reports/release-center cleanup.

3. Move frontend pages without redesign.
   - Move `src/pages/ReleaseCenterPage.tsx` to `src/modules/release-center/pages/ReleaseCenterPage.tsx`.
   - Move `src/pages/ParentReportPage.tsx` to `src/modules/release-center/pages/ParentReportPage.tsx`.
   - Keep current URL paths, guards, redirects, and shell boundaries unchanged.

4. Move server services before route splitting.
   - Move `src/server/services/issuedReportLinkService.ts` and `src/server/services/reportLinkService.ts` to `src/modules/release-center/server/services/`.
   - Do not change business logic, public-link generation behavior, expiry rules, or audit behavior during the move.

5. Move routes last as a mechanical relocation.
   - Move `src/server/routes/releaseCenterRoutes.ts` and `src/server/routes/parentRoutes.ts` into `src/modules/release-center/server/routes/`.
   - Decide whether `src/server/routes/reportIssueRoutes.ts` belongs wholly in release-center or remains a reports/release-center integration boundary before moving it.
   - Preserve middleware order, public API paths, auth gates, tenant context order, and public/private separation.

6. Move tests alongside the owned files.
   - Move route/UI/shared tests that are clearly release-center-owned into `src/modules/release-center/tests/`.
   - Keep cross-module regression tests like tenant isolation and reports-page integrations in their current shared locations unless their owning module is also being migrated.

7. Split large or mixed-ownership files later.
   - Do not split `releaseCenterRoutes.ts` or `reportIssueRoutes.ts` in the same task as the move unless explicitly requested.
   - Preserve behavior first, then split internally in a later task if still needed.
