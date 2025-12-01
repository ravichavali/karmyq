#!/bin/bash

# Run migration inside Docker container
# Usage: ./run-migration.sh <migration-file.sql>

MIGRATION_FILE=$1

if [ -z "$MIGRATION_FILE" ]; then
    echo "Usage: ./run-migration.sh <migration-file.sql>"
    exit 1
fi

if [ ! -f "$MIGRATION_FILE" ]; then
    echo "Error: Migration file $MIGRATION_FILE not found"
    exit 1
fi

echo "Running migration: $MIGRATION_FILE"
echo "========================================"

# Copy migration file to container
docker cp "$MIGRATION_FILE" karmyq-postgres:/tmp/migration.sql

# Run migration
docker exec karmyq-postgres psql -U karmyq_user -d karmyq_db -f /tmp/migration.sql

# Clean up
docker exec karmyq-postgres rm /tmp/migration.sql

echo "========================================"
echo "Migration complete!"
