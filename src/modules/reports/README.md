# Reports Module

## Purpose

Owns academic reporting, report rendering, marks import workflows, marksheets, report comments, assistant tooling, verification support, and report issuance data flows that are not specific to Release Center messaging.

## Owned Public Routes

- Public verification paths as applicable
- Current public path:
  - `/api/verify/:code`
- Route registration files:
  - `src/server/modules/registerReportsRoutes.ts`
  - `src/server/modules/registerPublicRoutes.ts`

## Owned Frontend Routes/Pages

- Browser: `/report-lab/reports`, `/report-lab/imports/marks`, `/report-lab/marksheets`, `/report-lab/verify/:code`
- Current legacy files:
  - `src/pages/ReportsPage.tsx`
- Module-owned page now moved into:
  - `src/modules/reports/pages/VerifyPage.tsx`
- Compatibility shim retained at:
  - `src/pages/VerifyPage.tsx`
- Public/browser verification routes remain unchanged through the shim
- Module-owned page now moved into:
  - `src/modules/reports/pages/MarksImportPage.tsx`
- Compatibility shim retained at:
  - `src/pages/MarksImportPage.tsx`
- Browser routes remain unchanged through the shim
- Module-owned page now moved into:
  - `src/modules/reports/pages/MarksheetsPage.tsx`
- Compatibility shim retained at:
  - `src/pages/MarksheetsPage.tsx`
- Browser routes remain unchanged through the shim

## Owned Server Routes

- API: `/api/reports*`, `/api/imports/*`, `/api/marksheets/*`, `/api/verify/:code`
- Current route files still outside the module:
  - `src/server/routes/importsRoutes.ts`
  - `src/server/routes/marksheetsRoutes.ts`
  - `src/server/routes/verifyRoutes.ts`
  - `src/server/routes/reportIssueRoutes.ts`
  - `src/server/routes/promotionRoutes.ts`
- Module-owned route now moved into:
  - `src/modules/reports/server/routes/reportsRoutes.ts`
- Compatibility shim retained at:
  - `src/server/routes/reportsRoutes.ts`
- Existing route registration imports remain supported through the shim

## Owned Services

- Report generation, comments, import, marksheet, validation, and promotion services
- Current legacy files still outside the module:
  - `src/server/services/reportAssistantContextService.ts`
  - `src/server/services/marksImportService.ts`
  - `src/server/services/marksImportValidator.ts`
  - `src/server/services/marksheetContextService.ts`
  - `src/server/services/marksheetGeometryService.ts`
  - `src/server/services/marksheetIdDetectionService.ts`
  - `src/server/services/marksheetTableDetection.ts`
  - `src/server/services/promotionService.ts`
  - `src/server/services/scoreValidationService.ts`
  - `src/server/services/subjectComponentResolver.ts`
- Module-owned service now moved into:
  - `src/modules/reports/server/services/reportCommentService.ts`
- Compatibility shim retained at:
  - `src/server/services/reportCommentService.ts`
- Existing service imports remain supported through the shim
- Module-owned service now moved into:
  - `src/modules/reports/server/services/reportEngine.ts`
- Compatibility shim retained at:
  - `src/server/services/reportEngine.ts`
- Existing service imports remain supported through the shim

## Owned Repositories

- Module-owned repository now moved into:
  - `src/modules/reports/server/repositories/reportsRepository.ts`
- Module-owned repository now moved into:
  - `src/modules/reports/server/repositories/schoolRepository.ts`
- Module-owned repository now moved into:
  - `src/modules/reports/server/repositories/settingsRepository.ts`
- Compatibility shim retained at:
  - `src/server/repositories/reportsRepository.ts`
- Compatibility shim retained at:
  - `src/server/repositories/schoolRepository.ts`
- Compatibility shim retained at:
  - `src/server/repositories/settingsRepository.ts`
- Existing repository imports remain supported through the shim

## Owned Client API Files

- Module-owned client now moved into:
  - `src/modules/reports/client/reportsClient.ts`
- Compatibility shim retained at:
  - `src/client/reportsClient.ts`
- Existing runtime imports remain supported through the shim
- Module-owned client now moved into:
  - `src/modules/reports/client/importsClient.ts`
- Compatibility shim retained at:
  - `src/client/importsClient.ts`
- Existing runtime imports remain supported through the shim
- Module-owned client now moved into:
  - `src/modules/reports/client/marksheetsClient.ts`
- Compatibility shim retained at:
  - `src/client/marksheetsClient.ts`
- Existing runtime imports remain supported through the shim
- Cross-module usage note:
  - `src/modules/release-center/client/issueReportClient.ts` is currently owned by release-center
  - `src/pages/ReportsPage.tsx` still uses it through the compatibility shim at `src/client/issueReportClient.ts`
  - This boundary should be reviewed during later reports/release-center cleanup

## Owned Tests

- Current legacy tests still outside the module:
  - `src/tests/routes/imports*`
  - `src/tests/routes/marksheetsRoutes.test.ts`
  - `src/tests/routes/reportCommentRoutes.test.ts`
  - `src/tests/routes/reportIssueRoutes.test.ts`
  - `src/tests/routes/reportsRoutes.test.ts`
  - `src/tests/routes/verifyRoutes.test.ts`
  - `src/tests/services/marksImport*`
  - `src/tests/services/marksheet*`
  - `src/tests/services/report*`
  - `src/tests/shared/remarksEngine.test.ts`
  - `src/tests/shared/reportComments.test.ts`
  - `src/tests/shared/reportContentLimits.test.ts`
  - `src/tests/ui/ReportsPage.test.tsx`
  - `src/tests/ui/MarksImportPageModes.test.tsx`
  - `src/tests/ui/MarksheetsPage.test.tsx`

## Owned Prisma Models, If Any

