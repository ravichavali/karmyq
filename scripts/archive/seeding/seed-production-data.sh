#!/bin/bash
# Seed production database with 2000 users and 200 communities

echo "======================================"
echo "Production Data Seeding"
echo "======================================"
echo ""
echo "Target: 2000 users, 200 communities"
echo "Profile: Production"
echo "Estimated time: 5-10 minutes"
echo ""

# Check if DEMO_PASSWORD is set
if [ -z "$DEMO_PASSWORD" ]; then
    echo "ERROR: DEMO_PASSWORD environment variable is required"
    echo ""
    echo "Set it with:"
    echo "  export DEMO_PASSWORD=your_secure_password"
    echo ""
    echo "This will be the password for all demo users."
    exit 1
fi

# Get database connection details
DB_PASSWORD=$(docker exec karmyq-postgres env | grep POSTGRES_PASSWORD | cut -d= -f2)
DB_URL="postgresql://karmyq_prod:${DB_PASSWORD}@localhost:5432/karmyq_prod"

echo "Database: karmyq_prod"
echo "Demo password: ${DEMO_PASSWORD:0:3}***"
echo ""

# Navigate to tests directory
cd ~/karmyq/tests

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "Installing dependencies..."
    npm install
    echo ""
fi

echo "Starting seeding process..."
echo ""
echo "This will:"
echo "  - Create 200 communities"
echo "  - Create 2000 users across those communities"
echo "  - Generate ~10,000 requests (realistic distribution)"
echo "  - Create complete workflows (matches, karma, messages)"
echo "  - Backdate data over 6 months for realistic karma decay"
echo ""

# Confirm before proceeding
read -p "Continue? (yes/no): " confirm
if [ "$confirm" != "yes" ]; then
    echo "Cancelled."
    exit 0
fi

echo ""
echo "Seeding in progress..."
echo "Progress will be logged below:"
echo "---"

# Run seeding with production profile
DATABASE_URL="$DB_URL" \
DEMO_PASSWORD="$DEMO_PASSWORD" \
SKIP_CONFIRMATION=true \
npm run seed -- --profile production --verbose

SEED_EXIT_CODE=$?

echo "---"
echo ""

if [ $SEED_EXIT_CODE -eq 0 ]; then
    echo "✅ Seeding completed successfully!"
    echo ""
    echo "Verification:"
    echo ""

    # Verify data
    echo "Communities created:"
    docker exec -i karmyq-postgres psql -U karmyq_prod -d karmyq_prod \
      -c "SELECT COUNT(*) as count FROM communities.communities;"

    echo ""
    echo "Users created:"
    docker exec -i karmyq-postgres psql -U karmyq_prod -d karmyq_prod \
      -c "SELECT COUNT(*) as count FROM auth.users;"

    echo ""
    echo "Help requests created:"
    docker exec -i karmyq-postgres psql -U karmyq_prod -d karmyq_prod \
      -c "SELECT COUNT(*) as count FROM requests.help_requests;"

    echo ""
    echo "Request status distribution:"
    docker exec -i karmyq-postgres psql -U karmyq_prod -d karmyq_prod \
      -c "SELECT status, COUNT(*) FROM requests.help_requests GROUP BY status;"

    echo ""
    echo "Karma records:"
    docker exec -i karmyq-postgres psql -U karmyq_prod -d karmyq_prod \
      -c "SELECT COUNT(*) as count FROM reputation.karma_records;"

    echo ""
    echo "======================================"
    echo "Next Steps:"
    echo "======================================"
    echo ""
    echo "1. Test login with any demo user:"
    echo "   Email: user1@test.karmyq.com"
    echo "   Password: $DEMO_PASSWORD"
    echo ""
    echo "2. Browse communities at:"
    echo "   https://karmyq.com"
    echo ""
    echo "3. Test API:"
    echo "   curl -X POST https://karmyq.com/api/auth/login \\"
    echo "     -H 'Content-Type: application/json' \\"
    echo "     -d '{\"email\":\"user1@test.karmyq.com\",\"password\":\"$DEMO_PASSWORD\"}'"
    echo ""
else
    echo "❌ Seeding failed with exit code $SEED_EXIT_CODE"
    echo ""
    echo "Check logs above for errors."
    echo "Common issues:"
    echo "  - Database connection failed"
    echo "  - Services not running"
    echo "  - Insufficient permissions"
    echo ""
    echo "Run diagnostics:"
    echo "  ./scripts/production-diagnostics.sh"
    exit 1
fi
