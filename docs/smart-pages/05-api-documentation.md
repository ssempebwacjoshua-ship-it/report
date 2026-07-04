# School Connect Smart Pages API Documentation

## Authentication Expectations

- School Smart Pages routes require school-authenticated access and school context.
- Creator routes use creator authentication where external creator flows are supported.
- Public published document routes do not require authentication.
- If platform integration is enabled, protected Smart Pages routes also check module entitlement.

## School Context Expectations

School routes depend on `req.school` being present after school context resolution.

If school context is missing, the server returns `401 Authentication required.` for protected school routes.

## Platform Entitlement Behavior

When `SSAMENJ_PLATFORM_INTEGRATION_ENABLED=true`:

- School template access checks module entitlement.
- Smart Pages school routes can return `MODULE_NOT_ENABLED`.
- Platform failures can return `PLATFORM_INTEGRATION_UNAVAILABLE`.

When integration is disabled:

- Entitlement checks are bypassed.
- Usage recording becomes a no-op.

## Error Response Format

Common patterns used by Smart Pages routes:

- `{ error: "message" }`
- `{ ok: true, ... }`
- `{ error: "MODULE_NOT_ENABLED", moduleCode, message }`
- `{ error: "PASSWORD_REQUIRED", code: "PASSWORD_REQUIRED" }`
- `{ error: "WRONG_PASSWORD", code: "WRONG_PASSWORD" }`

## Route Group: Document Intelligence

### `GET /api/smart-documents`

- Purpose: list the current creator's Smart Pages documents.
- Auth/context: creator auth required; school context for school-owned content.
- Query: `vertical` is optional and accepts `SCHOOL`, `LAWYER`, or `GENERAL`.
- Response example:

```json
{
  "ok": true,
  "documents": [
    {
      "id": "doc-1",
      "title": "School Notice",
      "status": "DRAFT",
      "vertical": "SCHOOL",
      "createdAt": "2026-07-04T00:00:00.000Z",
      "updatedAt": "2026-07-04T00:00:00.000Z",
      "versionCount": 1,
      "hasSourceFiles": false
    }
  ]
}
```

### `POST /api/smart-documents`

- Purpose: create a new Smart Pages document.
- Auth/context: creator auth required.
- Body example:

```json
{ "title": "School Notice", "vertical": "SCHOOL" }
```

- Response example:

```json
{ "ok": true, "document": { "id": "doc-1", "title": "School Notice", "vertical": "SCHOOL" } }
```

### `GET /api/smart-documents/:id`

- Purpose: load one Smart Pages document.
- Auth/context: creator auth required.

### `POST /api/smart-documents/:id/upload`

- Purpose: upload a file for Smart Pages extraction.
- Auth/context: creator auth required; school documents only.
- Body: `multipart/form-data` with `file`.
- Supported uploads: PDF, image, CSV, XLS, XLSX.
- Common errors:
  - `400 No file uploaded.`
  - `415 Word documents are coming soon. Please upload PDF, image, CSV, or Excel.`
  - `403` or `503` from platform entitlement when enabled.
- Response example:

```json
{ "ok": true, "status": "PROCESSING", "sourceFileId": "file-1" }
```

### `POST /api/smart-documents/:id/extraction/retry`

- Purpose: retry document extraction, optionally in high accuracy mode.
- Auth/context: creator auth required; school documents only.
- Body example:

```json
{ "sourceFileId": "file-1", "highAccuracy": true }
```

### `PATCH /api/smart-documents/:id/extracted-knowledge`

- Purpose: save manual review edits to extracted content.
- Auth/context: creator auth required; school documents only.
- Body example:

```json
{ "knowledge": { "title": "School Notice", "documentType": "notice", "domain": "education", "sections": [] } }
```

### `POST /api/smart-documents/:id/generate`

- Purpose: generate a document version from extracted content and a prompt.
- Auth/context: creator auth required; school documents only.
- Body example:

