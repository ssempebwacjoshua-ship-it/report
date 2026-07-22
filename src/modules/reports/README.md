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
- Module-owned page now moved into:
  - `src/modules/reports/pages/PromotionWorkspacePage.tsx`
- Compatibility shim retained at:
  - `src/pages/PromotionWorkspacePage.tsx`
- Browser routes remain unchanged through the shim
- Promotion workspace remains Reports-owned
- Module-owned page now moved into:
  - `src/modules/reports/pages/ReportsPage.tsx`
- Compatibility shim retained at:
  - `src/pages/ReportsPage.tsx`
- Browser routes remain unchanged through the shim
- Intentional cross-module dependency retained for report issuing/release:
  - `src/modules/reports/pages/ReportsPage.tsx` depends on `src/modules/release-center/client/issueReportClient.ts`
  - Release-center remains the owner of report issue/release behavior
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
  - none in Reports ownership; `src/server/routes/reportIssueRoutes.ts` remains Release Center-owned
- Module-owned route now moved into:
  - `src/modules/reports/server/routes/reportAssistantRoutes.ts`
- Compatibility shim retained at:
  - `src/server/routes/reportAssistantRoutes.ts`
- Existing route registration imports remain supported through the shim
- Module-owned route now moved into:
  - `src/modules/reports/server/routes/marksheetsRoutes.ts`
- Compatibility shim retained at:
  - `src/server/routes/marksheetsRoutes.ts`
- Existing route registration imports remain supported through the shim
- Module-owned route now moved into:
  - `src/modules/reports/server/routes/importsRoutes.ts`
- Compatibility shim retained at:
  - `src/server/routes/importsRoutes.ts`
- Existing route registration imports remain supported through the shim
- Module-owned route now moved into:
  - `src/modules/reports/server/routes/verifyRoutes.ts`
- Compatibility shim retained at:
  - `src/server/routes/verifyRoutes.ts`
- Existing route registration imports remain supported through the shim
- Module-owned route now moved into:
  - `src/modules/reports/server/routes/promotionRoutes.ts`
- Compatibility shim retained at:
  - `src/server/routes/promotionRoutes.ts`
- Existing route registration imports remain supported through the shim
- Module-owned route now moved into:
  - `src/modules/reports/server/routes/reportsRoutes.ts`
- Compatibility shim retained at:
  - `src/server/routes/reportsRoutes.ts`
- Existing route registration imports remain supported through the shim

## Owned Services

- Report generation, comments, import, marksheet, validation, and promotion services
- Module-owned service now moved into:
  - `src/modules/reports/server/services/marksImportService.ts`
- Compatibility shim retained at:
  - `src/server/services/marksImportService.ts`
- Existing service imports remain supported through the shim
- Module-owned service now moved into:
  - `src/modules/reports/server/services/promotionService.ts`
- Compatibility shim retained at:
  - `src/server/services/promotionService.ts`
- Existing service imports remain supported through the shim
- Module-owned service now moved into:
  - `src/modules/reports/server/services/gradeService.ts`
- Compatibility shim retained at:
  - `src/server/services/gradeService.ts`
- Existing service imports remain supported through the shim
- Module-owned service now moved into:
  - `src/modules/reports/server/services/rankingService.ts`
- Compatibility shim retained at:
  - `src/server/services/rankingService.ts`
- Existing service imports remain supported through the shim
- Module-owned service now moved into:
  - `src/modules/reports/server/services/marksheetIdDetectionService.ts`
- Compatibility shim retained at:
  - `src/server/services/marksheetIdDetectionService.ts`
- Existing service imports remain supported through the shim
- Module-owned service now moved into:
  - `src/modules/reports/server/services/marksheetContextService.ts`
- Compatibility shim retained at:
  - `src/server/services/marksheetContextService.ts`
- Existing service imports remain supported through the shim
- Module-owned service now moved into:
  - `src/modules/reports/server/services/marksheetGeometryService.ts`
- Compatibility shim retained at:
  - `src/server/services/marksheetGeometryService.ts`
- Existing service imports remain supported through the shim
- Module-owned service now moved into:
  - `src/modules/reports/server/services/marksheetTableDetection.ts`
- Compatibility shim retained at:
  - `src/server/services/marksheetTableDetection.ts`
