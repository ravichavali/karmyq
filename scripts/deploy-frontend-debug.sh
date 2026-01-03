#!/bin/bash
# Deploy frontend with debug logging

echo "=========================================="
echo "Deploy Frontend - Debug Logging"
echo "=========================================="
echo ""

cd ~/karmyq

# Step 1: Pull latest code
echo "Step 1: Pulling latest code..."
git pull origin master

if [ $? -ne 0 ]; then
    echo "❌ ERROR: Git pull failed!"
    exit 1
fi

echo "✅ Code updated"
echo ""

# Step 2: Restart frontend container with rebuild
echo "Step 2: Rebuilding and restarting frontend..."
cd ~/karmyq/infrastructure/docker

docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build --force-recreate frontend

if [ $? -ne 0 ]; then
    echo "❌ ERROR: Frontend rebuild failed!"
    exit 1
fi

echo ""
echo "Step 3: Verifying frontend is running..."
sleep 5

if docker ps | grep -q frontend; then
    echo "✅ Frontend container is running"
else
    echo "❌ ERROR: Frontend container is not running!"
    docker compose -f docker-compose.yml -f docker-compose.prod.yml logs frontend --tail 50
    exit 1
fi

echo ""
echo "=========================================="
echo "✅ Deployment Complete!"
echo "=========================================="
echo ""
echo "Frontend rebuilt with debug logging"
echo "Try creating a request and check browser console"
echo ""
