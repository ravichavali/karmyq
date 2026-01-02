#!/bin/bash
# Manual fix for rate limiting on production
# Run this ON the production server to properly disable rate limiting

echo "=========================================="
echo "Manual Rate Limit Fix for Production"
echo "=========================================="
echo ""

cd ~/karmyq/infrastructure/docker

# Check current .env
echo "Current RATE_LIMIT_DISABLED in .env:"
grep RATE_LIMIT_DISABLED .env || echo "NOT SET"
echo ""

# Add if not present
if ! grep -q "RATE_LIMIT_DISABLED=true" .env; then
    echo "Adding RATE_LIMIT_DISABLED=true to .env..."
    # Remove any existing RATE_LIMIT_DISABLED lines first
    sed -i '/RATE_LIMIT_DISABLED/d' .env
    # Add the new setting
    echo "" >> .env
    echo "# Temporary - for seeding" >> .env
    echo "RATE_LIMIT_DISABLED=true" >> .env
    echo "✓ Added to .env"
else
    echo "✓ Already set in .env"
fi

echo ""
echo "Stopping affected services..."
docker compose -f docker-compose.yml -f docker-compose.prod.yml stop auth-service community-service request-service messaging-service

echo ""
echo "Removing containers to force full recreation..."
docker compose -f docker-compose.yml -f docker-compose.prod.yml rm -f auth-service community-service request-service messaging-service

echo ""
echo "Recreating containers with new environment..."
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d auth-service community-service request-service messaging-service

echo ""
echo "Waiting 20 seconds for services to stabilize..."
sleep 20

echo ""
echo "Verifying environment variables in containers:"
echo ""
echo "Auth Service:"
docker exec karmyq-auth-service env | grep RATE_LIMIT || echo "  Variable not found"
echo ""
echo "Community Service:"
docker exec karmyq-community-service env | grep RATE_LIMIT || echo "  Variable not found"
echo ""
echo "Request Service:"
docker exec karmyq-request-service env | grep RATE_LIMIT || echo "  Variable not found"
echo ""
echo "Messaging Service:"
docker exec karmyq-messaging-service env | grep RATE_LIMIT || echo "  Variable not found"

echo ""
echo "=========================================="
echo "Verification Complete"
echo "=========================================="
echo ""
echo "If all services show RATE_LIMIT_DISABLED=true, you can now run seeding."
echo "If not, there may be an issue with the docker-compose configuration."
