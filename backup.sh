#!/bin/bash
# PropAIrty daily database backup
# Keeps 30 days of backups locally + uploads every backup to Cloudflare R2.

set -euo pipefail

DB_NAME="propairty"
DB_USER="propairty"
DB_HOST="localhost"
DB_PORT="5432"
BACKUP_DIR="/root/backups"
KEEP_DAYS=30
TIMESTAMP=$(date +"%Y-%m-%d_%H-%M-%S")
FILENAME="${BACKUP_DIR}/propairty_${TIMESTAMP}.sql.gz"

R2_BUCKET="propairty-backups"
R2_ENDPOINT="https://88c32ad7e289485e633e94b89c6fa0ec.r2.cloudflarestorage.com"
R2_PROFILE="r2"  # matches [r2] in ~/.aws/credentials

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

# Upload to Cloudflare R2
echo "[backup] Uploading to R2..."
aws s3 cp "$FILENAME" "s3://${R2_BUCKET}/$(basename "$FILENAME")" \
  --endpoint-url "$R2_ENDPOINT" \
  --profile "$R2_PROFILE" \
  --no-progress
echo "[backup] Uploaded to R2: s3://${R2_BUCKET}/$(basename "$FILENAME")"

# Delete local backups older than KEEP_DAYS
find "$BACKUP_DIR" -name "propairty_*.sql.gz" -mtime +$KEEP_DAYS -delete
echo "[backup] Cleaned up local backups older than $KEEP_DAYS days"

echo "[backup] Done — local + R2 copy saved"
