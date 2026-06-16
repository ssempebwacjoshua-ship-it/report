#!/usr/bin/env bash
# db-restore.sh — Restore a PostgreSQL backup created by db-backup.sh.
#
# Usage:
#   DATABASE_URL="postgresql://user:pass@host:5432/dbname" bash scripts/db-restore.sh <dump-file>
#
# WARNING: This will DROP and recreate all tables in the target database.
#          Always restore to a copy/staging database first to verify integrity
#          before restoring to production.
#
# Recommended restore procedure:
#   1. Restore to a staging copy of the database.
#   2. Run smoke tests against the staging copy.
#   3. Only restore to production after verifying staging is correct.

set -euo pipefail

DUMP_FILE="${1:-}"
if [ -z "${DUMP_FILE}" ]; then
  echo "Usage: bash scripts/db-restore.sh <dump-file>"
  exit 1
fi

if [ ! -f "${DUMP_FILE}" ]; then
  echo "ERROR: Dump file not found: ${DUMP_FILE}"
  exit 1
fi

if [ -z "${DATABASE_URL:-}" ]; then
  echo "ERROR: DATABASE_URL is not set."
  exit 1
fi

echo "[restore] Restoring ${DUMP_FILE} to ${DATABASE_URL%%@*}@..."
echo "[restore] WARNING: this will overwrite all data in the target database."
echo "[restore] Press Ctrl-C within 5 seconds to cancel."
sleep 5

pg_restore --clean --if-exists --no-password --dbname "${DATABASE_URL}" "${DUMP_FILE}"
echo "[restore] Done. Verify the restore with: npx prisma db pull"
