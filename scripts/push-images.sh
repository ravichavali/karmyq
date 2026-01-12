#!/bin/bash
set -e

# Push all Docker images to GitHub Container Registry
# Usage: ./scripts/push-images.sh <version>
# Example: ./scripts/push-images.sh v8.0.1

VERSION=${1:-latest}
REGISTRY="ghcr.io/ravichavali"

echo "======================================"
echo "Pushing Karmyq Docker Images"
echo "Version: $VERSION"
echo "Registry: $REGISTRY"
echo "======================================"

# Check if logged in
if ! docker info | grep -q "Username: ravichavali"; then
  echo "❌ Not logged in to GitHub Container Registry"
  echo ""
  echo "Please login first:"
  echo "  echo 'YOUR_GITHUB_TOKEN' | docker login ghcr.io -u ravichavali --password-stdin"
  exit 1
fi

echo "✓ Authenticated to GitHub Container Registry"
echo ""

# Push frontend
echo "📤 Pushing frontend:$VERSION..."
docker push $REGISTRY/karmyq-frontend:$VERSION
echo "✓ Pushed"

# Push latest tag
if [ "$VERSION" != "latest" ]; then
  echo "📤 Pushing frontend:latest..."
  docker push $REGISTRY/karmyq-frontend:latest
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
  docker push $REGISTRY/karmyq-$SERVICE:$VERSION
  echo "✓ Pushed"

  if [ "$VERSION" != "latest" ]; then
    echo "📤 Pushing $SERVICE:latest..."
    docker push $REGISTRY/karmyq-$SERVICE:latest
    echo "✓ Pushed"
  fi
done

echo ""
echo "======================================"
echo "✅ All images pushed successfully!"
echo "======================================"
echo ""
echo "Images available at:"
echo "  https://github.com/ravichavali?tab=packages"
echo ""
echo "Next steps:"
echo "  Deploy to production: ssh ubuntu@karmyq.com 'cd ~/karmyq && ./scripts/deploy-images.sh $VERSION'"
echo ""
