#!/bin/bash
# Fix frontend API issues in production

echo "=========================================="
echo "Fixing Frontend API Configuration"
echo "=========================================="
echo ""

echo "This script will:"
echo "1. Update nginx configuration to fix API routing"
echo "2. Rebuild frontend with correct environment variables"
echo "3. Restart nginx and frontend"
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
echo "Step 1: Updating nginx configuration..."
echo ""

# Backup current nginx config
sudo cp /etc/nginx/sites-available/karmyq /etc/nginx/sites-available/karmyq.backup-$(date +%Y%m%d-%H%M)

# Copy new nginx config
sudo cp infrastructure/nginx/karmyq.com.conf /etc/nginx/sites-available/karmyq

# Test nginx config
echo "Testing nginx configuration..."
sudo nginx -t

if [ $? -ne 0 ]; then
    echo "❌ Nginx configuration test failed!"
    echo "Restoring backup..."
    sudo cp /etc/nginx/sites-available/karmyq.backup-$(date +%Y%m%d-%H%M) /etc/nginx/sites-available/karmyq
    exit 1
fi

echo "✓ Nginx configuration valid"
echo ""

echo "Step 2: Rebuilding frontend with production environment..."
echo ""

cd apps/frontend

# Frontend rebuild will use .env.production automatically in production mode
echo "Building frontend (this may take 3-5 minutes)..."
npm run build

if [ $? -ne 0 ]; then
    echo "❌ Frontend build failed!"
    exit 1
fi

echo "✓ Frontend built successfully"
echo ""

echo "Step 3: Restarting services..."
echo ""

# Reload nginx
sudo systemctl reload nginx
echo "✓ Nginx reloaded"

# Restart frontend container
cd ../..
docker restart karmyq-frontend
echo "✓ Frontend restarted"

sleep 5

echo ""
echo "=========================================="
echo "✅ Frontend API Fix Complete"
echo "=========================================="
echo ""

echo "Verification:"
echo ""
echo "1. Test API routes:"
echo "   curl https://karmyq.com/api/auth/health"
echo "   curl https://karmyq.com/api/communities/communities"
echo ""
echo "2. Check frontend in browser:"
echo "   https://karmyq.com/dashboard"
echo ""
echo "3. Check browser console - should see no more 500/404 errors"
echo ""
