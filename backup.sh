#!/usr/bin/env bash
set -euo pipefail

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="backup_${TIMESTAMP}.sql.gz"

docker compose -f docker-compose.prod.yml exec -T postgres \
  pg_dump -U gotcherapp_app gotcherapp | gzip > "$BACKUP_FILE"

echo "Backup saved to $BACKUP_FILE"