```json
{ "intent": "Create a formal school notice", "templateId": "school-notice" }
```

- Common errors:
  - `400` if `intent` is missing.
  - `400` if the template id is not in the school registry.
  - `400` if no uploaded content exists yet.
  - `409` if extraction is still processing.

### `POST /api/smart-documents/:id/prompt`

- Purpose: apply a conversational edit to the current version.
- Auth/context: creator auth required; school documents only.
- Body example:

```json
{ "instruction": "Make the tone more formal." }
```

### `POST /api/smart-documents/:id/manual-version`

- Purpose: create a version from manual draft text.
- Auth/context: creator auth required; school documents only.
- Body example:

```json
{ "draft": "Draft text here", "title": "Optional title" }
```

### `POST /api/smart-documents/:id/lawyer-edit-plan`

- Purpose: return a lawyer editing plan for lawyer vertical documents.
- Auth/context: creator auth required.
- Body example:

```json
{ "instruction": "Tighten the opening", "currentContent": "..." }
```

### `GET /api/smart-documents/:id/versions`

- Purpose: list document versions.
- Auth/context: creator auth required.

### `POST /api/smart-documents/:id/versions/:versionId/restore`

- Purpose: restore a previous version.
- Auth/context: creator auth required.

### `GET /api/smart-documents/:id/print`

- Purpose: return print-ready HTML for the active version.
- Auth/context: creator auth required.

### `POST /api/smart-documents/:id/publish`

- Purpose: create a public share link for the active version.
- Auth/context: creator auth required; school documents only.
- Body example:

```json
{ "expiresInDays": 7, "password": "optional-password" }
```

- Response example:

```json
{ "ok": true, "token": "abcd1234", "url": "https://app.example/p/abcd1234" }
```

### `GET /api/smart-documents/p/:token`

- Purpose: fetch a public published document.
- Auth/context: public.
- Common errors:
  - `404` if the link is missing or expired.
  - `401 PASSWORD_REQUIRED` if the document has a password.
  - `401 WRONG_PASSWORD` if the password is wrong.

### `GET /api/smart-documents/p/:token/download/pdf`

- Purpose: download the published document as PDF.
- Auth/context: public.

## Route Group: Smart Pages Templates

### `GET /api/smart-pages/school/templates`

- Purpose: list school templates.
- Auth/context: school auth and school context required.
- Platform behavior: checks entitlement when platform integration is enabled.
- Query example: `?scope=parsed&search=notice`
- Response example:

```json
{
  "ok": true,
  "vertical": "SCHOOL",
  "templates": [
    { "id": "school-notice", "name": "School Notice", "category": "Notice", "vertical": "SCHOOL" }
  ]
}
```

### `GET /api/smart-pages/school/templates/:templateId`

- Purpose: fetch one school template.
- Auth/context: school auth and school context required.
- Common errors:
  - `404` if the template does not exist for the school registry.
  - `403` if platform entitlement is denied when integration is enabled.

### `GET /api/smart-pages/lawyer/templates`

- Purpose: list lawyer templates.
- Auth/context: feature-flagged by `ENABLE_SMART_PAGES_LAWYERS`.
- Common error: `404` when the lawyer vertical is disabled.

### `GET /api/smart-pages/lawyer/templates/:templateId`

- Purpose: fetch one lawyer template.
- Auth/context: feature-flagged by `ENABLE_SMART_PAGES_LAWYERS`.

## Route Group: Billing

### `GET /api/smart-pages/billing/config`

- Purpose: return billing configuration, packages, and network details.
- Auth/context: school context expected.

### `GET /api/smart-pages/billing/summary`

- Purpose: return the school's Smart Pages summary, ledger, and payment history.
- Auth/context: school context required.

### `POST /api/smart-pages/billing/claim-trial`

- Purpose: claim the free trial pages.
- Auth/context: school context required.

### `POST /api/smart-pages/billing/payments`

- Purpose: create a payment request.
- Auth/context: school context required.
- Body example:

