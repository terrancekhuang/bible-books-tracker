#!/usr/bin/env bash
# One-time server setup: installs rclone, writes rclone config from .env, creates backup
# dir, and adds the cron job.
#
# Prerequisites:
#   1. Run `terraform apply` to create the R2 bucket.
#   2. In Cloudflare dashboard → R2 → Manage R2 API Tokens → Create API Token (Object Read & Write).
#   3. Add to /srv/apps/bible-books-tracker/.env:
#        BACKUP_S3_ACCESS_KEY=<r2-access-key-id>
#        BACKUP_S3_SECRET_KEY=<r2-secret-access-key>
#        BACKUP_S3_ENDPOINT=...  (from `terraform output backup_s3_endpoint`)
#        BACKUP_S3_BUCKET=...    (from `terraform output backup_bucket_name`)

set -euo pipefail

APP_DIR="/srv/apps/bible-books-tracker"
SCRIPTS_DIR="${APP_DIR}/scripts"
BACKUP_DIR="/srv/backups/bible-books-tracker"
LOG_FILE="/var/log/bible-tracker-backup.log"
RCLONE_CONFIG="/root/.config/rclone/rclone.conf"
CRON_JOB="0 2 * * * ${SCRIPTS_DIR}/backup.sh >> ${LOG_FILE} 2>&1"

echo "=== Bible Tracker Backup Setup ==="
echo ""

# shellcheck source=/dev/null
source "${APP_DIR}/.env"

MISSING=()
[[ -z "${BACKUP_S3_ACCESS_KEY:-}" ]] && MISSING+=("BACKUP_S3_ACCESS_KEY")
[[ -z "${BACKUP_S3_SECRET_KEY:-}" ]] && MISSING+=("BACKUP_S3_SECRET_KEY")
[[ -z "${BACKUP_S3_ENDPOINT:-}"   ]] && MISSING+=("BACKUP_S3_ENDPOINT")
[[ -z "${BACKUP_S3_BUCKET:-}"     ]] && MISSING+=("BACKUP_S3_BUCKET")

if [[ ${#MISSING[@]} -gt 0 ]]; then
  echo "ERROR: Missing env vars in ${APP_DIR}/.env:" >&2
  printf '  %s\n' "${MISSING[@]}" >&2
  echo "" >&2
  echo "Add them, then re-run this script." >&2
  exit 1
fi

# Install rclone if not present
if ! command -v rclone &>/dev/null; then
  echo "Installing rclone..."
  curl -fsSL https://rclone.org/install.sh | bash
fi
echo "rclone $(rclone --version | head -1)"

# Write rclone config
mkdir -p "$(dirname "${RCLONE_CONFIG}")"
cat > "${RCLONE_CONFIG}" << EOF
[remote]
type = s3
provider = Cloudflare
access_key_id = ${BACKUP_S3_ACCESS_KEY}
secret_access_key = ${BACKUP_S3_SECRET_KEY}
endpoint = ${BACKUP_S3_ENDPOINT}
EOF
chmod 600 "${RCLONE_CONFIG}"
echo "Wrote rclone config → ${RCLONE_CONFIG}"

# Verify bucket is reachable
echo "Verifying bucket access..."
rclone ls "remote:${BACKUP_S3_BUCKET}/" > /dev/null
echo "Bucket accessible: remote:${BACKUP_S3_BUCKET}"

mkdir -p "${BACKUP_DIR}"
echo "Created backup dir: ${BACKUP_DIR}"

touch "${LOG_FILE}"
echo "Created log file: ${LOG_FILE}"

chmod +x "${SCRIPTS_DIR}/backup.sh" "${SCRIPTS_DIR}/restore.sh"
echo "Made scripts executable"

if crontab -l 2>/dev/null | grep -qF "${SCRIPTS_DIR}/backup.sh"; then
  echo "Cron entry already exists — skipping"
else
  (crontab -l 2>/dev/null || true; echo "${CRON_JOB}") | crontab -
  echo "Added cron entry: ${CRON_JOB}"
fi

echo ""
echo "=== Setup complete ==="
echo ""
echo "Run a test backup now:"
echo "  bash ${SCRIPTS_DIR}/backup.sh"
echo ""
echo "Check the log:"
echo "  tail -f ${LOG_FILE}"
