#!/bin/bash

# Karmyq QA Deployment Script
# Deploy to Ubuntu server in local network

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
QA_SERVER="${QA_SERVER_HOST:-192.168.1.100}"
QA_USER="${QA_SERVER_USER:-karmyq}"
QA_PATH="${QA_DEPLOY_PATH:-~/karmyq-qa}"
DOCKER_COMPOSE_FILE="infrastructure/docker/docker-compose.qa.yml"

echo -e "${GREEN}🚀 Karmyq QA Deployment${NC}"
echo "================================"
echo "Server: $QA_USER@$QA_SERVER"
echo "Path: $QA_PATH"
echo ""

# Step 1: Check if server is reachable
echo -e "${YELLOW}📡 Checking server connectivity...${NC}"
if ! ping -c 1 $QA_SERVER &> /dev/null; then
    echo -e "${RED}❌ Cannot reach QA server at $QA_SERVER${NC}"
    exit 1
fi
echo -e "${GREEN}✅ Server is reachable${NC}"

# Step 2: SSH into server and deploy
echo -e "${YELLOW}🔐 Connecting to QA server...${NC}"
ssh $QA_USER@$QA_SERVER << 'ENDSSH'
    set -e

    echo "📂 Navigating to deployment directory..."
    cd ~/karmyq-qa || {
        echo "❌ Deployment directory not found. Creating..."
        mkdir -p ~/karmyq-qa
        cd ~/karmyq-qa
    }

    # Pull latest code
    echo "📥 Pulling latest code from git..."
    if [ -d ".git" ]; then
        git pull origin develop
    else
        echo "⚠️  Git repository not initialized. Please clone first:"
        echo "   git clone <your-repo-url> ~/karmyq-qa"
        exit 1
    fi

    # Load environment variables
    if [ -f ".env.qa" ]; then
        echo "🔧 Loading QA environment variables..."
        export $(cat .env.qa | xargs)
    else
        echo "⚠️  .env.qa not found. Using defaults..."
    fi

    # Build and deploy with Docker Compose
    echo "🐳 Building Docker images..."
    docker-compose -f infrastructure/docker/docker-compose.qa.yml build

    echo "🔄 Stopping existing containers..."
    docker-compose -f infrastructure/docker/docker-compose.qa.yml down

    echo "🚀 Starting services..."
    docker-compose -f infrastructure/docker/docker-compose.qa.yml up -d

    # Wait for services to be healthy
    echo "⏳ Waiting for services to be healthy..."
    sleep 15

    # Health checks
    echo "🏥 Running health checks..."

    services=("auth-service:3001" "community-service:3002" "request-service:3003" "reputation-service:3004")
    for service in "${services[@]}"; do
        name=$(echo $service | cut -d: -f1)
        port=$(echo $service | cut -d: -f2)

        if curl -f http://localhost:$port/health &> /dev/null; then
            echo "  ✅ $name is healthy"
        else
            echo "  ❌ $name is not responding"
        fi
    done

    echo ""
    echo "✨ Deployment complete!"
    echo ""
    echo "📊 Container status:"
    docker-compose -f infrastructure/docker/docker-compose.qa.yml ps
ENDSSH

# Step 3: Final status
if [ $? -eq 0 ]; then
    echo ""
    echo -e "${GREEN}✅ QA Deployment Successful!${NC}"
    echo ""
    echo "Access the QA environment at:"
    echo "  Frontend: http://$QA_SERVER:3000"
    echo "  Auth API: http://$QA_SERVER:3001"
    echo "  Community API: http://$QA_SERVER:3002"
    echo ""
    echo "To view logs:"
    echo "  ssh $QA_USER@$QA_SERVER 'cd $QA_PATH && docker-compose -f $DOCKER_COMPOSE_FILE logs -f'"
else
    echo -e "${RED}❌ Deployment failed!${NC}"
    exit 1
fi
