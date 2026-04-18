#!/usr/bin/env bash
# Applies all migration files in order against the gotcherapp database.
# Requires psql to be available (or run from inside the postgres container).
#
# Usage:
#   ./run-migrations.sh
#
# Environment variables (defaults match docker-compose.yml):
#   PGHOST     — default: localhost
#   PGPORT     — default: 5433
#   PGUSER     — default: gotcherapp_app
#   PGPASSWORD — default: changeme_local
#   PGDATABASE — default: gotcherapp

set -euo pipefail

PGHOST="${PGHOST:-localhost}"
PGPORT="${PGPORT:-5433}"
PGUSER="${PGUSER:-gotcherapp_app}"
PGPASSWORD="${PGPASSWORD:-changeme_local}"
PGDATABASE="${PGDATABASE:-gotcherapp}"

export PGPASSWORD

MIGRATION_DIR="$(dirname "$0")/db/migration"

echo "Running migrations against $PGDATABASE on $PGHOST:$PGPORT..."

for file in "$MIGRATION_DIR"/V*.sql; do
  echo "  Applying $(basename "$file")..."
  psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$PGDATABASE" -f "$file"
done

echo "All migrations applied."
