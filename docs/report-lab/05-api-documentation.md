# School Connect Report Lab API Documentation

## Authentication Expectations

Most school routes require a bearer token from `POST /api/auth/login`.

- Send the token in `Authorization: Bearer <token>`
- In production, tenant resolution depends on the token
- Public routes such as verification and parent report viewing do not require school auth

## School Context Expectations

Protected routes are school-scoped. The backend uses the authenticated school from the token and ignores cross-tenant attempts.

If the school context is missing, the server returns `401 Authentication required.` or a similar school-context error.

## Common Error Format

Most errors use JSON bodies similar to:

```json
{
  "error": "Authentication required."
}
```

Some validation endpoints return richer payloads, for example:

```json
{
  "error": true,
  "code": "REQUEST_FAILED",
  "message": "Invalid request",
  "fieldErrors": {
    "classId": ["classId is required."]
  },
  "issues": [],
  "details": ["classId is required."]
}
```

## Route Groups

### 1) Authentication

| Method | Path | Purpose | Auth |
|---|---|---|---|
| `POST` | `/api/auth/login` | Log in a school user | Public |
| `GET` | `/api/auth/me` | Return the current authenticated user | Bearer token |
| `POST` | `/api/auth/logout` | End the client session | Public |

#### `POST /api/auth/login`

Request:

```json
{
  "email": "admin@example.com",
  "password": "secret",
  "schoolCode": "SCU-PREVIEW"
}
```

Response:

```json
{
  "token": "jwt-token",
  "user": {
    "id": "uuid",
    "schoolId": "uuid",
    "name": "Admin User",
    "email": "admin@example.com",
    "role": "ADMIN_OPERATOR"
  }
}
```

### 2) Report Context And Report Generation

| Method | Path | Purpose | Auth |
|---|---|---|---|
| `GET` | `/api/context` | Load report context for the active school | Bearer token + module entitlement |
| `GET` | `/api/reports` | Build report cards for a class/stream | Bearer token + module entitlement |

#### `GET /api/context`

Purpose:

- Returns the active academic years, terms, classes, streams, and subjects for the school

Response example:

```json
{
  "school": { "id": "uuid", "code": "SCU-PREVIEW", "name": "Uganda High School" },
  "academicYears": [],
  "terms": [],
  "classes": [],
  "streams": [],
  "subjects": []
}
```

#### `GET /api/reports`

Query parameters:

- `classId` required
- `streamId` optional
- `academicYearId` optional
- `termId` optional
- `assessmentType` optional: `BOT`, `MOT`, `EOT`, `TERM_SUMMARY`
- `studentId` optional
- `search` optional

Example:

`/api/reports?classId=...&termId=...&assessmentType=TERM_SUMMARY`

Response includes:

- `readiness`
- `emptyReason`
- `cards`
- `settings`

### 3) Report Issuing And Verification

| Method | Path | Purpose | Auth |
|---|---|---|---|
| `POST` | `/api/reports/issue` | Issue a report snapshot and parent link | Bearer token |
| `GET` | `/api/reports/issued` | List issued reports | Bearer token |
| `PATCH` | `/api/reports/issued/:id/revoke` | Revoke an issued report | Bearer token |
| `GET` | `/api/reports/release-status` | Check readiness and release status | Bearer token |
| `POST` | `/api/reports/issue-bulk` | Issue reports for multiple students | Bearer token |
| `POST` | `/api/reports/release/mark-sent-bulk` | Mark multiple issued reports as sent | Bearer token |
| `POST` | `/api/reports/release/revoke-bulk` | Revoke multiple issued reports | Bearer token |
| `POST` | `/api/reports/release/:id/mark-sent` | Mark one issued report as sent | Bearer token |
| `POST` | `/api/reports/release/:id/revoke` | Revoke one issued report | Bearer token |
| `GET` | `/api/verify/:code` | Public verification by reference code | Public |
| `GET` | `/api/p/:token` | Public parent report view | Public |
| `POST` | `/api/p/:token/downloaded` | Mark a parent download event | Public |

#### `POST /api/reports/issue`

Request example:

```json
{
  "studentId": "uuid",
  "classId": "uuid",
  "streamId": "uuid",
  "academicYearId": "uuid",
  "termId": "uuid",
  "assessmentType": "TERM_SUMMARY",
  "reportComments": {
    "classTeacherComment": "",
    "headTeacherComment": "",
    "conductNote": "",
    "classTeacherName": "",
    "headTeacherName": "",
    "issueDate": ""
  }
}
```

Response example:

```json
{
  "id": "uuid",
  "referenceCode": "20260704-ABC123",
  "parentAccessToken": "raw-parent-token",
  "parentLink": "https://example.com/parent/r/raw-parent-token",
  "studentName": "Ada Lovelace",
  "academicYear": "2025/2026",
  "term": "Term 1",
  "assessmentType": "TERM_SUMMARY",
  "issuedAt": "2026-07-04T00:00:00.000Z"
}
```

### 4) Students

