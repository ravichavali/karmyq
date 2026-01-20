#!/bin/bash
set -e

# Deploy Karmyq services from pre-built Docker images
# Usage: ./scripts/deploy-images.sh <version> [registry]
# Example: ./scripts/deploy-images.sh v8.1.0
# Example: ./scripts/deploy-images.sh v8.1.0 karmyq.com

VERSION=${1}
REGISTRY=${2:-"localhost:5000"}

# If no port in registry, assume it's a domain and use standard HTTP port
if [[ ! "$REGISTRY" =~ :[0-9]+$ ]] && [[ "$REGISTRY" != "localhost:"* ]]; then
    REGISTRY_URL="$REGISTRY"
else
    REGISTRY_URL="$REGISTRY"
fi

if [ -z "$VERSION" ]; then
  echo "❌ Error: Version required"
  echo "Usage: ./scripts/deploy-images.sh <version> [registry]"
  echo "Example: ./scripts/deploy-images.sh v8.1.0"
  echo "Example: ./scripts/deploy-images.sh v8.1.0 karmyq.com"
  exit 1
fi

echo "======================================"
echo "Deploying Karmyq from Images"
echo "Version: $VERSION"
echo "Registry: $REGISTRY_URL"
echo "======================================"

# Check if logged in (simple check - will fail during pull if not authenticated)
echo "✓ Proceeding with deployment (auth check will happen during image pull)"
echo ""

# Pull images
echo "Step 1/4: Pulling images..."
docker pull $REGISTRY_URL/karmyq-frontend:$VERSION
docker pull $REGISTRY_URL/karmyq-auth-service:$VERSION
docker pull $REGISTRY_URL/karmyq-community-service:$VERSION
docker pull $REGISTRY_URL/karmyq-request-service:$VERSION
docker pull $REGISTRY_URL/karmyq-reputation-service:$VERSION
docker pull $REGISTRY_URL/karmyq-notification-service:$VERSION
docker pull $REGISTRY_URL/karmyq-messaging-service:$VERSION
docker pull $REGISTRY_URL/karmyq-feed-service:$VERSION
docker pull $REGISTRY_URL/karmyq-cleanup-service:$VERSION
docker pull $REGISTRY_URL/karmyq-geocoding-service:$VERSION
docker pull $REGISTRY_URL/karmyq-social-graph-service:$VERSION
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
  $REGISTRY_URL/karmyq-frontend:$VERSION

# Auth Service
docker run -d \
  --name karmyq-auth-service \
  --network karmyq-network \
  -p 127.0.0.1:3001:3001 \
  -v /home/ubuntu/karmyq/services/auth-service/.env.production:/app/.env.production:ro \
  --restart unless-stopped \
  $REGISTRY_URL/karmyq-auth-service:$VERSION

# Community Service
docker run -d \
  --name karmyq-community-service \
  --network karmyq-network \
  -p 127.0.0.1:3002:3002 \
  -v /home/ubuntu/karmyq/services/community-service/.env.production:/app/.env.production:ro \
  --restart unless-stopped \
  $REGISTRY_URL/karmyq-community-service:$VERSION

# Request Service
docker run -d \
  --name karmyq-request-service \
  --network karmyq-network \
  -p 127.0.0.1:3003:3003 \
  -v /home/ubuntu/karmyq/services/request-service/.env.production:/app/.env.production:ro \
  --restart unless-stopped \
  $REGISTRY_URL/karmyq-request-service:$VERSION

# Reputation Service
docker run -d \
  --name karmyq-reputation-service \
  --network karmyq-network \
  -p 127.0.0.1:3004:3004 \
  -v /home/ubuntu/karmyq/services/reputation-service/.env.production:/app/.env.production:ro \
  --restart unless-stopped \
  $REGISTRY_URL/karmyq-reputation-service:$VERSION

# Notification Service
docker run -d \
  --name karmyq-notification-service \
  --network karmyq-network \
  -p 127.0.0.1:3005:3005 \
  -v /home/ubuntu/karmyq/services/notification-service/.env.production:/app/.env.production:ro \
  --restart unless-stopped \
  $REGISTRY_URL/karmyq-notification-service:$VERSION

# Messaging Service
docker run -d \
  --name karmyq-messaging-service \
  --network karmyq-network \
  -p 127.0.0.1:3006:3006 \
  -v /home/ubuntu/karmyq/services/messaging-service/.env.production:/app/.env.production:ro \
  --restart unless-stopped \
  $REGISTRY_URL/karmyq-messaging-service:$VERSION

# Feed Service
docker run -d \
  --name karmyq-feed-service \
  --network karmyq-network \
  -p 127.0.0.1:3007:3007 \
  -v /home/ubuntu/karmyq/services/feed-service/.env.production:/app/.env.production:ro \
  --restart unless-stopped \
  $REGISTRY_URL/karmyq-feed-service:$VERSION

# Cleanup Service
docker run -d \
  --name karmyq-cleanup-service \
  --network karmyq-network \
  -p 127.0.0.1:3008:3008 \
  -v /home/ubuntu/karmyq/services/cleanup-service/.env.production:/app/.env.production:ro \
  --restart unless-stopped \
  $REGISTRY_URL/karmyq-cleanup-service:$VERSION

# Geocoding Service
docker run -d \
  --name karmyq-geocoding-service \
  --network karmyq-network \
  -p 127.0.0.1:3009:3009 \
  -v /home/ubuntu/karmyq/services/geocoding-service/.env.production:/app/.env.production:ro \
  --restart unless-stopped \
  $REGISTRY_URL/karmyq-geocoding-service:$VERSION

# Social Graph Service
docker run -d \
  --name karmyq-social-graph-service \
  --network karmyq-network \
  -p 127.0.0.1:3010:3010 \
  -v /home/ubuntu/karmyq/services/social-graph-service/.env.production:/app/.env.production:ro \
  --restart unless-stopped \
  $REGISTRY_URL/karmyq-social-graph-service:$VERSION

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
