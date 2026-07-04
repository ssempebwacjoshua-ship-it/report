# School Connect Report Lab Technical Documentation

## System Architecture

Report Lab is a web application with:

- A React frontend
- An Express backend
- A PostgreSQL database through Prisma
- Public pages for parent reports and verification
- Authenticated school staff routes for report generation and setup

The backend resolves school context before protected school routes run, which keeps data isolated per school.

## Frontend Overview

The frontend uses React Router and client-side API wrappers in `src/client/*`.

Key screens involved in Report Lab:

- Dashboard
- Students
- Marks Import
- Reports
- Release Center
- Settings
- Parent report page
- Verification page

## Backend Overview

The backend exposes the Report Lab APIs through Express route modules in `src/server/routes/*`.

Important route modules:

- `authRoutes.ts`
- `studentsRoutes.ts`
- `schoolStructureRoutes.ts`
- `settingsRoutes.ts`
- `importsRoutes.ts`
- `marksheetsRoutes.ts`
- `reportsRoutes.ts`
- `reportIssueRoutes.ts`
- `releaseCenterRoutes.ts`
- `verifyRoutes.ts`
- `ocrRoutes.ts`
- `geminiMarksImportRoutes.ts`

## Database Overview

The system uses PostgreSQL with Prisma models for:

- School
- AcademicYear
- Term
- SchoolClass
- Stream
- Student
- ClassEnrollment
- GuardianContact
- Subject
- SubjectComponent
- SubjectMark
- MarkImportBatch
- MarkImportRow
- AppSetting
- User
- IssuedReport
- StudentCredential and NFC models that sit alongside the school system

## Prisma Schema Overview

The most relevant Report Lab tables and constraints are:

| Model | Purpose | Important constraints |
|---|---|---|
| `School` | Tenant root | `code` is unique |
| `SchoolClass` | School class registry | `@@unique([schoolId, name])`, `@@unique([schoolId, code])` |
| `Stream` | Stream per class | `@@unique([classId, code])` |
| `Student` | Student record | `@@unique([schoolId, admissionNumber])` |
| `ClassEnrollment` | Student membership in class/term | `@@unique([studentId, academicYearId, termId])` |
| `Subject` | Subject registry | `@@unique([schoolId, name])`, `@@unique([schoolId, code])` |
| `SubjectMark` | Stored marks | `@@unique([studentId, subjectId, componentKey, termId, assessmentType])` |
| `MarkImportBatch` | Marks import batch | school-scoped batch history |
| `IssuedReport` | Issued parent report snapshot | `referenceCode` and `parentAccessToken` are unique |
| `AppSetting` | School settings payload | `schoolCode` is unique |

## Authentication Overview

School staff authenticate with `POST /api/auth/login`. The response contains a bearer token that the frontend sends in the `Authorization` header.

The backend uses:

- `requireAuth` for routes that need a valid staff session
- `resolveSchoolContext` for tenant resolution
- `requireSchoolPermission` and `enforceSchoolRoleAccess` for permission checks

## School Context And Tenant Isolation

Tenant isolation is enforced through the school context middleware:

- In production, protected school routes require a valid token
- The school in the token wins over client-supplied schoolCode
- Cross-tenant mismatches are rejected
- School-specific data queries are filtered by `schoolId` or `schoolCode`

This prevents one school from reading another school's records.

## Marks Import Architecture

There are two marks import paths:

1. Digital import from CSV or Excel
2. Scan-based import using OCR or Gemini-assisted extraction

Digital import flow:

- Client uploads CSV text or file
- Backend runs dry-run validation
- Backend commits only valid rows

Scan import flow:

- Client uploads a scan
- Backend detects context or uses selected context
- OCR/AI extracts rows
- Operator reviews rows
- Backend commits validated rows

## OCR / AI Extraction Architecture

Current OCR/AI features use these services:

- `ocrRoutes.ts` for manual OCR access
- `importsRoutes.ts` for scan detection and scan upload
- `geminiMarksImportRoutes.ts` for Gemini-assisted marks extraction and commit

Important behavior:

- OCR access is restricted to staff/admin users
- Provider failures return friendly 503 errors
- Scan import responses include review-safe data and batch identifiers
- The server never trusts client-reviewed rows without re-validation

## Report Generation Architecture

Report generation is handled by:

- `reportsRoutes.ts` for report context and report generation
- `reportIssueRoutes.ts` for issuing a report snapshot and parent link
- `releaseCenterRoutes.ts` for bulk release workflow
- `parentRoutes.ts` for public parent report viewing

The flow is:

1. Load school settings and academic context
2. Load enrolled students and finalized marks
3. Build report cards
4. Render preview in the UI
5. Issue a snapshot if the school wants a public parent link
6. Save the issued report snapshot and reference code

## Verification Architecture

Verification uses:

