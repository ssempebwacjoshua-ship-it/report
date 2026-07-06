# File Upload and Import Standard

## Standard flow

1. Upload
2. Validate file safety
3. Parse
4. Dry-run
5. Preview
6. Show row errors
7. User confirms
8. Commit
9. Audit log
10. Result summary

## Current observed limits and checks

- Student import upload route: `multer.memoryStorage()` with `10 MB` file size and `1` file.
- Student passport photo upload route: `2 MB` file size and `1` file.
- Scan import upload route: `20 MB` file size and `1` file.
- Student import preview limit: `50` rows in the preview response.
- Student import batch size: `50`.
- Student import row error limit: `1000`.
- Spreadsheet maximum rows: `5000`.
- Spreadsheet maximum columns: `50`.
- Spreadsheet maximum cell length: `2000`.

## File-type rules

- Student import accepts CSV and XLSX.
- XLSX should be signature-checked as a ZIP container.
- Scan uploads accept PNG, JPG, JPEG, WEBP, and PDF.
- PDF uploads should be signature-checked with `%PDF`.
- Passport photos accept image uploads only and are converted to WebP on save.

## Safe error codes already used or expected

- `EMPTY_UPLOAD`
- `INVALID_FILE_TYPE`
- `FILE_TOO_LARGE`
- `TEMPLATE_ERROR`
- `MISSING_FILE`
- `BATCH_NOT_FOUND`
- `DRY_RUN_REQUIRED`
- `SCAN_SETUP_REQUIRED`
- `NO_VALID_ROWS`
- `SERVER_ERROR`

## Import safety rules

- Never commit before a dry-run preview.
- Never trust client-side row counts.
- Never commit rows that fail validation.
- Keep tenant ownership attached to the school context that initiated the import.
- Log import commits and failures as audit events.
- Export row errors safely without spreadsheet formula injection.

## OCR and scan import rules

- OCR uploads should fail safely if the file is unreadable or too large.
- Context resolution should happen before extraction commit.
- Scan batches should be reloadable without exposing another tenant’s data.
- A dry-run fingerprint should be used before commit when the workflow requires it.

