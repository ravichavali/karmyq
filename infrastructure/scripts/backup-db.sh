#!/bin/bash

# infrastructure/scripts/backup-db.sh
# Run via cron daily: 0 3 * * * /home/opc/karmyq/infrastructure/scripts/backup-db.sh

BACKUP_DIR="/var/backup" # Mapped volume
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
FILENAME="karmyq_db_$TIMESTAMP.sql.gz"

# Ensure backup dir exists inside container (it's mapped)
# We run pg_dump interactively via docker exec

echo "📦 Backing up database to $BACKUP_DIR/$FILENAME..."

docker exec karmyq-postgres pg_dump -U karmyq_user karmyq_db | gzip > "$HOME/karmyq/backups/$FILENAME"

# Cleanup old backups (Keep last 7 days)
find "$HOME/karmyq/backups" -type f -name "*.sql.gz" -mtime +7 -delete

echo "✅ Backup complete: $FILENAME"
