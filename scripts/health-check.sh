#!/bin/bash
# Service Health Check Script
# Checks all production services listed in services/registry.json
# Exit code 1 if any critical service is down

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
REGISTRY="$PROJECT_ROOT/services/registry.json"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "======================================="
echo "   KARMYQ SERVICE HEALTH CHECK"
echo "======================================="
echo ""

# Check if registry exists
if [ ! -f "$REGISTRY" ]; then
  echo -e "${RED}ERROR: registry.json not found at $REGISTRY${NC}"
  exit 1
fi

# Check if jq is installed
if ! command -v jq &> /dev/null; then
  echo -e "${RED}ERROR: jq is not installed. Install with: sudo apt-get install jq${NC}"
  exit 1
fi

total_services=0
healthy_services=0
unhealthy_services=0
critical_down=0

# Get all production services
services=$(jq -r '.services | to_entries[] | select(.value.status=="production") | .key' "$REGISTRY")

for service in $services; do
  total_services=$((total_services + 1))

  health_url=$(jq -r ".services.\"$service\".health_check" "$REGISTRY")
  criticality=$(jq -r ".services.\"$service\".criticality" "$REGISTRY")
  port=$(jq -r ".services.\"$service\".port" "$REGISTRY")

  # Skip if no health check endpoint
  if [ "$health_url" == "null" ]; then
    echo -e "${YELLOW}⚠ ${service} (port $port) - No health check endpoint${NC}"
    continue
  fi

  # Check health with timeout
  if curl -sf --max-time 2 "$health_url" > /dev/null 2>&1; then
    echo -e "${GREEN}✓ ${service} (port $port) - Healthy${NC}"
    healthy_services=$((healthy_services + 1))
  else
    unhealthy_services=$((unhealthy_services + 1))

    if [ "$criticality" == "critical" ]; then
      echo -e "${RED}✗ ${service} (port $port) - DOWN [CRITICAL]${NC}"
      critical_down=$((critical_down + 1))
    else
      echo -e "${YELLOW}✗ ${service} (port $port) - DOWN [$criticality]${NC}"
    fi
  fi
done

echo ""
echo "======================================="
echo "   SUMMARY"
echo "======================================="
echo "Total services checked: $total_services"
echo -e "Healthy: ${GREEN}$healthy_services${NC}"
echo -e "Unhealthy: ${YELLOW}$unhealthy_services${NC}"
echo -e "Critical down: ${RED}$critical_down${NC}"
echo ""

if [ $critical_down -gt 0 ]; then
  echo -e "${RED}FAILED: $critical_down critical service(s) are down${NC}"
  exit 1
else
  echo -e "${GREEN}SUCCESS: All critical services are healthy${NC}"
  exit 0
fi
