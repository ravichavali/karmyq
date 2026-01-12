#!/bin/bash
set -e

# Deploy Karmyq services from pre-built Docker images
# Usage: ./scripts/deploy-images.sh <version>
# Example: ./scripts/deploy-images.sh v8.0.1

VERSION=${1}
REGISTRY="ghcr.io/ravichavali"

if [ -z "$VERSION" ]; then
  echo "❌ Error: Version required"
  echo "Usage: ./scripts/deploy-images.sh <version>"
  echo "Example: ./scripts/deploy-images.sh v8.0.1"
  exit 1
fi

echo "======================================"
echo "Deploying Karmyq from Images"
echo "Version: $VERSION"
echo "Registry: $REGISTRY"
echo "======================================"

# Check if logged in
if ! docker info | grep -q "Username"; then
  echo "❌ Not logged in to Docker registry"
  echo ""
  echo "Please login first:"
  echo "  echo 'YOUR_GITHUB_TOKEN' | docker login ghcr.io -u ravichavali --password-stdin"
  exit 1
fi

echo "✓ Authenticated to registry"
echo ""

# Pull images
echo "Step 1/4: Pulling images..."
docker pull $REGISTRY/karmyq-frontend:$VERSION
docker pull $REGISTRY/karmyq-auth-service:$VERSION
docker pull $REGISTRY/karmyq-community-service:$VERSION
docker pull $REGISTRY/karmyq-request-service:$VERSION
docker pull $REGISTRY/karmyq-reputation-service:$VERSION
docker pull $REGISTRY/karmyq-notification-service:$VERSION
docker pull $REGISTRY/karmyq-messaging-service:$VERSION
docker pull $REGISTRY/karmyq-feed-service:$VERSION
docker pull $REGISTRY/karmyq-cleanup-service:$VERSION
docker pull $REGISTRY/karmyq-geocoding-service:$VERSION
docker pull $REGISTRY/karmyq-social-graph-service:$VERSION
echo "✓ All images pulled"
echo ""

# Stop containers
echo "Step 2/4: Stopping containers..."
docker stop karmyq-frontend || true
docker stop karmyq-auth-service || true
docker stop karmyq-community-service || true
docker stop karmyq-request-service || true
docker stop karmyq-reputation-service || true
docker stop karmyq-notification-service || true
docker stop karmyq-messaging-service || true
docker stop karmyq-feed-service || true
docker stop karmyq-cleanup-service || true
docker stop karmyq-geocoding-service || true
docker stop karmyq-social-graph-service || true
echo "✓ Containers stopped"
echo ""

# Remove old containers
echo "Step 3/4: Removing old containers..."
docker rm karmyq-frontend || true
docker rm karmyq-auth-service || true
docker rm karmyq-community-service || true
docker rm karmyq-request-service || true
docker rm karmyq-reputation-service || true
docker rm karmyq-notification-service || true
docker rm karmyq-messaging-service || true
docker rm karmyq-feed-service || true
docker rm karmyq-cleanup-service || true
docker rm karmyq-geocoding-service || true
docker rm karmyq-social-graph-service || true
echo "✓ Containers removed"
echo ""

# Start new containers
echo "Step 4/4: Starting new containers..."

# Frontend
docker run -d \
  --name karmyq-frontend \
  --network karmyq-network \
  -p 127.0.0.1:3000:3000 \
  -v /home/ubuntu/karmyq/apps/frontend/.env.production:/app/.env.production:ro \
  --restart unless-stopped \
  $REGISTRY/karmyq-frontend:$VERSION

# Auth Service
docker run -d \
  --name karmyq-auth-service \
  --network karmyq-network \
  -p 127.0.0.1:3001:3001 \
  -v /home/ubuntu/karmyq/services/auth-service/.env.production:/app/.env.production:ro \
  --restart unless-stopped \
  $REGISTRY/karmyq-auth-service:$VERSION

