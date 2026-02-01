#!/bin/bash

# Truncate Database Script
# WARNING: This deletes ALL data from the database

set -e

echo ""
echo "========================================"
echo "  DATABASE TRUNCATION"
echo "========================================"
echo ""
echo "⚠️  WARNING: This will DELETE ALL DATA!"
echo ""
echo "Press Ctrl+C to cancel, or Enter to continue..."
read -p ""

# Load environment variables if .env exists
if [ -f .env ]; then
  export $(cat .env | grep -v '^#' | xargs)
fi

# Default database connection
DB_HOST=${DB_HOST:-localhost}
DB_PORT=${DB_PORT:-5432}
DB_NAME=${DB_NAME:-karmyq_db}
DB_USER=${DB_USER:-karmyq_user}

echo ""
echo "Running truncation script..."
echo ""

# Run the truncate script
PGPASSWORD=${DB_PASSWORD} psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -f scripts/truncate-database.sql

echo ""
echo "✅ Database truncated successfully!"
echo ""
echo "You can now seed fresh data:"
echo "  ./scripts/seed-test-data.sh        # Small test dataset"
echo "  ./scripts/seed-realistic-data.sh   # Large realistic dataset"
echo ""
