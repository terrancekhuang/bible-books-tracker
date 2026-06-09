#!/usr/bin/env bash
# Daily pg_dump backup: local copy + offsite via rclone.
# Keeps 7 days locally and remotely.
# Requires in .env: BACKUP_S3_BUCKET (set after `terraform apply`).

set -euo pipefail

APP_DIR="/srv/apps/bible-books-tracker"
BACKUP_DIR="/srv/backups/bible-books-tracker"
RETAIN_DAYS=7
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
FILENAME="backup_${TIMESTAMP}.sql.gz"

# shellcheck source=/dev/null
source "${APP_DIR}/.env"

REMOTE="remote:${BACKUP_S3_BUCKET}"

mkdir -p "${BACKUP_DIR}"

echo "[$(date -u +%FT%TZ)] Starting backup → ${FILENAME}"

docker exec app-db-1 \
  pg_dump -U postgres -d bible-books-tracker \
  | gzip > "${BACKUP_DIR}/${FILENAME}"

echo "[$(date -u +%FT%TZ)] Dump complete ($(du -sh "${BACKUP_DIR}/${FILENAME}" | cut -f1))"

# Prune local backups older than RETAIN_DAYS
find "${BACKUP_DIR}" -name "backup_*.sql.gz" -mtime "+${RETAIN_DAYS}" -delete

# Upload to offsite storage
rclone copy "${BACKUP_DIR}/${FILENAME}" "${REMOTE}/"
echo "[$(date -u +%FT%TZ)] Uploaded to ${REMOTE}/${FILENAME}"

# Prune remote backups older than RETAIN_DAYS (extra 1-day buffer)
rclone delete --min-age "$((RETAIN_DAYS + 1))d" "${REMOTE}/"

echo "[$(date -u +%FT%TZ)] Backup complete"
