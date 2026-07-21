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
  - `src/pages/MarksImportPage.tsx`
  - `src/pages/MarksheetsPage.tsx`
  - `src/pages/VerifyPage.tsx`

## Owned Server Routes

- API: `/api/reports*`, `/api/imports/*`, `/api/marksheets/*`, `/api/verify/:code`
- Current route files still outside the module:
  - `src/server/routes/reportsRoutes.ts`
  - `src/server/routes/importsRoutes.ts`
  - `src/server/routes/marksheetsRoutes.ts`
  - `src/server/routes/verifyRoutes.ts`
  - `src/server/routes/reportIssueRoutes.ts`
  - `src/server/routes/promotionRoutes.ts`

## Owned Services

- Report generation, comments, import, marksheet, validation, and promotion services
- Current legacy files still outside the module:
  - `src/server/services/reportEngine.ts`
  - `src/server/services/reportCommentService.ts`
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

## Owned Repositories

- None isolated yet

## Owned Client API Files

- Current legacy files:
  - `src/client/reportsClient.ts`
  - `src/client/importsClient.ts`
  - `src/client/marksheetsClient.ts`
  - `src/client/issueReportClient.ts`

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
- Runtime files not moved yet

## Known Legacy Files Still Outside The Module

- `src/pages/ReportsPage.tsx`
- `src/pages/MarksImportPage.tsx`
- `src/pages/MarksheetsPage.tsx`
- `src/pages/VerifyPage.tsx`
- `src/client/reportsClient.ts`
- `src/client/importsClient.ts`
- `src/client/marksheetsClient.ts`
- `src/server/routes/reportsRoutes.ts`
- `src/server/routes/importsRoutes.ts`
- `src/server/routes/marksheetsRoutes.ts`
