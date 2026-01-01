#!/bin/bash
# Diagnose 500 errors on request and community services

echo "========================================"
echo "500 Error Diagnostic"
echo "========================================"
echo ""
echo "Target services: request-service, community-service"
echo ""

echo "1. Checking if services are running..."
echo "----------------------------------------"
docker ps --format "table {{.Names}}\t{{.Status}}" | grep -E "(request-service|community-service|NAMES)"
echo ""

echo "2. Request Service - Last 50 log lines..."
echo "----------------------------------------"
docker logs karmyq-request-service --tail=50 2>&1
echo ""

echo "3. Community Service - Last 50 log lines..."
echo "----------------------------------------"
docker logs karmyq-community-service --tail=50 2>&1
echo ""

echo "4. Testing service health endpoints (internal)..."
echo "----------------------------------------"
echo "Request Service /health:"
docker exec karmyq-request-service wget -qO- http://localhost:3003/health 2>&1 || echo "❌ Failed"
echo ""

echo "Community Service /health:"
docker exec karmyq-community-service wget -qO- http://localhost:3002/health 2>&1 || echo "❌ Failed"
echo ""

echo "5. Testing database connectivity from services..."
echo "----------------------------------------"
echo "Request Service DATABASE_URL:"
docker exec karmyq-request-service env | grep DATABASE_URL
echo ""

echo "Community Service DATABASE_URL:"
docker exec karmyq-community-service env | grep DATABASE_URL
echo ""

echo "6. Testing database queries..."
echo "----------------------------------------"
echo "Request Service - Count help_requests:"
docker exec -i karmyq-request-service node <<'EOF' 2>&1
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
pool.query('SELECT COUNT(*) FROM requests.help_requests;')
  .then(res => console.log('✓ Count:', res.rows[0].count))
  .catch(err => console.error('❌ Error:', err.message))
  .finally(() => pool.end());
EOF
echo ""

echo "Community Service - Count communities:"
docker exec -i karmyq-community-service node <<'EOF' 2>&1
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
pool.query('SELECT COUNT(*) FROM communities.communities;')
  .then(res => console.log('✓ Count:', res.rows[0].count))
  .catch(err => console.error('❌ Error:', err.message))
  .finally(() => pool.end());
EOF
echo ""

echo "7. Testing API endpoints from inside containers..."
echo "----------------------------------------"
echo "Request Service - GET /requests (should fail without auth, but show error):"
docker exec karmyq-request-service wget -qO- "http://localhost:3003/requests?limit=1" 2>&1 | head -20
echo ""

echo "Community Service - GET /communities (should fail without auth, but show error):"
docker exec karmyq-community-service wget -qO- "http://localhost:3002/communities?limit=1" 2>&1 | head -20
echo ""

echo "========================================"
echo "Diagnostic Complete"
echo "========================================"
echo ""
echo "Key things to check in output above:"
echo "1. Are services running? (should show 'Up')"
echo "2. Database connection errors in logs?"
echo "3. TypeScript/code errors in logs?"
echo "4. Health endpoints working?"
echo "5. Database queries successful?"
echo ""
