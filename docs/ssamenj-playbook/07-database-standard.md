# Database Standard

## PostgreSQL and Prisma conventions

- Use PostgreSQL.
- Use Prisma for schema and migrations.
- Use UUID primary keys with `@db.Uuid`.
- Keep timestamps on every durable table.
- Use `createdAt` and `updatedAt` on mutable rows.
- Use `@@index` for tenant scoping and common filters.
- Use `@@unique([schoolId, ...])` for tenant-owned uniqueness.

## Tenant-owned table rules

- Every school-owned table should carry `schoolId`.
- Every school-owned query should include `schoolId` in the filter.
- Cross-school uniqueness should never be global unless the row is truly platform-wide.
- Demo or preview data must stay isolated from live tenant data.

## Required audit and import patterns

- Audit logs should capture `schoolId`, `action`, `correlationId`, `details`, and `createdAt`.
- Import jobs should have a batch table plus a row table.
- Commit state and dry-run state should be explicit in the schema.
- Keep per-row errors in a row table or summary structure, not only in logs.

## Migration rules

- Migrations should be additive and reversible where possible.
- Use timestamped migration names.
- Do not hand-edit generated SQL unless there is a documented fix.
- A deployment should run migrations before starting the server in production.

## Seed rules

- Seeds must respect tenant isolation.
- Demo seeds must never overwrite live data.
- Preview or development seeds should target the preview school only unless a specific test requires otherwise.

## Naming conventions

- Model names stay singular.
- Field names stay camelCase.
- Prefer explicit status enums over magic strings.
- Prefer indexed columns for heavy list filters.

