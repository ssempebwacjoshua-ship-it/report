# Reports Module

## Module Purpose

Owns academic reporting, report rendering, marks import workflows, marksheets, report comments, assistant tooling, verification support, and report issuance data flows that are not specific to Release Center messaging.

## Owned Routes

- Browser: `/report-lab/reports`, `/report-lab/imports/marks`, `/report-lab/marksheets`, `/report-lab/verify/:code`
- API: `/api/reports*`, `/api/imports/*`, `/api/marksheets/*`, `/api/verify/:code`

## Owned DB Models

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

## Owned Frontend Pages And Components

- `src/pages/ReportsPage.tsx`
- `src/pages/MarksImportPage.tsx`
- `src/pages/MarksheetsPage.tsx`
- `src/pages/VerifyPage.tsx`
- `src/components/reports/*`
- `src/components/imports/*`
- `src/components/marksheets/*`

## Known Integration Points

- Release Center consumes issued report and parent-link data from reports flows.
- Communications uses report-release messaging helpers and parent contact data.
- Shared auth, settings, and school context middleware gate access to most reports routes.
- Smart Pages and owner tooling currently share subscription/platform data from the same schema.
