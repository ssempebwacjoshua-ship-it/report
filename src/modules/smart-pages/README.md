# Smart Pages Module

## Purpose

Owns document intelligence, creator/document OS flows, published smart pages, collections, bulk generation, billing, templates, analytics, notifications, and optional lawyer vertical pages.

## Owned Public Routes

- Public published-document paths must remain stable
- Current public paths:
  - `/report-lab/p/:token`
- Route registration files:
  - `src/server/modules/registerSmartPagesRoutes.ts`
  - `src/server/modules/registerPublicRoutes.ts`

## Owned Frontend Routes/Pages

- Browser: `/report-lab/smart-pages`, `/report-lab/collections`, `/report-lab/bulk-jobs/:id`, `/report-lab/analytics`, `/report-lab/preferences`, `/report-lab/notifications`, `/report-lab/p/:token`, optional `/report-lab/lawyers/*`
- Current legacy files:
  - `src/pages/smart-pages/*`
  - `src/pages/lawyers/*`

## Owned Server Routes

- API: `/api/smart-documents/*`, `/api/document-os/*`, `/api/collections/*`, `/api/bulk-jobs/*`, `/api/smart-pages/*`, `/api/creator/*`
- Current route files still outside the module:
  - `src/server/routes/documentIntelligenceRoutes.ts`
  - `src/server/routes/documentOsRoutes.ts`
  - `src/server/routes/collectionRoutes.ts`
  - `src/server/routes/bulkGenerationRoutes.ts`
  - `src/server/routes/smartPagesBillingRoutes.ts`
  - `src/server/routes/smartPagesTemplateRoutes.ts`

## Owned Services

- OCR, document intelligence, document OS, bulk generation, publishing, collections, and billing services
- Current legacy files still outside the module:
  - `src/server/services/documentIntelligenceService.ts`
  - `src/server/services/documentOsService.ts`
  - `src/server/services/documentGeminiService.ts`
  - `src/server/services/documentRenderService.ts`
  - `src/server/services/documentExportService.ts`
  - `src/server/services/documentCleanerService.ts`
  - `src/server/services/documentCleanerNormalizeService.ts`
  - `src/server/services/documentCleanerPricingService.ts`
  - `src/server/services/documentCleanerProviderService.ts`
  - `src/server/services/bulkGenerationService.ts`
  - `src/server/services/collectionService.ts`
  - `src/server/services/smartPagesService.ts`

## Owned Repositories

- None isolated yet

## Owned Client API Files

- Current legacy files:
  - `src/client/documentIntelligenceClient.ts`
  - `src/client/documentOsClient.ts`
  - `src/client/collectionsClient.ts`
  - `src/client/smartPagesBillingClient.ts`

## Owned Tests

- Current legacy tests still outside the module:
  - `src/tests/routes/documentIntelligenceRoutes.vertical.test.ts`
  - `src/tests/routes/documentOsPreferencesRoutes.test.ts`
  - `src/tests/routes/smartPagesBillingRoutes.test.ts`
  - `src/tests/routes/smartPagesTemplateRoutes.test.ts`
  - `src/tests/routes/smartPagesVerticalIsolation.test.ts`
  - `src/tests/services/document*`
  - `src/tests/services/bulkGenerationService*.test.ts`
  - `src/tests/services/smartPages*.test.ts`
  - `src/tests/shared/smartPageTemplates.test.ts`
  - `src/tests/ui/SmartPagesBilling.test.tsx`
  - `src/tests/ui/SmartPageTemplatePicker.test.tsx`

## Owned Prisma Models, If Any

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

## Owned Permissions

- Smart-pages create/publish/billing/template permissions
- Exact permission names must be mapped during module migration

## Owned Audit Events

- Publish, billing, creator, template, and document-processing audit events
- Exact event names must be mapped during module migration

## Shared Dependencies

- Shared auth plus creator-auth boundaries
- Owner billing/subscription integration points

## External Providers/Integrations

- OCR and AI/document-processing providers
- Billing/payment integrations where applicable

## Background Jobs/Workers

- Document processing, publishing, and bulk-generation workers
- Worker startup remains centralized in `src/server/modules/registerWorkers.ts`

## High-Risk Flows

- Smart Pages billing
- Extraction/AI/OCR
- Public published links

## Migration Status

- Skeleton only
- Ownership contract defined
- Runtime files not moved yet

## Known Legacy Files Still Outside The Module

- `src/pages/smart-pages/*`
- `src/pages/lawyers/*`
- `src/components/smart-pages/*`
- `src/components/lawyers/*`
- `src/client/documentIntelligenceClient.ts`
- `src/client/documentOsClient.ts`
- `src/client/collectionsClient.ts`
- `src/client/smartPagesBillingClient.ts`
- `src/server/routes/documentIntelligenceRoutes.ts`
- `src/server/routes/documentOsRoutes.ts`