- `Subject`
- `SubjectComponent`
- `SubjectMark`
- `MarkImportBatch`
- `MarkImportRow`
- `IssuedReport`
- `PromotionBatch`
- `PromotionAction`
- `ReportLabSubscription`
- `ReportLabInvoice`

## Owned Permissions

- Reports, imports, marksheets, verification, and promotion permissions
- Exact permission names must be mapped during module migration

## Owned Audit Events

- Report generation, import, comment, verification, and promotion audit events
- Exact event names must be mapped during module migration

## Shared Dependencies

- Shared auth, settings, school context, and student/class data
- Release-center and communications integration contracts

## External Providers/Integrations

- Import/scan providers where applicable

## Background Jobs/Workers

- Long-running import/report workflows where applicable

## High-Risk Flows

- Marks imports
- Report calculations and ranking
- Report issue/release data dependencies

## Migration Status

- Skeleton only
- Ownership contract defined
- Reports still consume the release-center-owned issue report client through a compatibility shim
- Reports route moved into:
  - `src/modules/reports/server/routes/reportsRoutes.ts`
- Compatibility shim retained at:
  - `src/server/routes/reportsRoutes.ts`
- Existing route registration imports remain supported through the shim
- Report engine moved into:
  - `src/modules/reports/server/services/reportEngine.ts`
- Compatibility shim retained at:
  - `src/server/services/reportEngine.ts`
- Existing service imports remain supported through the shim
- Reports repository moved into:
  - `src/modules/reports/server/repositories/reportsRepository.ts`
- Compatibility shim retained at:
  - `src/server/repositories/reportsRepository.ts`
- Existing repository imports remain supported through the shim
- School repository moved into:
  - `src/modules/reports/server/repositories/schoolRepository.ts`
- Compatibility shim retained at:
  - `src/server/repositories/schoolRepository.ts`
- Existing repository imports remain supported through the shim
- Settings repository moved into:
  - `src/modules/reports/server/repositories/settingsRepository.ts`
- Compatibility shim retained at:
  - `src/server/repositories/settingsRepository.ts`
- Existing repository imports remain supported through the shim
- Reports client moved into:
  - `src/modules/reports/client/reportsClient.ts`
- Compatibility shim retained at:
  - `src/client/reportsClient.ts`
- Module path is now canonical and runtime behavior is unchanged
- Imports client moved into:
  - `src/modules/reports/client/importsClient.ts`
- Compatibility shim retained at:
  - `src/client/importsClient.ts`
- Module path is now canonical and runtime behavior is unchanged
- Marksheets client moved into:
  - `src/modules/reports/client/marksheetsClient.ts`
- Compatibility shim retained at:
  - `src/client/marksheetsClient.ts`
- Module path is now canonical and runtime behavior is unchanged
- Report comment service moved into:
  - `src/modules/reports/server/services/reportCommentService.ts`
- Compatibility shim retained at:
  - `src/server/services/reportCommentService.ts`
- Module path is now canonical and runtime behavior is unchanged
- Marksheets page moved into:
  - `src/modules/reports/pages/MarksheetsPage.tsx`
- Compatibility shim retained at:
  - `src/pages/MarksheetsPage.tsx`
- Module path is canonical and runtime behavior and browser routes are unchanged
- Marks import page moved into:
  - `src/modules/reports/pages/MarksImportPage.tsx`
- Compatibility shim retained at:
  - `src/pages/MarksImportPage.tsx`
- Module path is canonical and runtime behavior and browser routes are unchanged
- Verify page moved into:
  - `src/modules/reports/pages/VerifyPage.tsx`
- Compatibility shim retained at:
  - `src/pages/VerifyPage.tsx`
- Module path is canonical and runtime behavior and public/browser verification routes are unchanged
- Build passed after the release-center client moves
- `npm run typecheck` still has unrelated repo-wide failures outside the client relocations
- Runtime files not moved yet

## Known Legacy Files Still Outside The Module

- `src/pages/ReportsPage.tsx`
- `src/modules/reports/client/reportsClient.ts`
- `src/client/reportsClient.ts` (compatibility shim)
- `src/modules/reports/client/importsClient.ts`
- `src/client/importsClient.ts` (compatibility shim)
- `src/modules/reports/client/marksheetsClient.ts`
- `src/client/marksheetsClient.ts` (compatibility shim)
- `src/modules/reports/pages/VerifyPage.tsx`
- `src/pages/VerifyPage.tsx` (compatibility shim)
- `src/modules/reports/pages/MarksImportPage.tsx`
- `src/pages/MarksImportPage.tsx` (compatibility shim)
- `src/modules/reports/pages/MarksheetsPage.tsx`
- `src/pages/MarksheetsPage.tsx` (compatibility shim)
- `src/modules/reports/server/services/reportCommentService.ts`
- `src/server/services/reportCommentService.ts` (compatibility shim)
- `src/pages/ReportsPage.tsx` still depends on the release-center-owned issue report client through `src/client/issueReportClient.ts`
- `src/modules/reports/server/routes/reportsRoutes.ts`
- `src/server/routes/reportsRoutes.ts` (compatibility shim)
- `src/modules/reports/server/services/reportEngine.ts`
- `src/server/services/reportEngine.ts` (compatibility shim)
- `src/modules/reports/server/repositories/reportsRepository.ts`
- `src/server/repositories/reportsRepository.ts` (compatibility shim)
- `src/modules/reports/server/repositories/schoolRepository.ts`
- `src/server/repositories/schoolRepository.ts` (compatibility shim)
- `src/modules/reports/server/repositories/settingsRepository.ts`
- `src/server/repositories/settingsRepository.ts` (compatibility shim)
- `src/server/routes/importsRoutes.ts`
- `src/server/routes/marksheetsRoutes.ts`
