#!/bin/bash
#
# Production Frontend Deployment Script
# Ensures reliable deployment with proper cache busting
#
# Usage: Run on production server
#   ssh ubuntu@karmyq.com
#   cd ~/karmyq
#   ./scripts/deploy-frontend-prod.sh
#

set -e  # Exit on any error

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🚀 Karmyq Frontend Production Deployment"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Step 1: Pull latest code
echo -e "${BLUE}📥 Step 1/8: Pulling latest code from master...${NC}"
git pull origin master
LATEST_COMMIT=$(git log -1 --format='%h - %s' --abbrev=7)
echo -e "${GREEN}✓ Latest commit: ${LATEST_COMMIT}${NC}"
echo ""

# Step 2: Navigate to frontend
echo -e "${BLUE}📂 Step 2/8: Navigating to frontend directory...${NC}"
cd apps/frontend
echo -e "${GREEN}✓ Current directory: $(pwd)${NC}"
echo ""

# Step 3: Clean old build
echo -e "${BLUE}🧹 Step 3/8: Cleaning old build artifacts...${NC}"
rm -rf .next .next.bak node_modules/.cache
echo -e "${GREEN}✓ Cleaned .next, .next.bak, and node_modules/.cache${NC}"
echo ""

# Step 4: Set build version
BUILD_TIMESTAMP=$(date +%Y%m%d-%H%M%S)
echo -e "${BLUE}🏷️  Step 4/8: Setting build version...${NC}"
export NEXT_PUBLIC_BUILD_VERSION="${BUILD_TIMESTAMP}"
echo -e "${GREEN}✓ Build version: ${BUILD_TIMESTAMP}${NC}"
echo ""

# Step 5: Build frontend
echo -e "${BLUE}🔨 Step 5/8: Building frontend (this takes 1-2 minutes)...${NC}"
NODE_ENV=production npm run build
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Build completed successfully${NC}"
else
    echo -e "${RED}✗ Build failed!${NC}"
    exit 1
fi
echo ""

# Step 6: Verify build
echo -e "${BLUE}🔍 Step 6/8: Verifying build output...${NC}"
if [ -d ".next/static" ] && [ -d ".next/server" ]; then
    PROFILE_HASH=$(ls .next/static/chunks/pages/profile-*.js 2>/dev/null | head -1 | grep -o 'profile-[a-f0-9]*\.js' || echo "not found")
    APP_HASH=$(ls .next/static/chunks/pages/_app-*.js 2>/dev/null | head -1 | grep -o '_app-[a-f0-9]*\.js' || echo "not found")
    echo -e "${GREEN}✓ Build verified${NC}"
    echo -e "  Profile chunk: ${PROFILE_HASH}"
    echo -e "  App chunk: ${APP_HASH}"
else
    echo -e "${RED}✗ Build output missing!${NC}"
    exit 1
fi
echo ""

# Step 7: Deploy to container
echo -e "${BLUE}🐳 Step 7/8: Deploying to Docker container...${NC}"
docker stop karmyq-frontend
echo -e "${GREEN}✓ Stopped container${NC}"

docker cp .next karmyq-frontend:/app/
echo -e "${GREEN}✓ Copied build to container${NC}"

docker start karmyq-frontend
echo -e "${GREEN}✓ Started container${NC}"

# Wait for container to be ready
echo -e "${YELLOW}⏳ Waiting for container to start...${NC}"
sleep 5
echo ""

# Step 8: Verify deployment
echo -e "${BLUE}✅ Step 8/8: Verifying deployment...${NC}"
CONTAINER_STATUS=$(docker ps --filter "name=karmyq-frontend" --format "{{.Status}}" | head -1)
if [[ $CONTAINER_STATUS == *"Up"* ]]; then
    echo -e "${GREEN}✓ Container is running: ${CONTAINER_STATUS}${NC}"

    # Check if Next.js is responding
    sleep 2
    if curl -f http://localhost:3000 > /dev/null 2>&1; then
        echo -e "${GREEN}✓ Frontend is responding on port 3000${NC}"
    else
        echo -e "${YELLOW}⚠ Frontend is starting up (check logs if this persists)${NC}"
    fi
else
    echo -e "${RED}✗ Container is not running!${NC}"
    docker logs karmyq-frontend --tail 20
    exit 1
fi
echo ""

# Show logs
echo -e "${BLUE}📋 Recent container logs:${NC}"
docker logs karmyq-frontend --tail 10
echo ""

# Final instructions
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "${GREEN}✅ DEPLOYMENT COMPLETE${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo -e "${YELLOW}📌 IMPORTANT: Users need to refresh to see changes${NC}"
echo ""
echo "Users should:"
echo "  1. Hard refresh: Ctrl+Shift+R (Windows) or Cmd+Shift+R (Mac)"
echo "  2. Or close all tabs and reopen the site"
echo ""
echo "Build ID: ${BUILD_TIMESTAMP}"
echo "Commit: ${LATEST_COMMIT}"
echo ""
echo -e "${BLUE}💡 Monitor logs with: docker logs karmyq-frontend --follow${NC}"
echo ""
