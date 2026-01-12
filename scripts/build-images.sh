#!/bin/bash
set -e

# Build all Docker images for Karmyq services
# Usage: ./scripts/build-images.sh <version>
# Example: ./scripts/build-images.sh v8.0.1

VERSION=${1:-latest}
REGISTRY="ghcr.io/ravichavali"

echo "======================================"
echo "Building Karmyq Docker Images"
echo "Version: $VERSION"
echo "Registry: $REGISTRY"
echo "======================================"

# Build frontend
echo ""
echo "📦 Building frontend..."
docker build \
  -t $REGISTRY/karmyq-frontend:$VERSION \
  -t $REGISTRY/karmyq-frontend:latest \
  -f apps/frontend/Dockerfile \
  .
echo "✓ Frontend built"

# Build backend services
SERVICES=(
  "auth-service"
  "community-service"
  "request-service"
  "reputation-service"
  "notification-service"
  "messaging-service"
  "feed-service"
  "cleanup-service"
  "geocoding-service"
  "social-graph-service"
)

for SERVICE in "${SERVICES[@]}"; do
  echo ""
  echo "📦 Building $SERVICE..."
  docker build \
    -t $REGISTRY/karmyq-$SERVICE:$VERSION \
    -t $REGISTRY/karmyq-$SERVICE:latest \
    -f services/$SERVICE/Dockerfile \
    .
  echo "✓ $SERVICE built"
done

echo ""
echo "======================================"
echo "✅ All images built successfully!"
echo "======================================"
echo ""
echo "Images tagged with:"
echo "  - $VERSION"
echo "  - latest"
echo ""
echo "Next steps:"
echo "  1. Test images locally: docker-compose up"
echo "  2. Push to registry: ./scripts/push-images.sh $VERSION"
echo ""
