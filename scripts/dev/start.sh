#!/bin/bash

echo "🚀 Starting Karmyq Platform..."
echo ""
echo "This will start:"
echo "  - PostgreSQL database (port 5432)"
echo "  - Redis event queue (port 6379)"
echo "  - Redis Commander (port 8081)"
echo ""
echo "Services:"
echo "  - Auth Service (port 3001)"
echo "  - Community Service (port 3002)"
echo "  - Request Service (port 3003)"
echo "  - Reputation Service (port 3004)"
echo "  - Notification Service (port 3005)"
echo "  - Messaging Service (port 3006)"
echo "  - Frontend (port 3000)"
echo ""
echo "Observability Stack:"
echo "  - Grafana (port 3007) - http://localhost:3007"
echo "  - Loki (port 3100) - Log aggregation"
echo "  - Prometheus (port 9090) - Metrics"
echo "  - Promtail - Log shipping"
echo ""
echo "Building and starting services..."
echo ""

cd "$(dirname "$0")/../.." || exit
docker-compose -f infrastructure/docker/docker-compose.yml up --build

