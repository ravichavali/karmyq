#!/bin/bash
set -e

# =============================================================================
# Karmyq Unified Deployment Script
# =============================================================================
#
# Usage: ./scripts/deploy.sh
#
# This is the ONLY deployment script. It:
# 1. Pulls latest code from master
# 2. Loads environment variables from .env.production
# 3. Builds all Docker images on the server (ARM64 native)
# 4. Deploys using docker-compose
# 5. Verifies all services are running
#
# Prerequisites:
# - .env.production file must exist (copy from .env.production.example)
# - Docker and docker-compose must be installed
#
# =============================================================================

# Configuration
APP_DIR="${APP_DIR:-$HOME/karmyq}"
COMPOSE_FILES="-f infrastructure/docker/docker-compose.yml -f infrastructure/docker/docker-compose.prod.yml"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log_info()  { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn()  { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }
log_step()  { echo -e "${BLUE}[STEP]${NC} $1"; }

echo ""
echo "=============================================="
echo "        Karmyq Production Deployment"
echo "=============================================="
echo ""

# Step 1: Navigate to app directory
log_step "1/6 - Navigating to application directory"
cd "$APP_DIR"
log_info "Working directory: $(pwd)"

# Step 2: Pull latest code
log_step "2/6 - Pulling latest code from master"
git fetch origin
git checkout master
git pull origin master
COMMIT=$(git rev-parse --short HEAD)
log_info "Now at commit: $COMMIT"

# Step 3: Verify environment file exists
log_step "3/6 - Checking environment configuration"
if [ ! -f ".env.production" ]; then
    log_error ".env.production not found!"
    log_error "Copy .env.production.example to .env.production and fill in values"
    exit 1
fi
log_info "Environment file found"

# Step 4: Load environment variables
log_step "4/6 - Loading environment variables"
set -a
source .env.production
set +a
log_info "Environment loaded"

# Step 5: Build and deploy
log_step "5/6 - Building and deploying services"
log_info "This may take several minutes on first run..."

# Record deployment start time for verification
DEPLOY_START=$(date +%s)

# Build all images
log_info "Building Docker images..."
BUILD_OUTPUT=$(mktemp)
if docker compose $COMPOSE_FILES build --parallel 2>&1 | tee "$BUILD_OUTPUT"; then
    log_info "Build completed successfully"
else
    BUILD_EXIT=$?
    log_error "Docker build failed with exit code $BUILD_EXIT"
    log_error "Check the output above for errors"

    # Show failed services
    echo ""
    log_error "Failed to build one or more services:"
    grep -E "failed to solve|ERROR:" "$BUILD_OUTPUT" || echo "  (see output above for details)"
    rm -f "$BUILD_OUTPUT"
    exit 1
fi
rm -f "$BUILD_OUTPUT"

# Deploy
log_info "Starting services..."
docker compose $COMPOSE_FILES up -d --remove-orphans

# Step 6: Verify deployment
log_step "6/6 - Verifying deployment"
sleep 10  # Give services time to start

echo ""
echo "Service Status:"
echo "---------------"

# Services that should have been rebuilt (exclude infrastructure)
REBUILD_SERVICES=(
    "karmyq-frontend"
    "karmyq-auth-service"
    "karmyq-community-service"
    "karmyq-request-service"
    "karmyq-reputation-service"
    "karmyq-notification-service"
    "karmyq-messaging-service"
    "karmyq-feed-service"
    "karmyq-cleanup-service"
    "karmyq-geocoding-service"
    "karmyq-social-graph-service"
)

ALL_SERVICES=(
    "karmyq-postgres"
    "karmyq-redis"
    "${REBUILD_SERVICES[@]}"
)

FAILED=0
STALE=0

# Check if services are running
for SERVICE in "${ALL_SERVICES[@]}"; do
    if docker ps --filter "name=^${SERVICE}$" --filter "status=running" --format "{{.Names}}" | grep -q "$SERVICE"; then
        echo -e "  ${GREEN}✓${NC} $SERVICE"
    else
        echo -e "  ${RED}✗${NC} $SERVICE (not running)"
        FAILED=1
    fi
done

# Verify services were actually rebuilt (created after deployment started)
echo ""
echo "Rebuild Verification:"
echo "--------------------"
for SERVICE in "${REBUILD_SERVICES[@]}"; do
    if docker ps --filter "name=^${SERVICE}$" --format "{{.Names}}" | grep -q "$SERVICE"; then
        CREATED=$(docker inspect "$SERVICE" --format='{{.Created}}' 2>/dev/null)
        CREATED_TS=$(date -d "$CREATED" +%s 2>/dev/null || echo "0")

        if [ "$CREATED_TS" -gt "$DEPLOY_START" ]; then
            echo -e "  ${GREEN}✓${NC} $SERVICE (rebuilt)"
        else
            echo -e "  ${YELLOW}⚠${NC} $SERVICE (using cached/old image)"
            STALE=1
        fi
    fi
done

if [ $STALE -eq 1 ]; then
    echo ""
    log_warn "Some services are using cached images and may not reflect latest code"
    log_warn "This can happen when TypeScript files change but Docker cache isn't invalidated"
fi

# Cleanup old images
log_info "Cleaning up unused images..."
docker image prune -f > /dev/null 2>&1

# Summary
echo ""
echo "=============================================="
if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}DEPLOYMENT SUCCESSFUL${NC}"
else
    echo -e "${RED}DEPLOYMENT COMPLETED WITH ERRORS${NC}"
    echo ""
    echo "Check logs with:"
    echo "  docker compose $COMPOSE_FILES logs -f <service-name>"
fi
echo "=============================================="
echo ""
echo "Deployment Info:"
echo "  Commit:     $COMMIT"
echo "  Directory:  $APP_DIR"
echo "  Containers: $(docker ps --filter 'name=karmyq' --format '{{.Names}}' | wc -l) running"
echo ""
echo "Useful commands:"
echo "  View all logs:    docker compose $COMPOSE_FILES logs -f"
echo "  View one service: docker compose $COMPOSE_FILES logs -f auth-service"
echo "  Restart all:      docker compose $COMPOSE_FILES restart"
echo "  Stop all:         docker compose $COMPOSE_FILES down"
echo ""

exit $FAILED
