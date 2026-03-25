#!/bin/bash
# PropAIrty daily database backup
# Keeps 30 days of backups locally.
# To also copy offsite, set BACKUP_REMOTE (e.g. user@host:/path/to/backups)

set -euo pipefail

DB_NAME="propairty"
DB_USER="propairty"
DB_HOST="localhost"
DB_PORT="5432"
BACKUP_DIR="/root/backups"
KEEP_DAYS=30
TIMESTAMP=$(date +"%Y-%m-%d_%H-%M-%S")
FILENAME="${BACKUP_DIR}/propairty_${TIMESTAMP}.sql.gz"

# Optional: copy to remote server after backup
# BACKUP_REMOTE="user@your-backup-server:/backups/propairty"

mkdir -p "$BACKUP_DIR"

echo "[backup] Starting backup at $TIMESTAMP"
PGPASSWORD="propairty_prod_pw" pg_dump \
  -h "$DB_HOST" \
  -p "$DB_PORT" \
  -U "$DB_USER" \
  -d "$DB_NAME" \
  --no-password \
  | gzip > "$FILENAME"

SIZE=$(du -sh "$FILENAME" | cut -f1)
echo "[backup] Written: $FILENAME ($SIZE)"

# Delete backups older than KEEP_DAYS
find "$BACKUP_DIR" -name "propairty_*.sql.gz" -mtime +$KEEP_DAYS -delete
echo "[backup] Cleaned up backups older than $KEEP_DAYS days"

# Uncomment to copy to a remote server (requires SSH key auth):
# if [ -n "${BACKUP_REMOTE:-}" ]; then
#   rsync -az "$FILENAME" "$BACKUP_REMOTE/"
#   echo "[backup] Copied to $BACKUP_REMOTE"
# fi

echo "[backup] Done"
