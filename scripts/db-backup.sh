#!/usr/bin/env bash
# db-backup.sh — Create a compressed PostgreSQL backup of the school-connect database.
#
# Usage:
#   DATABASE_URL="postgresql://user:pass@host:5432/dbname" bash scripts/db-backup.sh
#
# Output:
#   backup-<timestamp>.dump in the current directory (pg_dump custom format, compressed).
#
# Restore with: bash scripts/db-restore.sh backup-<timestamp>.dump

set -euo pipefail

if [ -z "${DATABASE_URL:-}" ]; then
  echo "ERROR: DATABASE_URL is not set."
  exit 1
fi

TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
OUTPUT="backup-${TIMESTAMP}.dump"

echo "[backup] Starting backup at ${TIMESTAMP}..."
pg_dump --format=custom --compress=9 --no-password "${DATABASE_URL}" > "${OUTPUT}"
SIZE=$(du -sh "${OUTPUT}" | cut -f1)
echo "[backup] Done: ${OUTPUT} (${SIZE})"
echo "[backup] Restore with: bash scripts/db-restore.sh ${OUTPUT}"