```json
{ "packageCode": "STARTER", "network": "MTN", "amountUgx": 50000 }
```

### `PATCH /api/smart-pages/billing/payments/:paymentId/receipt`

- Purpose: submit the payment receipt details.
- Auth/context: school context required.
- Body example:

```json
{ "packageCode": "STARTER", "network": "MTN", "amountUgx": 50000, "transactionId": "MP230600001234" }
```

## Route Group: Collections and Bulk Jobs

### `GET /api/collections`

- Purpose: list creator collections.
- Auth/context: creator auth required.

### `POST /api/collections`

- Purpose: create a collection.
- Body example:

```json
{ "name": "Grade 7A Students", "type": "STUDENTS" }
```

### `GET /api/collections/:id`

- Purpose: get a collection and its records.

### `PATCH /api/collections/:id`

- Purpose: update a collection.

### `DELETE /api/collections/:id`

- Purpose: delete a collection.

### `POST /api/collections/:id/records`

- Purpose: add a record to a collection.
- Body example:

```json
{ "data": { "name": "Amina", "class": "P3", "admissionNumber": "123" } }
```

### `DELETE /api/collections/:id/records/:recordId`

- Purpose: delete a record from a collection.

### `POST /api/collections/:id/import-csv`

- Purpose: import collection records from CSV.

### `POST /api/bulk-jobs`

- Purpose: start a bulk generation job.
- Body example:

```json
{ "collectionId": "col-1", "intent": "Create a parent notice for each record" }
```

### `GET /api/bulk-jobs`

- Purpose: list bulk jobs for the creator.

### `GET /api/bulk-jobs/:id`

- Purpose: get bulk job status and outputs.

## Route Group: Document OS

### `GET /api/document-os/preferences`

- Purpose: list creator preferences.
- Query example: `?scope=school`

### `PUT /api/document-os/preferences`

- Purpose: save a creator preference.
- Body example:

```json
{ "key": "primaryColor", "value": "#2563eb" }
```

### `DELETE /api/document-os/preferences/:key`

- Purpose: delete a creator preference.

### `GET /api/document-os/workflows`

- Purpose: list automation workflows.

### `POST /api/document-os/workflows`

- Purpose: create a workflow.

### `PATCH /api/document-os/workflows/:id`

- Purpose: update a workflow.

### `DELETE /api/document-os/workflows/:id`

- Purpose: delete a workflow.

### `POST /api/document-os/agent`

- Purpose: run the document agent.
- Body example:

```json
{ "domain": "school", "instruction": "Summarize this document", "documentId": "doc-1" }
```

### `GET /api/document-os/search`

- Purpose: search documents, collections, records, versions, and published pages.
- Query example: `?q=term opening notice`

### `POST /api/document-os/search/reindex`

- Purpose: rebuild the search index.

### `GET /api/document-os/notifications`

- Purpose: list notifications.
- Query example: `?includeRead=true`

### `PATCH /api/document-os/notifications/:id/read`

- Purpose: mark a notification as read.

### `GET /api/document-os/analytics`

- Purpose: fetch Smart Pages analytics.

### `POST /api/document-os/workflows/suggest`

- Purpose: ask the system to suggest a workflow.

### `POST /api/document-os/documents/:id/summarize`

- Purpose: summarize a document.

### `POST /api/document-os/documents/:id/classify`

- Purpose: classify a document.

### `POST /api/document-os/documents/:id/rewrite-tone`

- Purpose: rewrite the tone of a document.

### `POST /api/document-os/documents/:id/translate`

- Purpose: translate a document.

### `GET /api/document-os/documents/:id/export/:format`

- Purpose: export a document as PDF, DOCX, Markdown, or schema output.

## Notes on Tenant Isolation

- School document routes must stay inside school context.
- School template routes are protected and do not act like public marketing pages.
- Public published links expose the rendered document only, not backend secrets or service tokens.
- Platform entitlement failures should not leak tokens or internal implementation details.