- Existing service imports remain supported through the shim
- Module-owned service now moved into:
  - `src/modules/reports/server/services/subjectComponentResolver.ts`
- Compatibility shim retained at:
  - `src/server/services/subjectComponentResolver.ts`
- Existing service imports remain supported through the shim
- Module-owned service now moved into:
  - `src/modules/reports/server/services/scoreValidationService.ts`
- Compatibility shim retained at:
  - `src/server/services/scoreValidationService.ts`
- Existing service imports remain supported through the shim
- Module-owned service now moved into:
  - `src/modules/reports/server/services/marksImportValidator.ts`
- Compatibility shim retained at:
  - `src/server/services/marksImportValidator.ts`
- Existing service imports remain supported through the shim
- Module-owned service now moved into:
  - `src/modules/reports/server/services/reportAssistantContextService.ts`
- Compatibility shim retained at:
  - `src/server/services/reportAssistantContextService.ts`
- Existing service imports remain supported through the shim
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
  - `src/modules/reports/pages/ReportsPage.tsx` uses it directly as a canonical cross-module dependency
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
  - `src/tests/shared/remarksEngine.test.ts`
  - `src/tests/shared/reportComments.test.ts`
  - `src/tests/shared/reportContentLimits.test.ts`
  - `src/tests/ui/ReportsPage.test.tsx`
  - `src/tests/ui/MarksImportPageModes.test.tsx`
  - `src/tests/ui/MarksheetsPage.test.tsx`
- Module-owned tests now moved into:
  - `src/modules/reports/tests/services/reportEngine.test.ts`

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
- Reports still consume the release-center-owned issue report client as a direct canonical cross-module dependency
- Promotion workspace page moved into:
  - `src/modules/reports/pages/PromotionWorkspacePage.tsx`
- Compatibility shim retained at:
  - `src/pages/PromotionWorkspacePage.tsx`
- Module path is now canonical and browser/runtime behavior is unchanged
- Reports page moved into:
  - `src/modules/reports/pages/ReportsPage.tsx`
- Compatibility shim retained at:
  - `src/pages/ReportsPage.tsx`
- Module path is now canonical and browser/runtime behavior is unchanged
- Reports page intentionally depends on the release-center-owned issue report client for report issuing/release
- Report assistant routes moved into:
  - `src/modules/reports/server/routes/reportAssistantRoutes.ts`
- Compatibility shim retained at:
  - `src/server/routes/reportAssistantRoutes.ts`
- Module path is now canonical and runtime behavior is unchanged
- Verify routes moved into:
  - `src/modules/reports/server/routes/verifyRoutes.ts`
- Compatibility shim retained at:
  - `src/server/routes/verifyRoutes.ts`
- Module path is now canonical and runtime behavior is unchanged
- Promotion routes moved into:
  - `src/modules/reports/server/routes/promotionRoutes.ts`
- Compatibility shim retained at:
  - `src/server/routes/promotionRoutes.ts`
- Module path is now canonical and runtime behavior is unchanged
- Reports route moved into:
  - `src/modules/reports/server/routes/reportsRoutes.ts`
- Compatibility shim retained at:
  - `src/server/routes/reportsRoutes.ts`
- Existing route registration imports remain supported through the shim
- Marksheets routes moved into:
  - `src/modules/reports/server/routes/marksheetsRoutes.ts`
- Compatibility shim retained at:
  - `src/server/routes/marksheetsRoutes.ts`
- Module path is now canonical and runtime behavior is unchanged
- Imports routes moved into:
  - `src/modules/reports/server/routes/importsRoutes.ts`
- Compatibility shim retained at:
  - `src/server/routes/importsRoutes.ts`
- Module path is now canonical and runtime behavior is unchanged
- Report engine moved into:
  - `src/modules/reports/server/services/reportEngine.ts`
- Compatibility shim retained at:
  - `src/server/services/reportEngine.ts`
- Existing service imports remain supported through the shim
- Grade service moved into:
  - `src/modules/reports/server/services/gradeService.ts`
- Compatibility shim retained at:
  - `src/server/services/gradeService.ts`
- Module path is now canonical and runtime behavior is unchanged
- Ranking service moved into:
  - `src/modules/reports/server/services/rankingService.ts`
- Compatibility shim retained at:
  - `src/server/services/rankingService.ts`
