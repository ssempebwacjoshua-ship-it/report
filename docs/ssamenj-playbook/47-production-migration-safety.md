# Production Migration Safety

Production migrations can lose, corrupt, or expose client data. Every SSAMENJ production schema change must be reviewed, recoverable, and deployed using approved migration commands.

## Forbidden Production Commands

- Do not use `prisma db push` in production.
- Do not run `prisma migrate reset` in production.
- Do not run development reset/seed/test commands against production.
- Do not manually edit production schema outside an approved incident or migration plan.

Use `prisma migrate deploy` or the repository's approved production migration command.

## Destructive Change Rule

Destructive migrations require:

- Owner/security review.
- Backup and PITR confirmation.
- Written rollback or recovery plan.
- Staging migration test.
- Expected row counts and verification queries.
- Clear maintenance/deployment window when risk is high.

## Expand-Contract Pattern

Prefer this sequence for risky schema changes:

1. Add nullable field/table.
2. Deploy compatible code.
3. Backfill.
4. Verify counts.
5. Switch reads/writes.
6. Remove old field only later.

Do not combine incompatible code and destructive schema changes in one unreviewed deployment.

## Dangerous Migration Patterns

Treat these as high-risk and require explicit review:

- `DROP TABLE`.
- `DROP COLUMN`.
- `TRUNCATE`.
- `ALTER COLUMN SET NOT NULL`.
- `ALTER COLUMN TYPE`.
- `ON DELETE CASCADE`.
- Enum removal.
- Migration reset.
- Rewriting primary keys or tenant keys.
- Removing indexes used for tenant isolation or uniqueness.

## Pre-Migration Checklist

- Backup/PITR confirmed.
- Staging migration tested.
- Rollback/recovery plan written.
- Expected row counts captured.
- Owner approval for destructive changes.
- Tenant isolation impact reviewed.
- App compatibility reviewed for old and new schema.
- Secrets and migration credentials verified as production-safe.

## Post-Migration Checklist

- Health checks pass.
- Row counts verified.
- Key flows tested.
- Tenant isolation verified.
- Error logs reviewed.
- Migration result documented.
- Any backfill failures recorded and assigned.

## Migration Documentation

Every production-impacting migration should document:

- Purpose.
- Risk level.
- Data touched.
- Expected row counts.
- Rollback or restore path.
- Reviewer/approver.
- Verification result.
