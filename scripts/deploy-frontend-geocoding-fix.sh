#!/bin/bash
# Deploy frontend with geocoding API URL fix
# Fixes localhost:3009 references to use /api/geocoding proxy

echo "=========================================="
echo "Deploy Frontend - Geocoding Fix"
echo "=========================================="
echo ""

# Step 1: Rebuild frontend with production environment
echo "Step 1: Building frontend with production environment..."
cd ~/karmyq/apps/frontend

# Make sure .env.production is in place
if [ ! -f .env.production ]; then
    echo "❌ ERROR: .env.production not found!"
    exit 1
fi

echo "Environment variables being used:"
grep GEOCODING .env.production

# Build with production config
npm run build

if [ $? -ne 0 ]; then
    echo "❌ ERROR: Frontend build failed!"
    exit 1
fi

echo "✅ Frontend built successfully"
echo ""

# Step 2: Restart frontend container
echo "Step 2: Restarting frontend container..."
cd ~/karmyq/infrastructure/docker

docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --force-recreate frontend

if [ $? -ne 0 ]; then
    echo "❌ ERROR: Failed to restart frontend container!"
    exit 1
fi

echo "✅ Frontend container restarted"
echo ""

# Step 3: Verify deployment
echo "Step 3: Verifying deployment..."
sleep 5

# Check if frontend is running
if docker ps | grep -q frontend; then
    echo "✅ Frontend container is running"
else
    echo "❌ ERROR: Frontend container is not running!"
    docker compose -f docker-compose.yml -f docker-compose.prod.yml logs frontend --tail 50
    exit 1
fi

echo ""
echo "=========================================="
echo "✅ Frontend Deployed Successfully"
echo "=========================================="
echo ""
echo "Changes:"
echo "  - Added NEXT_PUBLIC_GEOCODING_API_URL=/api/geocoding"
echo "  - Updated geocoding.ts to use environment variable"
echo "  - Frontend now uses nginx proxy instead of localhost:3009"
echo ""
echo "Next steps:"
echo "  1. Test geocoding on https://karmyq.com"
echo "  2. Check browser console for localhost:3009 errors (should be gone)"
echo "  3. Verify geocoding cache works through /api/geocoding proxy"
echo ""
