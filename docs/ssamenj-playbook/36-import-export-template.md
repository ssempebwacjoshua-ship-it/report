# Import/Export Template

Imports and exports must be safe by default.

## Import Flow

- Template download.
- Upload.
- File safety validation.
- Dry-run.
- Preview.
- Row errors.
- Duplicate detection.
- Commit confirmation.
- Audit log.
- Result summary.

## Export Flow

- Export permission.
- Private data handling.
- Audit where sensitive.
- CSV formula injection protection.
- Clear file naming.

## Rules

- Never commit imported data without a dry-run/preview phase for high-risk imports.
- Validate file type, extension, size, row count, column count, and cell length where practical.
- Escape formula-like values in CSV/XLSX exports.
- Do not leak private tenant/customer/student/guest data across scopes.
