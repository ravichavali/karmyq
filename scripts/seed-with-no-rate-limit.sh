#!/bin/bash
# Temporarily disable rate limiting for production seeding
# This script modifies the auth service to skip rate limiting, seeds data, then restores it

echo "========================================"
echo "Production Seeding (No Rate Limits)"
echo "========================================"
echo ""

if [ -z "$DEMO_PASSWORD" ]; then
    echo "ERROR: DEMO_PASSWORD environment variable is required"
    echo ""
    echo "Usage:"
    echo "  export DEMO_PASSWORD=your_secure_password"
    echo "  ./scripts/seed-with-no-rate-limit.sh"
    exit 1
fi

echo "This script will:"
echo "1. Temporarily disable rate limiting on auth service"
echo "2. Run production seeding (2000 users, 200 communities)"
echo "3. Re-enable rate limiting"
echo ""
echo "Duration: ~10-15 minutes"
echo ""

if [ "$SKIP_CONFIRMATION" != "true" ]; then
    read -p "Continue? (yes/no): " confirm
    if [ "$confirm" != "yes" ]; then
        echo "Cancelled."
        exit 0
    fi
fi

echo ""
echo "Step 1: Disabling rate limiters..."
echo ""

# Set environment variable to disable rate limiting
docker exec karmyq-auth-service sh -c 'export DISABLE_RATE_LIMIT=true && kill -HUP 1'

echo "✓ Rate limiting disabled"
echo ""
echo "Step 2: Running seeding..."
echo ""

# Navigate to tests directory
cd tests

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo "Installing dependencies..."
    npm install
    echo ""
fi

# Run seeding with production profile
export API_BASE_URL="http://localhost"
export AUTH_SERVICE_URL="http://localhost:3001"
export COMMUNITY_SERVICE_URL="http://localhost:3002"
export REQUEST_SERVICE_URL="http://localhost:3003"
export DEMO_PASSWORD="$DEMO_PASSWORD"

npm run seed -- --profile production --verbose

SEED_EXIT_CODE=$?

echo ""
echo "Step 3: Re-enabling rate limiters..."
echo ""

# Restart auth service to restore rate limiting
cd ..
docker restart karmyq-auth-service
sleep 5

echo "✓ Rate limiting restored"
echo ""

if [ $SEED_EXIT_CODE -eq 0 ]; then
    echo "========================================"
    echo "✅ Seeding Completed Successfully"
    echo "========================================"
    echo ""

    # Show statistics
    echo "Final counts:"
    echo ""

    echo "Communities:"
    docker exec -i karmyq-postgres psql -U karmyq_prod -d karmyq_prod \
      -c "SELECT COUNT(*) as count FROM communities.communities;"

    echo ""
    echo "Users:"
    docker exec -i karmyq-postgres psql -U karmyq_prod -d karmyq_prod \
      -c "SELECT COUNT(*) as count FROM auth.users;"

    echo ""
    echo "Requests:"
    docker exec -i karmyq-postgres psql -U karmyq_prod -d karmyq_prod \
      -c "SELECT COUNT(*) as count FROM requests.help_requests;"

    echo ""
    echo "Matches:"
    docker exec -i karmyq-postgres psql -U karmyq_prod -d karmyq_prod \
      -c "SELECT COUNT(*) as count FROM requests.matches;"

    echo ""
    echo "Messages:"
    docker exec -i karmyq-postgres psql -U karmyq_prod -d karmyq_prod \
      -c "SELECT COUNT(*) as count FROM messaging.messages;"

    echo ""
    echo "Test login: user1@test.karmyq.com / $DEMO_PASSWORD"
else
    echo "❌ Seeding failed"
    exit 1
fi
