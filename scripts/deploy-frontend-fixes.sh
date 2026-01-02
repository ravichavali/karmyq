#!/bin/bash
# Deploy frontend API fixes to production
# This script should be run on the production server (132.226.89.171)
#
# IMPORTANT: Run git pull and chmod +x first:
#   git pull origin master
#   chmod +x scripts/*.sh
#   ./scripts/deploy-frontend-fixes.sh

echo "=========================================="
echo "Deploying Frontend API Fixes"
echo "=========================================="
echo ""
echo "This script will:"
echo "1. Setup git hooks for automatic chmod +x"
echo "2. Deploy nginx configuration updates"
echo "3. Rebuild frontend with production environment"
echo "4. Restart services"
echo ""
echo "Duration: ~5-10 minutes"
echo ""

if [ "$SKIP_CONFIRMATION" != "true" ]; then
    read -p "Continue? (yes/no): " confirm
    if [ "$confirm" != "yes" ]; then
        echo "Cancelled."
        exit 0
    fi
fi

echo ""
echo "Step 1: Setting up git hooks..."
echo ""

./scripts/setup-production-hooks.sh

echo ""

echo "Step 2: Deploying frontend fixes..."
echo ""

# Run with SKIP_CONFIRMATION to avoid double confirmation
SKIP_CONFIRMATION=true ./scripts/fix-frontend-production.sh

if [ $? -ne 0 ]; then
    echo "❌ Deployment failed!"
    exit 1
fi

echo ""
echo "=========================================="
echo "✅ Deployment Complete"
echo "=========================================="
echo ""

echo "Next steps:"
echo ""
echo "1. Test API routes:"
echo "   curl https://karmyq.com/api/auth/health"
echo "   curl https://karmyq.com/api/communities/communities"
echo ""
echo "2. Check frontend in browser:"
echo "   https://karmyq.com/dashboard"
echo "   - Should see no 500/404 errors in browser console"
echo ""
echo "3. If everything works, proceed with production seeding:"
echo "   export DEMO_PASSWORD=your_secure_password"
echo "   ./scripts/seed-direct-sql.sh"
echo ""
