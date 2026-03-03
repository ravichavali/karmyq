#!/usr/bin/env bash
# smoke-test.sh — Post-deployment health check
#
# Hits each service's /health endpoint and reports pass/fail.
# Exits 0 if all critical services pass, 1 if any critical service is down.
#
# Usage: ./scripts/smoke-test.sh [--base-url http://localhost]

set -euo pipefail

BASE_URL="${1:-http://localhost}"
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
echo "Smoke Test — $BASE_URL"
echo "----------------------"

# Critical services — must pass
check "Auth Service"         "$BASE_URL/api/auth/health"
check "Community Service"    "$BASE_URL/api/communities/health"
check "Request Service"      "$BASE_URL/api/requests/health"
check "Reputation Service"   "$BASE_URL/api/reputation/health"
check "Messaging Service"    "$BASE_URL/api/messages/health"
check "Feed Service"         "$BASE_URL/api/feed/health"
check "Social Graph Service" "$BASE_URL/api/social/health"
check "Notification Service" "$BASE_URL/api/notifications/health"

# Optional services — warn but don't fail
check "Geocoding Service"    "$BASE_URL/api/geocoding/health" false
check "Cleanup Service"      "$BASE_URL/api/cleanup/health"  false

echo ""
if [ $FAILED -eq 0 ]; then
  echo -e "${GREEN}All critical services healthy.${NC}"
else
  echo -e "${RED}One or more critical services failed the smoke test.${NC}"
fi

exit $FAILED
