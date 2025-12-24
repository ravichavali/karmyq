#!/bin/bash
# Validate CONTEXT.md completeness against template
# Usage: ./scripts/validate-context-docs.sh [service-name]
#        ./scripts/validate-context-docs.sh --all

set -e

# ANSI color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Required sections from SERVICE_CONTEXT_TEMPLATE.md
REQUIRED_SECTIONS=(
  "Last Updated"
  "Version:"
  "Port:"
  "Quick Start"
  "## 1. Overview"
  "## 2. Architecture"
  "## 3. API Reference"
  "## 4. Events"
  "## 5. Key Patterns"
  "## 6. Dependencies"
  "## 7. Testing"
  "## 8. Configuration"
  "## 9. Monitoring"
  "## 10. Troubleshooting"
  "## 11. Future Enhancements"
  "## 12. Related Documentation"
)

# Critical services that MUST be 100% compliant
CRITICAL_SERVICES=(
  "request-service"
  "auth-service"
  "community-service"
)

# Check a single CONTEXT.md file
check_context_file() {
  local file=$1
  local service_name=$(basename $(dirname "$file"))
  local missing_count=0
  local total_sections=${#REQUIRED_SECTIONS[@]}
  local is_critical=false

  # Check if this is a critical service
  for critical in "${CRITICAL_SERVICES[@]}"; do
    if [[ "$service_name" == "$critical" ]]; then
      is_critical=true
      break
    fi
  done

  echo -e "${BLUE}Checking: $service_name${NC}"

  # Check each required section
  for section in "${REQUIRED_SECTIONS[@]}"; do
    if ! grep -q "$section" "$file"; then
      echo -e "  ${RED}✗ Missing:${NC} $section"
      ((missing_count++))
    fi
  done

  # Calculate compliance percentage
  local present_count=$((total_sections - missing_count))
  local compliance_percent=$((present_count * 100 / total_sections))

  # Display summary
  if [ $missing_count -eq 0 ]; then
    echo -e "  ${GREEN}✓ 100% Complete${NC} ($total_sections/$total_sections sections)"
  else
    echo -e "  ${YELLOW}⚠ $compliance_percent% Complete${NC} ($present_count/$total_sections sections)"

    # Fail if critical service is incomplete
    if [ "$is_critical" = true ]; then
      echo -e "  ${RED}⚠ CRITICAL SERVICE - Must be 100% complete${NC}"
      return 1
    fi
  fi

  echo ""
  return 0
}

# Main logic
main() {
  local exit_code=0

  echo -e "${BLUE}========================================${NC}"
  echo -e "${BLUE}CONTEXT.md Validation Report${NC}"
  echo -e "${BLUE}========================================${NC}"
  echo ""

  if [ "$1" == "--all" ] || [ -z "$1" ]; then
    # Check all services
    for context_file in services/*/CONTEXT.md; do
      if [ -f "$context_file" ]; then
        check_context_file "$context_file" || exit_code=1
      fi
    done

    # Summary
    echo -e "${BLUE}========================================${NC}"
    echo -e "${BLUE}Summary${NC}"
    echo -e "${BLUE}========================================${NC}"

    total_services=$(find services -name "CONTEXT.md" | wc -l)
    echo "Total services checked: $total_services"

    echo ""
    echo "Critical services (must be 100%):"
    for critical in "${CRITICAL_SERVICES[@]}"; do
      echo "  - $critical"
    done

  else
    # Check specific service
    service_name=$1
    context_file="services/$service_name/CONTEXT.md"

    if [ ! -f "$context_file" ]; then
      echo -e "${RED}Error: CONTEXT.md not found for $service_name${NC}"
      exit 1
    fi

    check_context_file "$context_file" || exit_code=1
  fi

  echo ""
  if [ $exit_code -eq 0 ]; then
    echo -e "${GREEN}✓ All critical services are compliant${NC}"
  else
    echo -e "${RED}✗ Some critical services are incomplete${NC}"
    echo -e "${YELLOW}Run: ./scripts/validate-context-docs.sh <service-name> for details${NC}"
  fi

  exit $exit_code
}

main "$@"
