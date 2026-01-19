#!/bin/bash
set -e

# Build all Docker images for Karmyq services
# Usage: ./scripts/build-images.sh <version> [registry]
# Example: ./scripts/build-images.sh v8.1.0
# Example: ./scripts/build-images.sh v8.1.0 karmyq.com

VERSION=${1:-latest}
REGISTRY=${2:-"localhost:5000"}

# If no port in registry, assume it's a domain and use standard HTTP port
if [[ ! "$REGISTRY" =~ :[0-9]+$ ]] && [[ "$REGISTRY" != "localhost:"* ]]; then
    REGISTRY_URL="$REGISTRY"
else
    REGISTRY_URL="$REGISTRY"
fi

echo "======================================"
echo "Building Karmyq Docker Images"
echo "Version: $VERSION"
echo "Registry: $REGISTRY_URL"
echo "======================================"

# Build frontend with production API URLs
echo ""
echo "📦 Building frontend..."
docker build \
  --build-arg NEXT_PUBLIC_API_URL=/api \
  --build-arg NEXT_PUBLIC_COMMUNITY_API_URL=/api \
  --build-arg NEXT_PUBLIC_REQUEST_API_URL=/api \
  --build-arg NEXT_PUBLIC_REPUTATION_API_URL=/api \
  --build-arg NEXT_PUBLIC_NOTIFICATION_API_URL=/api \
  --build-arg NEXT_PUBLIC_MESSAGING_API_URL=/api \
  --build-arg NEXT_PUBLIC_FEED_API_URL=/api \
  --build-arg NEXT_PUBLIC_SOCIAL_GRAPH_API_URL=/api \
  -t $REGISTRY_URL/karmyq-frontend:$VERSION \
  -t $REGISTRY_URL/karmyq-frontend:latest \
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
    -t $REGISTRY_URL/karmyq-$SERVICE:$VERSION \
    -t $REGISTRY_URL/karmyq-$SERVICE:latest \
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
