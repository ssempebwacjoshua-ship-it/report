# School Connect Reports Lab — Operations Runbook

## Backup and Restore

### Backup

```bash
DATABASE_URL="postgresql://user:pass@host:5432/dbname" bash scripts/db-backup.sh
```

Creates `backup-<timestamp>.dump` (pg_dump custom format, compressed). Store the dump file off-server (object storage, S3, or another host).

Schedule daily backups on Railway via a cron job or use Railway's automated backup feature.

### Restore

**Always restore to staging first. Never restore directly to production without verifying on staging.**

```bash
# Step 1: restore to staging
DATABASE_URL="postgresql://user:pass@staging-host:5432/dbname_staging" bash scripts/db-restore.sh backup-20260615_120000.dump

# Step 2: verify
npx prisma db pull --url "postgresql://user:pass@staging-host:5432/dbname_staging"
npx vitest run  # run tests against staging DB

# Step 3: only if staging looks correct — restore to production
DATABASE_URL="postgresql://user:pass@prod-host:5432/dbname_prod" bash scripts/db-restore.sh backup-20260615_120000.dump
```

---

## Schema Migrations

### Apply a migration

```bash
# On staging database first
DATABASE_URL="<staging-url>" npx prisma migrate deploy

# Run smoke tests
npx vitest run

# On production only after staging passes
DATABASE_URL="<production-url>" npx prisma migrate deploy
```

### Rollback a migration

Prisma does not support automatic rollback. To undo a migration:

1. Restore the pre-migration backup to staging.
2. Manually write a SQL rollback script and test it on staging.
3. Apply the rollback SQL on production with `psql $DATABASE_URL < rollback.sql`.
4. Remove the failed migration file from `prisma/migrations/` and run `prisma migrate resolve --rolled-back <migration-name>`.

### Rollback plan checklist

Before any schema migration in production:
- [ ] Backup production database first (`db-backup.sh`).
- [ ] Test migration on staging.
- [ ] Confirm the application works after migration on staging.
- [ ] Have a SQL rollback script ready.
- [ ] Know which backup to restore to if rollback is needed.

---

## Repair Scripts

Repair scripts must always be run with `--dry-run` first. No destructive repair without a dry-run summary.

### repair-marks-status

Finds SubjectMark records stuck in DRAFT status and finalizes them.

```bash
# Always dry-run first
npx tsx scripts/repair-marks-status.ts --dry-run --school SCU-PREVIEW

# Review the output, then run live only if correct
npx tsx scripts/repair-marks-status.ts --school SCU-PREVIEW

# Limit the batch size
npx tsx scripts/repair-marks-status.ts --dry-run --school SCU-PREVIEW --limit 50
```

### repair-orphan-student-enrollments

Lists active students who have no enrollment in the current active year/term. Default mode is dry-run.

```bash
# Always review first
npx tsx scripts/repair-orphan-student-enrollments.ts --school=SCU-PREVIEW

# Live delete only after confirming the dry-run output
npx tsx scripts/repair-orphan-student-enrollments.ts --school=SCU-PREVIEW --commit
```

### school structure normalization

Normalizes non-canonical class/stream records. Default mode is dry-run; live changes require `--apply`.

```bash
# Preview only
npm run school:structure:dry-run -- --schoolCode SCU-PREVIEW

# Apply only after reviewing the preview output
npm run school:structure:apply -- --schoolCode SCU-PREVIEW
```

---

## Environment Variable Checklist

| Variable           | Required | Where                     | Notes                                      |
|--------------------|----------|---------------------------|--------------------------------------------|
| `DATABASE_URL`     | Yes      | Railway backend only      | Never in Vercel frontend env               |
| `JWT_SECRET`       | Yes      | Railway backend only      | Min 32 chars, use `openssl rand -hex 32`   |
| `CLIENT_ORIGIN`    | Yes      | Railway backend only      | e.g. `https://your-app.vercel.app`         |
| `APP_BASE_URL`     | Strongly recommended | Railway backend only | Branded parent-report/public-report domain |
| `PUBLIC_APP_URL`   | Optional | Railway backend only      | Fallback if `APP_BASE_URL` is not set      |
| `GEMINI_API_KEY`   | Optional | Railway backend only      | Never in Vercel — must NOT use VITE_ prefix|
| `PLATFORM_ADMIN_KEY` | Optional | Railway backend only   | Use `openssl rand -hex 32`                 |
| `INTERNAL_TEST_KEY`| Optional | Railway backend only      | For test/diagnostic routes in production   |
| `TELEGRAM_BOT_TOKEN`| Optional | Railway backend only     | Required for Telegram support notifications |
| `TELEGRAM_SUPPORT_CHAT_ID`| Optional | Railway backend only | Support chat target, currently `8899226749` |
| `VITE_API_BASE_URL`| Yes      | Vercel frontend env       | URL of the Railway backend                 |
| `VITE_SUPPORT_MODE`| Optional | Vercel frontend env       | Set to `telegram_form` to show the support widget |

**Never set `GEMINI_API_KEY`, `JWT_SECRET`, `DATABASE_URL`, `PLATFORM_ADMIN_KEY`, or `INTERNAL_TEST_KEY` in Vercel frontend environment variables.**
The server will refuse to start if any `VITE_*API_KEY` or `VITE_*SECRET` is detected.

---

## Health Checks

```bash
# Public — no auth required
curl https://your-backend.railway.app/api/health

# Internal — env var status (SET/MISSING only, never actual values)
curl -H "x-internal-test-key: $INTERNAL_TEST_KEY" https://your-backend.railway.app/api/health/env
```
