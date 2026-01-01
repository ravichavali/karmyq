#!/bin/bash
# Production Diagnostics Script for karmyq.com (132.226.89.171)
# Run this on the ubuntu@karmyq-vnic instance

echo "======================================"
echo "Karmyq Production Diagnostics"
echo "======================================"
echo ""

# 1. Check correct database name
echo "1. Checking PostgreSQL database..."
docker exec karmyq-postgres psql -U karmyq_user -d karmyq_db -c "SELECT schema_name FROM information_schema.schemata;" 2>&1
echo ""

# 2. Check if tables exist
echo "2. Checking database tables..."
docker exec karmyq-postgres psql -U karmyq_user -d karmyq_db -c "\dt auth.*" 2>&1
docker exec karmyq-postgres psql -U karmyq_user -d karmyq_db -c "\dt community.*" 2>&1
echo ""

# 3. Check service logs for errors
echo "3. Checking service logs (last 10 lines each)..."
echo "--- Auth Service ---"
docker logs karmyq-auth-service --tail=10 2>&1
echo ""
echo "--- Community Service ---"
docker logs karmyq-community-service --tail=10 2>&1
echo ""
echo "--- Request Service ---"
docker logs karmyq-request-service --tail=10 2>&1
echo ""

# 4. Check Loki (which is restarting)
echo "4. Checking Loki logs..."
docker logs karmyq-loki --tail=20 2>&1
echo ""

# 5. Check frontend logs
echo "5. Checking Frontend logs..."
docker logs karmyq-frontend --tail=10 2>&1
echo ""

# 6. Test health endpoints from inside containers
echo "6. Testing health endpoints (from inside network)..."
docker exec karmyq-auth-service wget -qO- http://localhost:3001/health 2>&1
echo ""
docker exec karmyq-community-service wget -qO- http://localhost:3002/health 2>&1
echo ""
docker exec karmyq-request-service wget -qO- http://localhost:3003/health 2>&1
echo ""

# 7. Check environment variables
echo "7. Checking database connection strings..."
echo "--- Auth Service DATABASE_URL ---"
docker exec karmyq-auth-service printenv | grep DATABASE_URL
echo ""

# 8. Check network configuration
echo "8. Checking network configuration..."
docker network inspect karmyq_karmyq-network | grep -A 5 "karmyq-auth-service" 2>&1 || \
docker network inspect karmyq-network_default | grep -A 5 "karmyq-auth-service" 2>&1 || \
echo "Network name may be different"
echo ""

# 9. Check reverse proxy / nginx if exists
echo "9. Checking for reverse proxy..."
systemctl status nginx 2>&1 || echo "Nginx not running or not installed"
systemctl status caddy 2>&1 || echo "Caddy not running or not installed"
echo ""

# 10. Check disk space
echo "10. Checking disk space..."
df -h
echo ""

# 11. Check memory
echo "11. Checking memory..."
free -h
echo ""

# 12. Check which docker compose command works
echo "12. Checking docker compose installation..."
which docker-compose && docker-compose --version
which docker && docker compose version
echo ""

echo "======================================"
echo "Diagnostics Complete"
echo "======================================"
