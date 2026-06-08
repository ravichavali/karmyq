#!/bin/bash
#
# Local Test Runner - Social Karma v2.0
# Run this before committing to catch issues early
#
# Usage:
#   ./scripts/test-local.sh          # Run all tests
#   ./scripts/test-local.sh quick    # Run only fast tests (type-check + integration)
#   ./scripts/test-local.sh e2e      # Run only E2E tests
#

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Mode
MODE=${1:-full}

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  Karmyq Local Test Runner${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Function to print status
print_status() {
  if [ $1 -eq 0 ]; then
    echo -e "${GREEN}✅ $2${NC}"
  else
    echo -e "${RED}❌ $2${NC}"
    exit 1
  fi
}

# 1. Type Check
if [ "$MODE" != "e2e" ]; then
  echo -e "${YELLOW}📝 Running TypeScript type check...${NC}"
  npm run type-check --workspace=services/request-service --if-present
  print_status $? "Type check passed"
  echo ""
fi

# 2. Integration Tests (Fast)
if [ "$MODE" != "e2e" ]; then
  echo -e "${YELLOW}🧪 Running integration tests...${NC}"

  # Check if services are running
  if ! curl -s http://localhost:3003/health > /dev/null 2>&1; then
    echo -e "${RED}⚠️  Request Service not running. Starting services...${NC}"
    docker-compose -f infrastructure/docker/docker-compose.yml up -d
    echo "Waiting for services to be ready..."
    sleep 10
  fi

  # Run request-service feed tests
  cd services/request-service
  npm run test:tdd -- --runTestsByPath tests/tdd/sprint-91-feed-router.test.ts 2>&1 | tee /tmp/karmyq-test-output.log
  TEST_RESULT=${PIPESTATUS[0]}
  cd ../..

  print_status $TEST_RESULT "Integration tests passed"
  echo ""
fi

# 3. E2E Tests (Slow - only if requested or full mode)
if [ "$MODE" = "e2e" ] || [ "$MODE" = "full" ]; then
  echo -e "${YELLOW}🎭 Running E2E tests (this may take a few minutes)...${NC}"

  # Ensure services are running
  docker-compose -f infrastructure/docker/docker-compose.yml up -d
  sleep 5

  # Seed Social Karma v2 test data
  echo "Seeding test data..."
  cat tests/e2e/seed-social-karma-v2-simple.sql | \
    docker exec -i karmyq-postgres psql -U karmyq_user -d karmyq_db > /dev/null 2>&1

  # Run E2E tests
  cd tests/e2e
  npm test tests/10-social-karma-v2.spec.ts 2>&1 | tee /tmp/karmyq-e2e-output.log
  E2E_RESULT=${PIPESTATUS[0]}
  cd ../..

  print_status $E2E_RESULT "E2E tests passed"
  echo ""
fi

# Summary
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  ✅ All tests passed!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "Test output saved to:"
if [ "$MODE" != "e2e" ]; then
  echo -e "  - ${BLUE}/tmp/karmyq-test-output.log${NC}"
fi
if [ "$MODE" = "e2e" ] || [ "$MODE" = "full" ]; then
  echo -e "  - ${BLUE}/tmp/karmyq-e2e-output.log${NC}"
fi
echo ""
echo -e "${GREEN}Safe to commit!${NC}"
