# Data Retention, Delete, and Archive Standard

Sensitive client data should not disappear silently. SSAMENJ apps should preserve auditability, history, and recovery paths while respecting legitimate deletion and retention needs.

## Default Behavior

- Use soft delete/archive by default for sensitive data.
- Hard delete only when explicitly approved or legally required.
- Retention periods should be documented per data type.
- Deletion/export requests must be audited.

## Recommended Fields

Use these where relevant:

- `deletedAt`.
- `archivedAt`.
- `deletedById`.
- `archivedById`.
- `deleteReason`.
- `archiveReason`.
- `voidedAt` / `voidedById` for transactional records.

## Immutable and Ledger Data

- Issued reports/documents are immutable; corrections should create new versions, revocations, or replacement records.
- Payments and wallet records use ledger/reversal entries, not silent edits or deletes.
- Bookings should be cancelled or voided, not silently deleted.
- Imports should preserve batch history, row errors, commit status, and audit trail.

## Relationship Delete Rules

- Avoid unsafe `onDelete: Cascade`.
- Prefer `Restrict` or `SetNull` unless cascade is explicitly justified.
- Cascades must be reviewed for tenant boundary, audit impact, and accidental data-loss risk.
- Cascades should not delete audit logs, ledger records, issued documents, payments, or import history.

## Retention Documentation

For each sensitive data type, document:

- Classification.
- Retention period.
- Archive behavior.
- Hard-delete conditions.
- Export rules.
- Audit event.
- Owner/responsible team.

## Deletion Requests

- Confirm requester identity and permission.
- Confirm tenant scope.
- Record reason and request reference.
- Prefer archive/soft delete unless hard delete is approved.
- Verify dependent records are retained, voided, anonymized, or restricted safely.
- Record an audit event.

## Archive Quality Rules

- Archived records should be excluded from normal active lists.
- Archived records should remain available to authorized audit/admin views where appropriate.
- Archives must preserve tenant scope.
- Archive restore/unarchive should require permission and audit.
