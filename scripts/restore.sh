#!/usr/bin/env bash
# Restore a pg_dump backup to the running database.
# Usage: ./restore.sh [backup_filename]
# If no filename is given, lists available backups and prompts for selection.

set -euo pipefail

APP_DIR="/srv/apps/bible-books-tracker"
TMP_DIR="/tmp/bible-tracker-restore"

# shellcheck source=/dev/null
source "${APP_DIR}/.env"

REMOTE="remote:${BACKUP_S3_BUCKET}"

pick_backup() {
  echo "Available backups (newest first):"
  echo ""
  mapfile -t BACKUPS < <(rclone ls "${REMOTE}/" | awk '{print $2}' | sort -r)

  if [[ ${#BACKUPS[@]} -eq 0 ]]; then
    echo "No backups found in ${REMOTE}/" >&2
    exit 1
  fi

  for i in "${!BACKUPS[@]}"; do
    printf "  [%d] %s\n" "$((i + 1))" "${BACKUPS[$i]}"
  done
  echo ""
  read -r -p "Select backup number: " CHOICE

  if ! [[ "$CHOICE" =~ ^[0-9]+$ ]] || (( CHOICE < 1 || CHOICE > ${#BACKUPS[@]} )); then
    echo "Invalid selection." >&2
    exit 1
  fi

  echo "${BACKUPS[$((CHOICE - 1))]}"
}

BACKUP_FILE="${1:-}"

if [[ -z "${BACKUP_FILE}" ]]; then
  BACKUP_FILE=$(pick_backup)
fi

echo ""
echo "WARNING: This will OVERWRITE the current database with ${BACKUP_FILE}"
read -r -p "Type 'yes' to confirm: " CONFIRM
if [[ "${CONFIRM}" != "yes" ]]; then
  echo "Aborted."
  exit 0
fi

mkdir -p "${TMP_DIR}"
LOCAL_FILE="${TMP_DIR}/${BACKUP_FILE}"

echo "[$(date -u +%FT%TZ)] Downloading ${BACKUP_FILE}..."
rclone copy "${REMOTE}/${BACKUP_FILE}" "${TMP_DIR}/"

echo "[$(date -u +%FT%TZ)] Stopping backend..."
docker stop app-backend-1

echo "[$(date -u +%FT%TZ)] Restoring database..."
gunzip -c "${LOCAL_FILE}" | docker exec -i app-db-1 psql -U postgres -d bible-books-tracker

echo "[$(date -u +%FT%TZ)] Restarting backend..."
docker start app-backend-1

rm -f "${LOCAL_FILE}"

echo "[$(date -u +%FT%TZ)] Restore complete"
