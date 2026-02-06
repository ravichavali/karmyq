#!/bin/bash

# Seed Test Data Script
# Usage: ./scripts/seed-test-data.sh

set -e

echo "🌱 Seeding test data for social graph testing..."
echo ""

# Load environment variables if .env exists
if [ -f .env ]; then
  export $(cat .env | grep -v '^#' | xargs)
fi

# Default database connection
DB_HOST=${DB_HOST:-localhost}
DB_PORT=${DB_PORT:-5432}
DB_NAME=${DB_NAME:-karmyq_db}
DB_USER=${DB_USER:-karmyq_user}

# Run the seed script
PGPASSWORD=${DB_PASSWORD} psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -f scripts/seed-test-data.sql

echo ""
echo "✅ Test data loaded successfully!"
echo ""
echo "You can now test the social graph with:"
echo "  - Community ID: 11111111-1111-1111-1111-111111111111"
echo "  - Alice (Admin): aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"
echo "  - Bob: bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"
echo ""
echo "Generate JWT tokens for testing:"
echo "  node -e \"console.log(require('jsonwebtoken').sign({userId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', communityMemberships: [{communityId: '11111111-1111-1111-1111-111111111111', role: 'admin'}]}, 'dev_jwt_secret_change_in_production'))\""
