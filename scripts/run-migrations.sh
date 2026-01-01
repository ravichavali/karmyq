#!/bin/bash
# Run database migrations on production

echo "========================================"
echo "Running Database Migrations"
echo "========================================"
echo ""

MIGRATION_DIR="infrastructure/postgres/migrations"

if [ ! -d "$MIGRATION_DIR" ]; then
    echo "ERROR: Migrations directory not found: $MIGRATION_DIR"
    exit 1
fi

echo "Finding migration files..."
MIGRATIONS=$(ls -1 $MIGRATION_DIR/*.sql 2>/dev/null | sort)

if [ -z "$MIGRATIONS" ]; then
    echo "No migration files found in $MIGRATION_DIR"
    exit 0
fi

echo "Found migrations:"
echo "$MIGRATIONS"
echo ""

for migration_file in $MIGRATIONS; do
    filename=$(basename "$migration_file")
    echo "----------------------------------------"
    echo "Running migration: $filename"
    echo "----------------------------------------"

    # Copy migration file into container
    docker cp "$migration_file" karmyq-postgres:/tmp/migration.sql

    # Run migration
    docker exec -i karmyq-postgres psql -U karmyq_prod -d karmyq_prod -f /tmp/migration.sql

    if [ $? -eq 0 ]; then
        echo "✓ Migration $filename completed successfully"
    else
        echo "✗ Migration $filename failed"
        echo ""
        echo "Please check the error above and fix the migration file."
        exit 1
    fi

    echo ""
done

echo "========================================"
echo "All Migrations Complete"
echo "========================================"
echo ""
echo "Verifying schema changes..."
echo ""

# Verify polymorphic columns exist
echo "Checking help_requests table columns:"
docker exec -i karmyq-postgres psql -U karmyq_prod -d karmyq_prod -c "\d requests.help_requests" | grep -E "(request_type|payload|requirements|is_public|requester_visibility)"

echo ""
echo "✓ Migrations applied successfully!"
echo ""
echo "Next steps:"
echo "1. Restart services: docker restart karmyq-request-service karmyq-community-service"
echo "2. Test API endpoints"
echo "3. Run production seeding"