- `GET /api/verify/:code` for public reference code lookup
- `GET /api/p/:token` for public parent report access
- `POST /api/p/:token/downloaded` to mark a parent download event

The verification record is read-only from the public perspective and returns a limited set of fields.

## Settings Architecture

School settings are stored as a JSON payload in `AppSetting` and merged with defaults in `settingsRepository.ts`.

Settings sections:

- school
- academic
- reports
- reportPersonalization
- marksheets
- ocr
- grading
- approval
- appearance

The school structure workflow can also seed canonical classes, streams, and subjects.

## Environment Variables

Names observed in the codebase, grouped by purpose:

### Core Runtime

- `DATABASE_URL`
- `PORT`
- `NODE_ENV`
- `CLIENT_ORIGIN`
- `APP_BASE_URL`
- `PUBLIC_APP_URL`
- `VITE_API_BASE_URL`

### Authentication And Diagnostics

- `JWT_SECRET`
- `INTERNAL_TEST_KEY`

### OCR And AI

- `OCR_ENABLED`
- `OCR_PROVIDER`
- `AZURE_OCR_FUNCTION_URL`
- `GEMINI_API_KEY`
- `GEMINI_MODEL`
- `SMART_PAGES_GEMINI_FAST_MODEL`
- `SMART_PAGES_GEMINI_HIGH_ACCURACY_MODEL`
- `SMART_PAGES_GEMINI_STABLE_ACCURACY_MODEL`
- `SMART_PAGES_GEMINI_FAST_TIMEOUT_MS`
- `SMART_PAGES_GEMINI_HIGH_ACCURACY_TIMEOUT_MS`
- `SMART_PAGES_GEMINI_MAX_RETRIES`

### Upload And Storage

- `UPLOAD_STORAGE_PROVIDER`
- `UPLOAD_STORAGE_DIR`
- `UPLOAD_STORAGE_PUBLIC_BASE_URL`
- `CLOUDINARY_CLOUD_NAME`
- `CLOUDINARY_NAME`
- `CLOUDINARY_URL`
- `CLOUDINARY_URI`
- `CLOUDINARY_API_KEY`
- `CLOUDINARY_API_SECRET`
- `CLOUDINARY_UPLOAD_FOLDER`

### SSAMENJ Platform Integration

- `SSAMENJ_PLATFORM_INTEGRATION_ENABLED`
- `SSAMENJ_PLATFORM_URL`
- `SSAMENJ_PLATFORM_SERVICE_TOKEN`
- `SSAMENJ_PLATFORM_PRODUCT_CODE`
- `SSAMENJ_PLATFORM_TIMEOUT_MS`

### Support And Messaging

- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_SUPPORT_CHAT_ID`
- `VITE_SUPPORT_MODE`

### Smart Pages And Billing

- `SMART_PAGES_ACTIVE_VERTICAL`
- `ENABLE_SMART_PAGES_LAWYERS`
- `VITE_ENABLE_SMART_PAGES_LAWYERS`
- `SMART_PAGES_CREDIT_PRICE_UGX`
- `SMART_PAGES_HIGH_ACCURACY_MULTIPLIER`
- `SMART_PAGES_GENERATE_DOCUMENT_CREDITS_PER_PAGE`
- `SMART_PAGES_PUBLISH_CREDITS_PER_DOCUMENT`
- `SMART_PAGES_AIRTEL_MERCHANT_CODE`
- `SMART_PAGES_AIRTEL_MERCHANT_NAME`
- `SMART_PAGES_MTN_MERCHANT_CODE`
- `SMART_PAGES_MTN_MERCHANT_NAME`

## Deployment Overview

The project supports a split deployment model:

- Frontend build output is served as a static app
- Backend runs the Express server bundle
- PostgreSQL holds school data
- Parent report links use the public app URL

The repository includes deployment notes for Vercel and Railway. Production should use the real backend, the real database, and a non-local public report URL.

## Testing Overview

Useful checks in the repository include:

- `npm run test`
- `npm run test:critical`
- `npm run build`
- `npm run lint`

The critical test command covers login, role access, students, passport photo upload, NFC gate, document intelligence, and parent report rendering.

## Error Handling

The server returns JSON errors for the main flows. Common patterns:

- Validation errors return 400
- Auth failures return 401
- Tenant or permission failures return 403
- Missing records return 404
- Conflicts return 409 or 422 where appropriate
- Provider outages return 503
- Unhandled errors return a safe generic server error message

## Known Constraints

- There is no standalone public subject CRUD API in the current route set
- School structure and subjects are primarily handled through provisioning and settings workflows
- Report release depends on finalized school data and valid academic context
- Some AI/OCR flows require configured external providers

## Future Roadmap

The codebase already shows strong support for:

- Better marks import guidance
- Richer report personalization
- More robust onboarding automation
- Additional validation and recovery tooling

Where behavior is not fully exposed in the current app, it should be treated as future enhancement rather than current functionality.

