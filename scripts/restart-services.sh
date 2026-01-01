#!/bin/bash
# Restart all karmyq services

echo "======================================"
echo "Restarting Karmyq Services"
echo "======================================"
echo ""

echo "1. Finding docker-compose file..."
# Check for compose file
if [ -f "infrastructure/docker/docker-compose.prod.yml" ]; then
    COMPOSE_FILE="infrastructure/docker/docker-compose.prod.yml"
    echo "Using: $COMPOSE_FILE"
elif [ -f "infrastructure/docker/docker-compose.yml" ]; then
    COMPOSE_FILE="infrastructure/docker/docker-compose.yml"
    echo "Using: $COMPOSE_FILE"
elif [ -f "docker-compose.yml" ]; then
    COMPOSE_FILE="docker-compose.yml"
    echo "Using: $COMPOSE_FILE"
else
    echo "ERROR: No docker-compose file found!"
    exit 1
fi

echo ""
echo "2. Restarting all services..."
docker compose -f "$COMPOSE_FILE" restart

echo ""
echo "3. Waiting for services to start (10 seconds)..."
sleep 10

echo ""
echo "4. Checking service status..."
docker ps --filter "name=karmyq-" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

echo ""
echo "5. Checking auth service logs..."
echo "--- Last 15 lines ---"
docker logs karmyq-auth-service --tail=15

echo ""
echo "6. Testing health endpoint from inside container..."
docker exec karmyq-auth-service wget -qO- http://localhost:3001/health 2>&1 || echo "Service not responding yet"

echo ""
echo "======================================"
echo "Service Restart Complete"
echo "======================================"
echo ""
echo "Test externally:"
echo "  curl https://karmyq.com/api/auth/health"
