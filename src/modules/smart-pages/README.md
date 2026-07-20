# Smart Pages Module

## Module Purpose

Owns document intelligence, creator/document OS flows, published smart pages, collections, bulk generation, billing, templates, analytics, notifications, and optional lawyer vertical pages.

## Owned Routes

- Browser: `/report-lab/smart-pages`, `/report-lab/collections`, `/report-lab/bulk-jobs/:id`, `/report-lab/analytics`, `/report-lab/preferences`, `/report-lab/notifications`, `/report-lab/p/:token`, optional `/report-lab/lawyers/*`
- API: `/api/smart-documents/*`, `/api/document-os/*`, `/api/collections/*`, `/api/bulk-jobs/*`, `/api/smart-pages/*`, `/api/creator/*`

## Owned DB Models

- `Creator`
- `SchoolSmartPagePlan`
- `SmartPageLedger`
- `SmartPagePaymentRequest`
- `SmartDocument`
- `DocumentVersion`
- `DocumentSourceFile`
- `PublishedDocument`
- `Collection`
- `CollectionRecord`
- `BulkGenerationJob`
- `BulkJobOutput`
- `CreatorPreference`
- `AutomationWorkflow`
- `SearchIndex`
- `Notification`
- `DocumentAnalytics`
- `DocumentCleanerJob`

## Owned Frontend Pages And Components

- `src/pages/smart-pages/*`
- `src/pages/lawyers/*`
- `src/components/smart-pages/*`
- `src/components/lawyers/*`
- `src/client/documentIntelligenceClient.ts`
- `src/client/documentOsClient.ts`
- `src/client/smartPagesBillingClient.ts`

## Known Integration Points

- Auth is split between school users and creator-auth flows.
- Billing/subscription data overlaps with owner console and shared platform settings.
- Background workers currently start from the main API server process.
- Published document links are public and must remain stable.
