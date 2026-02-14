#!/bin/bash
set -e

# =============================================================================
# Karmyq Unified Deployment Script
# =============================================================================
#
# Usage: ./scripts/deploy.sh
#        SKIP_TESTS=1 ./scripts/deploy.sh  (skip pre-deployment tests)
#
# Pipeline:
# 1. Save current commit for rollback
# 2. Pull latest code from master
# 3. Install dependencies (npm ci)
# 4. Load environment variables from .env.demo
# 5. Run integration tests (auto-rollback if fail)
# 6. Apply database migrations (idempotent — skips already-applied)
# 7. Build landing page (karmyq.org static export)
# 8. Build all Docker images on the server (ARM64 native)
# 9. Deploy using docker-compose + verify health
#
# Prerequisites:
# - .env.demo file must exist (copy from .env.demo.example)
# - Docker and docker-compose must be installed
# - PostgreSQL must be running for integration tests
#
# Environment Variables:
# - SKIP_TESTS=1  : Skip integration tests (use for emergency deploys)
# - APP_DIR       : Application directory (default: $HOME/karmyq)
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
echo "        Karmyq Demo Deployment"
echo "=============================================="
echo ""

# =============================================================================
# Step 1: Navigate + save rollback point
# =============================================================================
log_step "1/9 - Preparing deployment"
cd "$APP_DIR"
log_info "Working directory: $(pwd)"

PREVIOUS_COMMIT=$(git rev-parse --short HEAD)
log_info "Current commit: $PREVIOUS_COMMIT (rollback point)"

# =============================================================================
# Step 2: Pull latest code
# =============================================================================
log_step "2/9 - Pulling latest code from master"
git fetch origin
git checkout master

# Stash any local changes before pulling
if ! git diff-index --quiet HEAD --; then
    log_warn "Local changes detected, stashing..."
    git stash push -m "Auto-stash before deployment $(date +%Y%m%d-%H%M%S)"
fi

git pull origin master
COMMIT=$(git rev-parse --short HEAD)
log_info "Now at commit: $COMMIT"

if [ "$COMMIT" = "$PREVIOUS_COMMIT" ]; then
    log_info "Already at latest commit, no changes to deploy"
fi

# =============================================================================
# Step 3: Install dependencies
# =============================================================================
log_step "3/9 - Installing dependencies"
if npm ci --prefer-offline 2>&1 | tail -3; then
    log_info "Dependencies installed"
else
    log_warn "npm ci failed, falling back to npm install"
    npm install 2>&1 | tail -3
fi

# =============================================================================
# Step 4: Load environment
# =============================================================================
log_step "4/9 - Loading environment"
if [ ! -f ".env.demo" ]; then
    if [ -f ".env.production" ]; then
        log_warn ".env.production found - please rename to .env.demo"
        ln -sf .env.production .env.demo
    else
        log_error ".env.demo not found!"
        log_error "Copy .env.demo.example to .env.demo and fill in values"
        exit 1
    fi
fi
set -a
source .env.demo
set +a
log_info "Environment loaded"

# =============================================================================
# Step 5: Run pre-deployment tests
# =============================================================================
log_step "5/9 - Running pre-deployment tests"
if [ "$SKIP_TESTS" = "1" ]; then
    log_warn "Skipping tests (SKIP_TESTS=1)"
else
    log_info "Running integration tests with demo database..."

    TEST_OUTPUT=$(mktemp)
    if cd tests && npm run test:integration > "$TEST_OUTPUT" 2>&1; then
        log_info "Integration tests passed"
        cd "$APP_DIR"
    else
        TEST_EXIT=$?
        log_error "Integration tests failed with exit code $TEST_EXIT"
        echo ""
        echo "Test output (last 50 lines):"
        tail -50 "$TEST_OUTPUT"
        rm -f "$TEST_OUTPUT"
        cd "$APP_DIR"

        # Rollback to previous commit
        log_warn "Rolling back to previous commit: $PREVIOUS_COMMIT"
        if ! git diff-index --quiet HEAD --; then
            git stash push -m "Auto-stash before rollback $(date +%Y%m%d-%H%M%S)"
        fi
        git checkout "$PREVIOUS_COMMIT"

        log_error "Deployment aborted due to test failures"
        log_error "To deploy anyway, use: SKIP_TESTS=1 ./scripts/deploy.sh"
        exit 1
    fi
    rm -f "$TEST_OUTPUT"
fi

# =============================================================================
# Step 6: Apply database migrations
# =============================================================================
log_step "6/9 - Applying database migrations"
if [ -f "scripts/apply-migrations.sh" ]; then
    if bash scripts/apply-migrations.sh; then
        log_info "Database migrations applied"
    else
        log_error "Migration failed! Rolling back to previous commit: $PREVIOUS_COMMIT"
        if ! git diff-index --quiet HEAD --; then
            git stash push -m "Auto-stash before rollback $(date +%Y%m%d-%H%M%S)"
        fi
        git checkout "$PREVIOUS_COMMIT"
        exit 1
    fi
else
    log_warn "Migration script not found, skipping"
fi

# =============================================================================
# Step 7: Build landing page (karmyq.org)
# =============================================================================
log_step "7/9 - Building landing page (karmyq.org)"
if [ -d "apps/landing" ]; then
    log_info "Building landing page static files..."
    if (cd apps/landing && npm run build); then
        sudo mkdir -p /var/www/karmyq-landing
        sudo cp -r apps/landing/out/* /var/www/karmyq-landing/
        sudo chown -R www-data:www-data /var/www/karmyq-landing
        log_info "Landing page built and deployed to /var/www/karmyq-landing"
    else
        log_warn "Landing page build failed — docs site may be stale"
        log_warn "Check build output above for errors"
    fi
else
    log_warn "No apps/landing directory found, skipping"
fi

# =============================================================================
# Step 8: Build and deploy Docker services
# =============================================================================
log_step "8/9 - Building and deploying services"
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

# =============================================================================
# Step 9: Verify deployment
# =============================================================================
log_step "9/9 - Verifying deployment"
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
