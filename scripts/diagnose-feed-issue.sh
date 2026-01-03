#!/bin/bash
# Diagnose feed service issues

echo "=========================================="
echo "Feed Service Diagnostics"
echo "=========================================="
echo ""

cd ~/karmyq/infrastructure/docker

# Check if feed service is running
echo "1. Checking feed service status..."
if docker ps | grep -q feed; then
    echo "✅ Feed service is running"
    docker ps | grep feed
else
    echo "❌ Feed service is NOT running"
    exit 1
fi
echo ""

# Check feed service health
echo "2. Testing feed service health endpoint..."
docker exec karmyq-feed-service curl -s http://localhost:3007/health || echo "❌ Health endpoint failed"
echo ""

# Check feed service logs for errors
echo "3. Recent feed service logs..."
docker logs karmyq-feed-service --tail 50
echo ""

# Test feed endpoint directly (bypass nginx)
echo "4. Testing feed endpoint directly from host..."
curl -s -o /dev/null -w "HTTP Status: %{http_code}\n" http://localhost:3007/feed
echo ""

# Test feed endpoint through nginx
echo "5. Testing feed endpoint through nginx..."
TOKEN=$(docker exec karmyq-postgres psql -U karmyq_prod -d karmyq_prod -t -c "SELECT token FROM auth.tokens WHERE expires_at > NOW() LIMIT 1" | tr -d ' ')
if [ -n "$TOKEN" ]; then
    curl -s -o /dev/null -w "HTTP Status: %{http_code}\n" \
        -H "Authorization: Bearer $TOKEN" \
        -H "x-user-id: 1" \
        https://karmyq.com/api/feed/feed
else
    echo "⚠️ No valid token found, testing without auth..."
    curl -s -o /dev/null -w "HTTP Status: %{http_code}\n" \
        https://karmyq.com/api/feed/feed
fi
echo ""

# Check nginx access logs for feed requests
echo "6. Recent nginx logs for /api/feed requests..."
docker exec karmyq-nginx grep "/api/feed" /var/log/nginx/access.log | tail -20 || echo "No feed requests in nginx logs"
echo ""

# Check rate limiting status
echo "7. Checking rate limiting configuration..."
docker exec karmyq-feed-service env | grep RATE_LIMIT || echo "RATE_LIMIT not set"
echo ""

# Check database for recent feed items
echo "8. Checking database for recent help requests..."
docker exec karmyq-postgres psql -U karmyq_prod -d karmyq_prod -c "
SELECT COUNT(*) as total_requests,
       COUNT(CASE WHEN created_at > NOW() - INTERVAL '1 hour' THEN 1 END) as last_hour,
       COUNT(CASE WHEN created_at > NOW() - INTERVAL '1 day' THEN 1 END) as last_day
FROM requests.help_requests
WHERE expired = FALSE;
"
echo ""

echo "=========================================="
echo "Diagnostics Complete"
echo "=========================================="
