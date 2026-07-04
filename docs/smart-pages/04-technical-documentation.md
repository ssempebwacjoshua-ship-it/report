# School Connect Smart Pages Technical Documentation

## System Architecture

Smart Pages is built as a React frontend with an Express backend and Prisma-backed data access.

Main layers:

- Frontend pages and reusable components for Smart Pages workflows.
- Server routes for document intelligence, templates, billing, collections, bulk jobs, and creator utilities.
- Prisma models for documents, versions, source files, published pages, collections, bulk jobs, preferences, notifications, analytics, and billing records.
- Gemini-based document intelligence for extraction and generation.
- Optional OCR/provider flow for harder extraction cases.
- Optional platform entitlement integration for module checks and usage reporting.

## Frontend Overview

Current Smart Pages frontend entry points include:

- `SmartPagesPage`
- `DocumentEditorPage`
- `PublishedDocumentPage`
- `SmartPagesBillingPage`
- `CollectionsPage`
- `BulkGeneratePage`
- `SearchPage`
- `AnalyticsPage`
- `NotificationsPage`
- `PreferencesPage`

Shared Smart Pages UI components include:

- `DocumentPreview`
- `SmartPageTemplatePicker`

The app routes place school Smart Pages under authenticated app routes, while the published document page is public.

## Backend Overview

Core Smart Pages backend route groups:

- `/api/smart-documents`
- `/api/smart-pages/school/templates`
- `/api/smart-pages/lawyer/templates`
- `/api/smart-pages/billing/*`
- `/api/collections/*`
- `/api/bulk-jobs/*`
- `/api/document-os/*`

The backend also exposes public published document routes under `/api/smart-documents/p/:token`.

## Database and Schema Overview

Relevant Prisma models:

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
- `SmartPageLedger`
- `SmartPagePaymentRequest`

Key fields used by Smart Pages:

- `SmartDocument.vertical`
- `SmartDocument.extractedKnowledge`
- `SmartDocument.extractionStatus`
- `SmartDocument.extractionError`
- `DocumentSourceFile.ocrQuality`
- `DocumentSourceFile.extractionStartedAt`
- `DocumentSourceFile.extractionCompletedAt`
- `PublishedDocument.token`
- `PublishedDocument.passwordHash`
- `Collection.type`
- `BulkGenerationJob.status`

## Authentication and School Context

School Smart Pages routes rely on the school auth flow and school context middleware.

Important points:

- School-authenticated routes use the school token path.
- Creator-authenticated routes use creator tokens for external creator flows.
- `resolveSchoolContext` populates `req.school` for school routes.
- `enforceSchoolRoleAccess` protects school admin features.
- Public published pages do not require school auth.

## Document Intelligence Architecture

Document intelligence is implemented in `src/server/services/documentIntelligenceService.ts` and `src/server/services/documentGeminiService.ts`.

Current behaviors:

- Uploaded school documents create a `DocumentSourceFile`.
- Extracted text is stored in `extractedKnowledge`.
- Generated output is stored as `DocumentVersion` and linked to `SmartDocument.activeVersionId`.
- Publishing creates a `PublishedDocument` with a token.
- Search and analytics entries are updated after major actions.

## Upload and Extraction Flow

Current upload flow:

1. A school user uploads a file to `/api/smart-documents/:id/upload`.
1. The server stores the file as a source file record.
1. The document enters `PROCESSING`.
1. Structured files such as CSV/XLS/XLSX are parsed locally when possible.
1. Other supported uploads are processed through OCR and Gemini-assisted extraction.
1. The extracted result is stored and marked ready for review.

Supported upload types in the current code:

- PDF
- Image
- CSV
- XLS
- XLSX

Known upload constraint:

- Word documents are rejected for now and treated as a future enhancement.

## Smart Pages Template Architecture

Templates live in `src/shared/smartPagesTemplates.ts`.

Template registry details:

- Each template has an id, name, description, category, scope, and prompt builder.
- School templates are marked with the school vertical.
- Summary templates expose multiple summary styles.
- Bulk templates use collection context.

Route behavior:

- School template routes are mounted after school context resolution.
- School template routes require platform entitlement when integration is enabled.
- Lawyer templates are feature-flagged with `ENABLE_SMART_PAGES_LAWYERS`.

This means the current school template boundary is explicit and protected.

## OCR and AI Provider Flow

AI and OCR behavior is split:

- Gemini is used for extraction, schema generation, prompt editing, summaries, and edit plans.
- OCR can be used for image and scan preprocessing depending on environment settings.
- Structured spreadsheet files can bypass AI extraction and be parsed locally.

Relevant environment variable names:

