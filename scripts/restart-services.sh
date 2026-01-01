#!/bin/bash
# Restart all karmyq services

echo "======================================"
echo "Restarting Karmyq Services"
echo "======================================"
echo ""

echo "1. Restarting all services..."
docker compose restart

echo ""
echo "2. Waiting for services to start (10 seconds)..."
sleep 10

echo ""
echo "3. Checking service status..."
docker ps --filter "name=karmyq-" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

echo ""
echo "4. Checking auth service logs..."
echo "--- Last 15 lines ---"
docker logs karmyq-auth-service --tail=15

echo ""
echo "5. Testing health endpoint from inside container..."
docker exec karmyq-auth-service wget -qO- http://localhost:3001/health 2>&1 || echo "Service not responding yet"

echo ""
echo "======================================"
echo "Service Restart Complete"
echo "======================================"
echo ""
echo "Test externally:"
echo "  curl https://karmyq.com/api/auth/health"
