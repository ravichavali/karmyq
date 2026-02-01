#!/bin/bash
# Create Test Users on Production
# Run this on the production server: ./scripts/create-prod-test-users.sh

set -e

echo "🔐 Creating production test users..."
echo ""

# Load production environment
if [ -f ".env.production" ]; then
  source .env.production
else
  echo "Error: .env.production not found"
  exit 1
fi

# Run the create-test-users script with production DATABASE_URL
DATABASE_URL="$DATABASE_URL" node scripts/create-test-users.js

echo ""
echo "✅ Test users created on production!"
echo ""
echo "You can now login at https://karmyq.com with:"
echo "  - alice@test.com / password123"
echo "  - bob@test.com / password123"
echo "  - charlie@test.com / password123"
echo "  - diana@test.com / password123"
echo "  - eve@test.com / password123"
