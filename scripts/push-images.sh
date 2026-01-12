#!/bin/bash
set -e

# Push all Docker images to registry
# Usage: ./scripts/push-images.sh <version> [registry]
# Example: ./scripts/push-images.sh v8.1.0
# Example: ./scripts/push-images.sh v8.1.0 karmyq.com

VERSION=${1:-latest}
REGISTRY=${2:-"localhost:5000"}

# If no port in registry, assume it's a domain and use standard HTTP port
if [[ ! "$REGISTRY_URL" =~ :[0-9]+$ ]] && [[ "$REGISTRY_URL" != "localhost:"* ]]; then
    REGISTRY_URL="$REGISTRY_URL"
else
    REGISTRY_URL="$REGISTRY_URL"
fi

echo "======================================"
echo "Pushing Karmyq Docker Images"
echo "Version: $VERSION"
echo "Registry: $REGISTRY_URL_URL"
echo "======================================"
echo ""
echo "ℹ️  Make sure you're logged in to the registry:"
echo "   docker login $REGISTRY_URL_URL"
echo ""

# Push frontend
echo "📤 Pushing frontend:$VERSION..."
docker push $REGISTRY_URL/karmyq-frontend:$VERSION
echo "✓ Pushed"

# Push latest tag
if [ "$VERSION" != "latest" ]; then
  echo "📤 Pushing frontend:latest..."
  docker push $REGISTRY_URL/karmyq-frontend:latest
  echo "✓ Pushed"
fi

# Push backend services
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
  echo "📤 Pushing $SERVICE:$VERSION..."
  docker push $REGISTRY_URL/karmyq-$SERVICE:$VERSION
  echo "✓ Pushed"

  if [ "$VERSION" != "latest" ]; then
    echo "📤 Pushing $SERVICE:latest..."
    docker push $REGISTRY_URL/karmyq-$SERVICE:latest
    echo "✓ Pushed"
  fi
done

echo ""
echo "======================================"
echo "✅ All images pushed successfully!"
echo "======================================"
echo ""
echo "Images pushed to: $REGISTRY_URL"
echo ""
echo "Next steps:"
echo "  Deploy to production: ssh ubuntu@karmyq.com 'cd ~/karmyq && ./scripts/deploy-images.sh $VERSION $REGISTRY_URL'"
echo ""