# Community Service
docker run -d \
  --name karmyq-community-service \
  --network karmyq-network \
  -p 127.0.0.1:3002:3002 \
  -v /home/ubuntu/karmyq/services/community-service/.env.production:/app/.env.production:ro \
  --restart unless-stopped \
  $REGISTRY/karmyq-community-service:$VERSION

# Request Service
docker run -d \
  --name karmyq-request-service \
  --network karmyq-network \
  -p 127.0.0.1:3003:3003 \
  -v /home/ubuntu/karmyq/services/request-service/.env.production:/app/.env.production:ro \
  --restart unless-stopped \
  $REGISTRY/karmyq-request-service:$VERSION

# Reputation Service
docker run -d \
  --name karmyq-reputation-service \
  --network karmyq-network \
  -p 127.0.0.1:3004:3004 \
  -v /home/ubuntu/karmyq/services/reputation-service/.env.production:/app/.env.production:ro \
  --restart unless-stopped \
  $REGISTRY/karmyq-reputation-service:$VERSION

# Notification Service
docker run -d \
  --name karmyq-notification-service \
  --network karmyq-network \
  -p 127.0.0.1:3005:3005 \
  -v /home/ubuntu/karmyq/services/notification-service/.env.production:/app/.env.production:ro \
  --restart unless-stopped \
  $REGISTRY/karmyq-notification-service:$VERSION

# Messaging Service
docker run -d \
  --name karmyq-messaging-service \
  --network karmyq-network \
  -p 127.0.0.1:3006:3006 \
  -v /home/ubuntu/karmyq/services/messaging-service/.env.production:/app/.env.production:ro \
  --restart unless-stopped \
  $REGISTRY/karmyq-messaging-service:$VERSION

# Feed Service
docker run -d \
  --name karmyq-feed-service \
  --network karmyq-network \
  -p 127.0.0.1:3007:3007 \
  -v /home/ubuntu/karmyq/services/feed-service/.env.production:/app/.env.production:ro \
  --restart unless-stopped \
  $REGISTRY/karmyq-feed-service:$VERSION

# Cleanup Service
docker run -d \
  --name karmyq-cleanup-service \
  --network karmyq-network \
  -p 127.0.0.1:3008:3008 \
  -v /home/ubuntu/karmyq/services/cleanup-service/.env.production:/app/.env.production:ro \
  --restart unless-stopped \
  $REGISTRY/karmyq-cleanup-service:$VERSION

# Geocoding Service
docker run -d \
  --name karmyq-geocoding-service \
  --network karmyq-network \
  -p 127.0.0.1:3009:3009 \
  -v /home/ubuntu/karmyq/services/geocoding-service/.env.production:/app/.env.production:ro \
  --restart unless-stopped \
  $REGISTRY/karmyq-geocoding-service:$VERSION

# Social Graph Service
docker run -d \
  --name karmyq-social-graph-service \
  --network karmyq-network \
  -p 127.0.0.1:3010:3010 \
  -v /home/ubuntu/karmyq/services/social-graph-service/.env.production:/app/.env.production:ro \
  --restart unless-stopped \
  $REGISTRY/karmyq-social-graph-service:$VERSION

echo "✓ Containers started"
echo ""

# Wait for services to be healthy
echo "Waiting for services to be ready..."
sleep 10
echo ""

# Verify deployment
echo "======================================"
echo "Verifying Deployment"
echo "======================================"
echo ""

docker ps --filter "name=karmyq" --format "table {{.Names}}\t{{.Status}}\t{{.Image}}"

echo ""
echo "======================================"
echo "✅ DEPLOYMENT COMPLETE"
echo "======================================"
echo ""
echo "Deployed version: $VERSION"
echo "Running containers: $(docker ps --filter 'name=karmyq' | grep -c Up)"
echo ""
echo "Next steps:"
echo "  - Test the application: https://karmyq.com"
echo "  - Monitor logs: docker logs karmyq-frontend --follow"
echo "  - Roll back if needed: ./scripts/deploy-images.sh <previous-version>"
echo ""
