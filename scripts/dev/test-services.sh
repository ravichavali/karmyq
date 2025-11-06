#!/bin/bash

echo "Testing Karmyq Services..."
echo "============================"
echo ""

# Color codes
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m' # No Color

test_service() {
  local name=$1
  local url=$2

  response=$(curl -s -o /dev/null -w "%{http_code}" "$url" 2>/dev/null)

  if [ "$response" = "200" ]; then
    echo -e "${GREEN}✓${NC} $name: OK (HTTP $response)"
  else
    echo -e "${RED}✗${NC} $name: FAILED (HTTP $response)"
  fi
}

# Test backend services
test_service "Auth Service" "http://localhost:3001/health"
test_service "Community Service" "http://localhost:3002/health"
test_service "Request Service" "http://localhost:3003/health"
test_service "Reputation Service" "http://localhost:3004/health"
test_service "Notification Service" "http://localhost:3005/health"
test_service "Messaging Service" "http://localhost:3006/health"

echo ""

# Test API endpoints
test_service "Communities API" "http://localhost:3002/communities"
test_service "Frontend" "http://localhost:3000"

echo ""

# Test database
if docker exec karmyq-postgres pg_isready -U postgres > /dev/null 2>&1; then
  echo -e "${GREEN}✓${NC} PostgreSQL: Connected"
else
  echo -e "${RED}✗${NC} PostgreSQL: Connection failed"
fi

# Test Redis
if docker exec karmyq-redis redis-cli ping | grep -q PONG; then
  echo -e "${GREEN}✓${NC} Redis: Connected"
else
  echo -e "${RED}✗${NC} Redis: Connection failed"
fi

echo ""
echo "============================"
echo "All tests complete!"