- Module path is now canonical and runtime behavior is unchanged
- Confirmed Reports-owned runtime implementation relocation is complete pending final verification and tests cleanup
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
- Marks import service moved into:
  - `src/modules/reports/server/services/marksImportService.ts`
- Compatibility shim retained at:
  - `src/server/services/marksImportService.ts`
- Module path is now canonical and runtime behavior is unchanged
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
- Promotion service moved into:
  - `src/modules/reports/server/services/promotionService.ts`
- Compatibility shim retained at:
  - `src/server/services/promotionService.ts`
- Module path is now canonical and runtime behavior is unchanged
- Marksheet ID detection service moved into:
  - `src/modules/reports/server/services/marksheetIdDetectionService.ts`
- Compatibility shim retained at:
  - `src/server/services/marksheetIdDetectionService.ts`
- Module path is now canonical and runtime behavior is unchanged
- Marksheet context service moved into:
  - `src/modules/reports/server/services/marksheetContextService.ts`
- Compatibility shim retained at:
  - `src/server/services/marksheetContextService.ts`
- Module path is now canonical and runtime behavior is unchanged
- Marksheet geometry service moved into:
  - `src/modules/reports/server/services/marksheetGeometryService.ts`
- Compatibility shim retained at:
  - `src/server/services/marksheetGeometryService.ts`
- Module path is now canonical and runtime behavior is unchanged
- Marksheet table detection moved into:
  - `src/modules/reports/server/services/marksheetTableDetection.ts`
- Compatibility shim retained at:
  - `src/server/services/marksheetTableDetection.ts`
- Module path is now canonical and runtime behavior is unchanged
- Subject component resolver moved into:
  - `src/modules/reports/server/services/subjectComponentResolver.ts`
- Compatibility shim retained at:
  - `src/server/services/subjectComponentResolver.ts`
- Module path is now canonical and runtime behavior is unchanged
- Score validation service moved into:
  - `src/modules/reports/server/services/scoreValidationService.ts`
- Compatibility shim retained at:
  - `src/server/services/scoreValidationService.ts`
- Module path is now canonical and runtime behavior is unchanged
- Marks import validator moved into:
  - `src/modules/reports/server/services/marksImportValidator.ts`
- Compatibility shim retained at:
  - `src/server/services/marksImportValidator.ts`
- Module path is now canonical and runtime behavior is unchanged
- Report assistant context service moved into:
  - `src/modules/reports/server/services/reportAssistantContextService.ts`
- Compatibility shim retained at:
  - `src/server/services/reportAssistantContextService.ts`
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
- `src/modules/reports/server/services/promotionService.ts`
- `src/server/services/promotionService.ts` (compatibility shim)
- `src/modules/reports/server/services/marksheetIdDetectionService.ts`
- `src/server/services/marksheetIdDetectionService.ts` (compatibility shim)
- `src/modules/reports/server/services/marksheetContextService.ts`
- `src/server/services/marksheetContextService.ts` (compatibility shim)
- `src/modules/reports/server/services/marksheetGeometryService.ts`
- `src/server/services/marksheetGeometryService.ts` (compatibility shim)
- `src/modules/reports/server/services/marksheetTableDetection.ts`
- `src/server/services/marksheetTableDetection.ts` (compatibility shim)
- `src/modules/reports/server/services/subjectComponentResolver.ts`
- `src/server/services/subjectComponentResolver.ts` (compatibility shim)
- `src/modules/reports/server/services/scoreValidationService.ts`
- `src/server/services/scoreValidationService.ts` (compatibility shim)
- `src/modules/reports/server/services/marksImportValidator.ts`
- `src/server/services/marksImportValidator.ts` (compatibility shim)
- `src/modules/reports/server/services/reportAssistantContextService.ts`
- `src/server/services/reportAssistantContextService.ts` (compatibility shim)
- `src/modules/reports/server/services/reportCommentService.ts`
- `src/server/services/reportCommentService.ts` (compatibility shim)
- `src/modules/reports/pages/ReportsPage.tsx` depends on the release-center-owned `src/modules/release-center/client/issueReportClient.ts`
- `src/modules/reports/server/routes/verifyRoutes.ts`
- `src/server/routes/verifyRoutes.ts` (compatibility shim)
- `src/modules/reports/server/routes/promotionRoutes.ts`
- `src/server/routes/promotionRoutes.ts` (compatibility shim)
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