- `GEMINI_API_KEY`
- `SMART_PAGES_GEMINI_FAST_MODEL`
- `SMART_PAGES_GEMINI_HIGH_ACCURACY_MODEL`
- `SMART_PAGES_GEMINI_STABLE_ACCURACY_MODEL`
- `SMART_PAGES_GEMINI_FAST_TIMEOUT_MS`
- `SMART_PAGES_GEMINI_HIGH_ACCURACY_TIMEOUT_MS`
- `SMART_PAGES_GEMINI_MAX_RETRIES`
- `OCR_ENABLED`
- `OCR_PROVIDER`
- `AZURE_OCR_FUNCTION_URL`

## Platform Entitlement Integration

Smart Pages can integrate with the parent platform for module entitlement and usage reporting.

Relevant environment variables:

- `SSAMENJ_PLATFORM_INTEGRATION_ENABLED`
- `SSAMENJ_PLATFORM_URL`
- `SSAMENJ_PLATFORM_SERVICE_TOKEN`
- `SSAMENJ_PLATFORM_TIMEOUT_MS`
- `SSAMENJ_PLATFORM_PRODUCT_CODE`

Implementation notes:

- If integration is disabled, entitlement checks allow access and usage recording becomes a no-op.
- If integration is enabled, startup validation requires the platform URL and service token.
- Entitlement failures return controlled 401, 403, or 503 responses.
- Usage recording failures are downgraded to warnings instead of crashing the request.

## Environment Variables

Names only, no values:

- `JWT_SECRET`
- `DATABASE_URL`
- `CLIENT_ORIGIN`
- `APP_BASE_URL`
- `PUBLIC_APP_URL`
- `PLATFORM_ADMIN_KEY`
- `INTERNAL_TEST_KEY`
- `GEMINI_API_KEY`
- `SMART_PAGES_GEMINI_FAST_MODEL`
- `SMART_PAGES_GEMINI_HIGH_ACCURACY_MODEL`
- `SMART_PAGES_GEMINI_STABLE_ACCURACY_MODEL`
- `SMART_PAGES_GEMINI_FAST_TIMEOUT_MS`
- `SMART_PAGES_GEMINI_HIGH_ACCURACY_TIMEOUT_MS`
- `SMART_PAGES_GEMINI_MAX_RETRIES`
- `OCR_ENABLED`
- `OCR_PROVIDER`
- `AZURE_OCR_FUNCTION_URL`
- `SSAMENJ_PLATFORM_INTEGRATION_ENABLED`
- `SSAMENJ_PLATFORM_URL`
- `SSAMENJ_PLATFORM_SERVICE_TOKEN`
- `SSAMENJ_PLATFORM_TIMEOUT_MS`
- `SSAMENJ_PLATFORM_PRODUCT_CODE`
- `ENABLE_SMART_PAGES_LAWYERS`
- `VITE_ENABLE_SMART_PAGES_LAWYERS`

## Deployment Overview

The repo does not currently include a `vercel.json` or `railway.json` file.

What the scripts show:

- `npm run build` builds the client with Vite and the server with esbuild.
- `npm run start:prod` runs Prisma migrations and then starts the bundled Node server.
- `npm run railway:start` is an alias for the production start path.
- The server serves the built `dist/` output when present.

That means the codebase is deployable as a bundled Node service, and the frontend can be served from the same process after build.

## Testing Overview

Relevant tests include:

- `src/tests/routes/smartPagesTemplateRoutes.test.ts`
- `src/tests/routes/platformIntegration.test.ts`
- `src/tests/server/platformClient.test.ts`
- `src/tests/routes/documentIntelligenceRoutes.vertical.test.ts`
- `src/tests/services/documentIntelligenceService.test.ts`
- `src/tests/shared/smartPageTemplates.test.ts`
- `src/tests/routes/smartPagesBillingRoutes.test.ts`
- `src/tests/services/smartPagesService.test.ts`

Useful commands:

- `npm run test:critical`
- `npx vitest run src/tests/routes/platformIntegration.test.ts src/tests/server/platformClient.test.ts`
- `npx vitest run src/tests/routes/smartPagesTemplateRoutes.test.ts`
- `npm run build`

## Error Handling

Common Smart Pages error patterns:

- Validation errors return 400 responses with `error` messages.
- Missing upload files return 400.
- Unsupported Word uploads return 415.
- Extraction in progress returns 409 for generation/editing actions.
- Missing source file returns 404 for retry paths.
- Platform entitlement issues can return 401, 403, or 503.
- Public publish routes can return password-required or wrong-password responses.

## Known Constraints

- Word document uploads are not supported yet.
- Smart Pages output must be reviewed by a human before release.
- Platform entitlement depends on the integration being enabled.
- Lawyer templates are separate and feature-flagged.
- Public publish links expose the rendered document only, not backend secrets or tokens.

## Future Roadmap

Planned or future enhancements that are visible from the codebase:

- Word document upload support.
- Broader file support and better OCR fallback paths.
- Additional Smart Pages template coverage.
- More automation around collections and bulk generation.
- Stronger template management for school-specific branding.