| Method | Path | Purpose | Auth |
|---|---|---|---|
| `GET` | `/api/students` | List students in the active term | Bearer token + school context |
| `POST` | `/api/students` | Create a student | Bearer token + school context |
| `PATCH` | `/api/students/:id` | Update a student | Bearer token + school context |
| `POST` | `/api/students/:id/passport-photo` | Upload passport photo | Bearer token + school context |
| `DELETE` | `/api/students/:id/passport-photo` | Remove passport photo | Bearer token + school context |
| `POST` | `/api/students/import/preview` | Preview a student import file | Bearer token + school context |
| `POST` | `/api/students/import/commit` | Commit a student import file | Bearer token + school context |
| `POST` | `/api/students/import-jobs/upload` | Queue a large student import job | Bearer token + school context |
| `GET` | `/api/students/import-jobs/:jobId` | Check import job status | Bearer token + school context |
| `GET` | `/api/students/import/history` | List import history | Bearer token + school context |
| `GET` | `/api/students/import/:id` | Load one import batch | Bearer token + school context |
| `GET` | `/api/students/contact-summary` | Count guardian contact readiness | Bearer token + school context |
| `POST` | `/api/students/:id/contacts` | Add a guardian contact | Bearer token + school context |
| `PATCH` | `/api/students/:id/contacts/:contactId` | Update a guardian contact | Bearer token + school context |
| `DELETE` | `/api/students/:id/contacts/:contactId` | Delete a guardian contact | Bearer token + school context |
| `GET` | `/api/students/import/template.csv` | Download CSV import template | Public |
| `GET` | `/api/students/import/template` | Download CSV template alias | Public |
| `GET` | `/api/students/import/template.xlsx` | Download Excel import template | Public |

### 5) School Structure And Settings

| Method | Path | Purpose | Auth |
|---|---|---|---|
| `GET` | `/api/settings` | Load school settings | Bearer token + app.admin |
| `PATCH` | `/api/settings/:section` | Update one settings section | Bearer token + app.admin |
| `POST` | `/api/settings/report-personalization/assets/:assetType` | Upload logo, stamp, or signature | Bearer token + app.admin |
| `GET` | `/api/settings/school-structure` | Load school sections/classes/streams | Bearer token |
| `PATCH` | `/api/settings/school-structure` | Update selected school sections | Bearer token |
| `POST` | `/api/settings/school-structure/streams` | Create a stream | Bearer token |
| `DELETE` | `/api/settings/school-structure/streams/:streamId` | Delete a stream | Bearer token |

#### `PATCH /api/settings/school-structure`

Request example:

```json
{
  "selectedSections": ["SECONDARY"]
}
```

Response includes:

- `school`
- `selectedSections`
- `availableSections`
- `canonicalClasses`
- `streamsByClass`
- `lockWarnings`

### 6) Marks Import

| Method | Path | Purpose | Auth |
|---|---|---|---|
| `POST` | `/api/imports/marks/dry-run` | Validate digital marks CSV text | Bearer token + module entitlement |
| `POST` | `/api/imports/marks/commit` | Commit validated digital marks | Bearer token + module entitlement |
| `GET` | `/api/imports/marks/errors/:batchId` | Download row errors as CSV | Bearer token |
| `POST` | `/api/imports/scans/detect-context` | Detect scanned marksheet context | Bearer token + module entitlement |
| `GET` | `/api/imports/scans/context` | Resolve a marksheet ID to context | Bearer token + module entitlement |
| `POST` | `/api/imports/scans/upload` | Upload scan and extract rows | Bearer token + module entitlement |
| `POST` | `/api/imports/scans/dry-run` | Validate extracted scan rows | Bearer token + module entitlement |
| `POST` | `/api/imports/scans/commit` | Commit validated scan rows | Bearer token + module entitlement |
| `GET` | `/api/imports/scan-batches/:batchId` | Reload one scan batch | Bearer token |
| `GET` | `/api/imports/scans/batches` | List recent scan batches | Bearer token |

### 7) Marksheets

| Method | Path | Purpose | Auth |
|---|---|---|---|
| `GET` | `/api/marksheets/students` | List students for a marksheet class/stream | Bearer token + module entitlement |
| `POST` | `/api/marksheets/dry-run` | Dry-run a digital marksheet CSV | Bearer token + module entitlement |
| `POST` | `/api/marksheets/commit` | Commit a digital marksheet CSV | Bearer token + module entitlement |
| `GET` | `/api/marksheets/batches` | List committed marksheet batches | Bearer token + module entitlement |
| `POST` | `/api/marksheets/batches/:batchId/approve` | Approve a marksheet batch | Bearer token + module entitlement |
| `POST` | `/api/marksheets/batches/:batchId/return` | Return a marksheet batch | Bearer token + module entitlement |

### 8) OCR And Gemini Scan

| Method | Path | Purpose | Auth |
|---|---|---|---|
| `POST` | `/internal/ocr/read` | Generic OCR read endpoint | Staff auth |
| `POST` | `/api/marks-import/scan/extract` | Gemini-assisted marks extraction | Staff auth or public dev-only bypass in non-production |
| `GET` | `/api/marks-import/scan/options` | Load class/stream/subject/term options | Staff auth |
| `POST` | `/api/marks-import/scan/commit` | Commit Gemini scan rows | Staff auth |

#### `POST /api/marks-import/scan/extract`

Request form-data fields:

- `image`
- `classId`
- `streamId` optional
- `subjectId`
- `termId`
- `examType`

Response includes:

- `success`
- `requestId`
- `jobId`
- `count`
- `summary`
- `rows`

## Notes On Tenant Isolation

- Every school query must be scoped by school identity.
- SchoolClass and Student records are unique per school.
- Issued reports, imports, and settings are school-specific.
- Public parent and verification routes expose only the limited snapshot required for verification.

