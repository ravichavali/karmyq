#!/bin/bash

# Setup logging for all services

echo "Setting up logging infrastructure..."

# Create log directories
services=("auth-service" "community-service" "request-service" "matching-service" "reputation-service" "notification-service" "messaging-service")

for service in "${services[@]}"; do
  echo "Creating logs directory for $service..."
  mkdir -p "services/$service/logs"

  # Add to .gitignore if not already there
  if [ -f "services/$service/.gitignore" ]; then
    grep -q "logs/" "services/$service/.gitignore" || echo "logs/" >> "services/$service/.gitignore"
  else
    echo "logs/" > "services/$service/.gitignore"
  fi
done

echo ""
echo "✓ Log directories created"
echo ""
echo "Next steps:"
echo "1. Install winston in each service: npm install winston winston-daily-rotate-file"
echo "2. Copy logger.ts from auth-service/src/utils/logger.ts to other services"
echo "3. Update service name in each logger.ts"
echo "4. Start observability stack: docker-compose -f docker-compose.observability.yml up -d"
echo "5. Access Grafana at http://localhost:3001 (admin/admin)"
echo ""
echo "See OBSERVABILITY.md for full documentation"
