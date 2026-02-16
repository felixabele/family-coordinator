#!/bin/bash
set -euo pipefail

# To schedule daily backups at 2 AM, add to crontab (crontab -e):
# 0 2 * * * /opt/family-coordinator/scripts/backup.sh >> /opt/family-coordinator/logs/backup.log 2>&1

# Configuration
DB_NAME="family_coordinator"
DB_USER="family_coordinator"
BACKUP_DIR="$HOME/backups/family-coordinator"
RETENTION_DAYS=7

# Create backup directory if needed
mkdir -p "$BACKUP_DIR"

# Create timestamped backup
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/${DB_NAME}_${TIMESTAMP}.sql.gz"

pg_dump -U "$DB_USER" "$DB_NAME" | gzip > "$BACKUP_FILE"

echo "Backup created: $BACKUP_FILE"

# Remove backups older than retention period
find "$BACKUP_DIR" -name "*.sql.gz" -mtime +$RETENTION_DAYS -delete

echo "Old backups cleaned (retention: $RETENTION_DAYS days)"
