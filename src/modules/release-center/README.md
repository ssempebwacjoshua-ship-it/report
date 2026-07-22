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
- Module-owned page now moved into:
  - `src/modules/release-center/pages/ReleaseCenterPage.tsx`
  - `src/modules/release-center/pages/ParentReportPage.tsx`
- Compatibility shim retained at:
  - `src/pages/ReleaseCenterPage.tsx`
  - `src/pages/ParentReportPage.tsx`
- Existing route imports remain supported through the shim

## Owned Server Routes

- API: `/api/reports/release-*`, `/api/reports/issue`, `/api/reports/issue-bulk`, `/api/p/:token`, `/api/p/short/:code`, `/api/p/:token/downloaded`, `/api/p/short/:code/downloaded`
- Current route files still outside the module:
- Adjacent release-center-owned route now moved into:
  - `src/modules/release-center/server/routes/reportIssueRoutes.ts`
- Compatibility shim retained at:
  - `src/server/routes/reportIssueRoutes.ts`
- Existing route registration and test imports remain supported through the shim
- Module-owned route now moved into:
  - `src/modules/release-center/server/routes/releaseCenterRoutes.ts`
- Public parent route now moved into:
  - `src/modules/release-center/server/routes/parentRoutes.ts`
- Compatibility shim retained at:
  - `src/server/routes/releaseCenterRoutes.ts`
  - `src/server/routes/parentRoutes.ts`
- Existing route registration imports remain supported through the shim

## Owned Services

- Report issue/release, issued-link, parent delivery, and release workflow services
- Module-owned service now moved into:
  - `src/modules/release-center/server/services/issuedReportLinkService.ts`
  - `src/modules/release-center/server/services/reportLinkService.ts`
- Compatibility shim retained at:
  - `src/server/services/issuedReportLinkService.ts`
  - `src/server/services/reportLinkService.ts`
- Existing service imports remain supported through the shim
- Current legacy files still outside the module:
  - None for release-center-owned services in this area; the old service paths now remain only as compatibility shims

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
  - `src/tests/shared/reportReleaseMessage.test.ts`
- Module-owned test now moved into:
  - `src/modules/release-center/tests/routes/releaseCenterRoutes.test.ts`
  - `src/modules/release-center/tests/routes/reportIssueRoutes.test.ts`
  - `src/modules/release-center/tests/routes/parentRoutes.test.ts`
  - `src/modules/release-center/tests/routes/releaseCenterWorkflow.test.ts`
  - `src/modules/release-center/tests/ui/ReleaseCenterPage.test.tsx`
  - `src/modules/release-center/tests/ui/ParentReportPage.test.tsx`
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
- Release Center page moved into:
  - `src/modules/release-center/pages/ReleaseCenterPage.tsx`
- Parent report page moved into:
  - `src/modules/release-center/pages/ParentReportPage.tsx`
- Issued report link service moved into:
  - `src/modules/release-center/server/services/issuedReportLinkService.ts`
- Report link service moved into:
  - `src/modules/release-center/server/services/reportLinkService.ts`
- Compatibility shims retained at:
  - `src/client/releaseCenterClient.ts`
  - `src/client/issueReportClient.ts`
- `src/pages/ReleaseCenterPage.tsx`
- `src/pages/ParentReportPage.tsx`
- `src/server/services/issuedReportLinkService.ts`
- `src/server/services/reportLinkService.ts`
- Existing runtime imports still supported through the shims
- Build passed after the client, page, and report-link service moves
- Existing public report UI imports still supported through the shim
- Release Center routes moved into:
  - `src/modules/release-center/server/routes/releaseCenterRoutes.ts`
- Report issue routes moved into:
  - `src/modules/release-center/server/routes/reportIssueRoutes.ts`
- Parent public routes moved into:
  - `src/modules/release-center/server/routes/parentRoutes.ts`
- Compatibility shim retained at:
  - `src/server/routes/releaseCenterRoutes.ts`
  - `src/server/routes/reportIssueRoutes.ts`
  - `src/server/routes/parentRoutes.ts`
- Existing route registration imports remain supported through the shim
- Build passed after the client, page, report-link service, release-center-routes, report-issue-routes, and parent-routes moves
- `npm run typecheck` still has unrelated repo-wide failures outside release-center client relocations
- Other runtime files not moved yet

## Known Legacy Files Still Outside The Module

### Routes

