# Database Model Template

Every new model or schema change must document these decisions.

## Required Model Decisions

- Tenant/school/company/property ownership.
- Timestamps.
- `createdBy` / `updatedBy` where useful.
- Archive/delete rules.
- Audit needs.
- Private data classification.
- Indexes.
- Unique constraints.
- Migrations.
- Seed/demo data.
- Production safety.

## Rules

- Tenant-owned data must include an enforceable tenant/company/school/property boundary.
- Prefer archive/soft-delete for business records unless hard delete is explicitly safe.
- Add indexes for common tenant-scoped queries.
- Migrations that touch production data need a rollback or recovery note.
- Seed/demo data must never contain real private data.
