#!/bin/bash
# Check API errors and service logs

echo "======================================"
echo "API Error Diagnostic"
echo "======================================"
echo ""

echo "1. Checking Request Service..."
echo "--- Last 30 lines ---"
docker logs karmyq-request-service --tail=30
echo ""

echo "2. Checking Community Service..."
echo "--- Last 30 lines ---"
docker logs karmyq-community-service --tail=30
echo ""

echo "3. Testing endpoints from inside containers..."

echo "Request Service - Health:"
docker exec karmyq-request-service wget -qO- http://localhost:3003/health 2>&1

echo ""
echo "Request Service - GET /requests:"
docker exec karmyq-request-service wget -qO- "http://localhost:3003/requests?limit=10" 2>&1 | head -20

echo ""
echo "Community Service - Health:"
docker exec karmyq-community-service wget -qO- http://localhost:3002/health 2>&1

echo ""
echo "Community Service - GET /communities:"
docker exec karmyq-community-service wget -qO- "http://localhost:3002/communities?limit=10" 2>&1 | head -20

echo ""
echo "4. Checking database connectivity from services..."
echo "Request Service DB connection:"
docker exec karmyq-request-service env | grep DATABASE_URL

echo ""
echo "Community Service DB connection:"
docker exec karmyq-community-service env | grep DATABASE_URL

echo ""
echo "======================================"
echo "Diagnostic Complete"
echo "======================================"
