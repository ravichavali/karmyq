#!/bin/bash
# Seed Production Database Locally (run this ON the production server)
# This script runs seeding directly on the server using localhost

echo "========================================"
echo "Production Database Seeding (Local)"
echo "========================================"
echo ""

if [ -z "$DEMO_PASSWORD" ]; then
    echo "ERROR: DEMO_PASSWORD environment variable is required"
    echo ""
    echo "Usage:"
    echo "  export DEMO_PASSWORD=your_secure_password"
    echo "  ./scripts/seed-production-local.sh"
    exit 1
fi

echo "This script will:"
echo "1. Temporarily disable rate limiting"
echo "2. Create 2000 demo users via API endpoints"
echo "3. Create 200 communities with memberships"
echo "4. Generate help requests, offers, matches, and messages"
echo "5. Re-enable rate limiting"
echo ""
echo "Duration: ~15-30 minutes (may run longer)"
echo ""

if [ "$SKIP_CONFIRMATION" != "true" ]; then
    read -p "Continue? (yes/no): " confirm
    if [ "$confirm" != "yes" ]; then
        echo "Cancelled."
        exit 0
    fi
fi

echo ""
echo "Step 1: Disabling rate limiting..."
echo ""

cd ~/karmyq/infrastructure/docker

# Add RATE_LIMIT_DISABLED to .env
if ! grep -q "RATE_LIMIT_DISABLED" .env; then
    echo "" >> .env
    echo "# Temporary - for seeding" >> .env
    echo "RATE_LIMIT_DISABLED=true" >> .env
fi

# Restart services to pick up new environment variable
docker compose -f docker-compose.yml -f docker-compose.prod.yml restart auth-service community-service request-service messaging-service

# Wait for services to come back up
echo "Waiting for services to restart..."
sleep 10

echo "✅ Rate limiting disabled"
echo ""
echo "Step 2: Running seeding process..."
echo ""

# Navigate to tests directory
cd ~/karmyq/tests

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo "Installing test dependencies..."
    npm install
    echo ""
fi

# Get production database password from .env
POSTGRES_PASSWORD=$(grep POSTGRES_PASSWORD ~/karmyq/infrastructure/docker/.env | cut -d '=' -f2)

# Set DATABASE_URL for production
export DATABASE_URL="postgresql://karmyq_prod:${POSTGRES_PASSWORD}@localhost:5432/karmyq_prod"

# Run seeding with localhost URLs (faster than going through nginx)
export API_BASE_URL="http://localhost"
export AUTH_SERVICE_URL="http://localhost:3001"
export COMMUNITY_SERVICE_URL="http://localhost:3002"
export REQUEST_SERVICE_URL="http://localhost:3003"
export MESSAGING_SERVICE_URL="http://localhost:3006"
export REPUTATION_SERVICE_URL="http://localhost:3004"
export SKIP_CONFIRMATION="true"

# Use production profile with verbose output (run from tests directory)
npm run seed -- --profile production --verbose

SEED_EXIT_CODE=$?

echo ""
echo "Step 3: Re-enabling rate limiting..."
echo ""

cd ~/karmyq/infrastructure/docker

# Remove RATE_LIMIT_DISABLED from .env
sed -i '/# Temporary - for seeding/d' .env
sed -i '/RATE_LIMIT_DISABLED/d' .env

# Restart services to restore rate limiting
docker compose -f docker-compose.yml -f docker-compose.prod.yml restart auth-service community-service request-service messaging-service

echo "✅ Rate limiting restored"
echo ""

if [ $SEED_EXIT_CODE -eq 0 ]; then
    echo "========================================"
    echo "✅ Seeding Completed Successfully"
    echo "========================================"
    echo ""
    echo "Test accounts created:"
    echo "  • user1@test.karmyq.com"
    echo "  • user2@test.karmyq.com"
    echo "  • user3@test.karmyq.com"
    echo "  • ... (up to user2000@test.karmyq.com)"
    echo ""
    echo "Password: $DEMO_PASSWORD"
    echo ""
    echo "You can now log in at https://karmyq.com"
    echo ""
    echo "Note: Rate limiting has been restored on all services"
else
    echo "========================================"
    echo "❌ Seeding Failed"
    echo "========================================"
    echo ""
    echo "Check the logs above for errors."
    echo ""
    echo "Note: Rate limiting has been restored even though seeding failed"
    exit 1
fi
