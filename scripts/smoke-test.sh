#!/usr/bin/env bash
# smoke-test.sh — Post-deployment health check
#
# Hits each service's /health endpoint and reports pass/fail.
# Exits 0 if all critical services pass, 1 if any critical service is down.
#
# Usage: ./scripts/smoke-test.sh [--base-url http://localhost]

set -euo pipefail

TIMEOUT=5
FAILED=0

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

check() {
  local name="$1"
  local url="$2"
  local critical="${3:-true}"

  if curl -sf --max-time "$TIMEOUT" "$url" > /dev/null 2>&1; then
    echo -e "  ${GREEN}✓${NC} $name"
  else
    if [ "$critical" = "true" ]; then
      echo -e "  ${RED}✗${NC} $name (CRITICAL — $url)"
      FAILED=1
    else
      echo -e "  ${YELLOW}⚠${NC} $name (optional — $url)"
    fi
  fi
}

echo ""
echo "Smoke Test — container health endpoints"
echo "----------------------------------------"

# Hit each service's /health directly on its container port.
# Services bind to host ports so this works from the host machine.
check "Auth Service"         "http://localhost:3001/health"
check "Community Service"    "http://localhost:3002/health"
check "Request Service"      "http://localhost:3003/health"
check "Reputation Service"   "http://localhost:3004/health"
check "Notification Service" "http://localhost:3005/health"
check "Messaging Service"    "http://localhost:3006/health"
check "Feed Service"         "http://localhost:3007/health"
check "Social Graph Service" "http://localhost:3010/health"

# Optional services — warn but don't fail
check "Geocoding Service"    "http://localhost:3009/health" false
check "Cleanup Service"      "http://localhost:3008/health" false

echo ""
if [ $FAILED -eq 0 ]; then
  echo -e "${GREEN}All critical services healthy.${NC}"
else
  echo -e "${RED}One or more critical services failed the smoke test.${NC}"
fi

exit $FAILED
