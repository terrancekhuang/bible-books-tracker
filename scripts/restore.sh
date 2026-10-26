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

# Called as $(pick_backup), so the menu goes to stderr — only the chosen name may reach stdout.
pick_backup() {
  echo "Available backups (newest first):" >&2
  echo "" >&2
  mapfile -t BACKUPS < <(rclone ls "${REMOTE}/" | awk '{print $2}' | sort -r)

  if [[ ${#BACKUPS[@]} -eq 0 ]]; then
    echo "No backups found in ${REMOTE}/" >&2
    exit 1
  fi

  for i in "${!BACKUPS[@]}"; do
    printf "  [%d] %s\n" "$((i + 1))" "${BACKUPS[$i]}" >&2
  done
  echo "" >&2
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
# The dump holds users' emails; don't leave it in /tmp however the script ends.
trap 'rm -f "${LOCAL_FILE}"' EXIT

echo "[$(date -u +%FT%TZ)] Downloading ${BACKUP_FILE}..."
rclone copy "${REMOTE}/${BACKUP_FILE}" "${TMP_DIR}/"

# A truncated dump still loads cleanly — COPY just stops early — so check for pg_dump's
# trailer before touching anything.
if ! gunzip -c "${LOCAL_FILE}" | tail -n 5 | grep -q 'PostgreSQL database dump complete'; then
  echo "${BACKUP_FILE} is incomplete or corrupt — aborting, database untouched." >&2
  exit 1
fi

echo "[$(date -u +%FT%TZ)] Stopping backend..."
docker stop app-backend-1
trap 'rm -f "${LOCAL_FILE}"; echo "[$(date -u +%FT%TZ)] Restarting backend..."; docker start app-backend-1' EXIT

# The dump is plain SQL with no DROPs, so replaying it over a live schema fails on every
# object and restores nothing. Wipe the schema first, all in one transaction: any error
# rolls the whole thing back and leaves the database as it was.
echo "[$(date -u +%FT%TZ)] Restoring database..."
{ echo 'DROP SCHEMA public CASCADE; CREATE SCHEMA public;'; gunzip -c "${LOCAL_FILE}"; } \
  | docker exec -i app-db-1 psql -U postgres -d bible-books-tracker -q \
      -v ON_ERROR_STOP=1 --single-transaction > /dev/null

echo "[$(date -u +%FT%TZ)] Restore complete"