- `src/modules/release-center/server/routes/releaseCenterRoutes.ts`
- `src/server/routes/releaseCenterRoutes.ts` (compatibility shim)
- `src/modules/release-center/server/routes/reportIssueRoutes.ts`
- `src/server/routes/reportIssueRoutes.ts` (compatibility shim)
- `src/modules/release-center/server/routes/parentRoutes.ts`
- `src/server/routes/parentRoutes.ts` (compatibility shim)

### Services

- `src/modules/release-center/server/services/issuedReportLinkService.ts`
- `src/server/services/issuedReportLinkService.ts` (compatibility shim)
- `src/modules/release-center/server/services/reportLinkService.ts`
- `src/server/services/reportLinkService.ts` (compatibility shim)

### Client API Files

- `src/modules/release-center/client/releaseCenterClient.ts`
- `src/modules/release-center/client/issueReportClient.ts`
- `src/client/releaseCenterClient.ts` (compatibility shim)
- `src/client/issueReportClient.ts` (compatibility shim)

### Pages

- `src/modules/release-center/pages/ReleaseCenterPage.tsx`
- `src/modules/release-center/pages/ParentReportPage.tsx`
- `src/pages/ReleaseCenterPage.tsx` (compatibility shim)
- `src/pages/ParentReportPage.tsx` (compatibility shim)

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

- `src/modules/release-center/tests/routes/releaseCenterRoutes.test.ts`
- `src/modules/release-center/tests/routes/parentRoutes.test.ts`
- `src/modules/release-center/tests/routes/reportIssueRoutes.test.ts`
- `src/modules/release-center/tests/routes/releaseCenterWorkflow.test.ts`
- `src/modules/release-center/tests/ui/ReleaseCenterPage.test.tsx`
- `src/modules/release-center/tests/ui/ParentReportPage.test.tsx`
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
   - `src/pages/ReleaseCenterPage.tsx` has already been moved to `src/modules/release-center/pages/ReleaseCenterPage.tsx`.
   - Keep `src/pages/ReleaseCenterPage.tsx` as a compatibility shim until downstream imports are intentionally repointed.
   - `src/pages/ParentReportPage.tsx` has already been moved to `src/modules/release-center/pages/ParentReportPage.tsx`.
   - Keep `src/pages/ParentReportPage.tsx` as a compatibility shim until downstream imports are intentionally repointed.
   - Keep current URL paths, guards, redirects, and shell boundaries unchanged.

4. Move server services before route splitting.
   - `src/server/services/issuedReportLinkService.ts` has already been moved to `src/modules/release-center/server/services/issuedReportLinkService.ts`.
   - Keep `src/server/services/issuedReportLinkService.ts` as a compatibility shim until downstream imports are intentionally repointed.
   - `src/server/services/reportLinkService.ts` has already been moved to `src/modules/release-center/server/services/reportLinkService.ts`.
   - Keep `src/server/services/reportLinkService.ts` as a compatibility shim until downstream imports are intentionally repointed.
   - Do not change business logic, public-link generation behavior, expiry rules, or audit behavior during the move.

5. Move routes last as a mechanical relocation.
   - `src/server/routes/releaseCenterRoutes.ts` has already been moved to `src/modules/release-center/server/routes/releaseCenterRoutes.ts`.
   - Keep `src/server/routes/releaseCenterRoutes.ts` as a compatibility shim until downstream imports are intentionally repointed.
   - `src/server/routes/reportIssueRoutes.ts` has already been moved to `src/modules/release-center/server/routes/reportIssueRoutes.ts`.
   - Keep `src/server/routes/reportIssueRoutes.ts` as a compatibility shim until downstream imports are intentionally repointed.
   - `src/server/routes/parentRoutes.ts` has already been moved to `src/modules/release-center/server/routes/parentRoutes.ts`.
   - Keep `src/server/routes/parentRoutes.ts` as a compatibility shim until downstream imports are intentionally repointed.
   - Preserve middleware order, public API paths, auth gates, tenant context order, and public/private separation.

6. Move tests alongside the owned files.
   - Move route/UI/shared tests that are clearly release-center-owned into `src/modules/release-center/tests/`.
   - Keep cross-module regression tests like tenant isolation and reports-page integrations in their current shared locations unless their owning module is also being migrated.

7. Split large or mixed-ownership files later.
   - Do not split `releaseCenterRoutes.ts` or `reportIssueRoutes.ts` in the same task as the move unless explicitly requested.
   - Preserve behavior first, then split internally in a later task if still needed.
