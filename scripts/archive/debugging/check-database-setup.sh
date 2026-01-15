#!/bin/bash
# Check current database setup in production

echo "======================================"
echo "Checking Database Configuration"
echo "======================================"
echo ""

echo "1. Checking PostgreSQL container..."
docker ps | grep postgres

echo ""
echo "2. Checking PostgreSQL environment variables..."
docker exec karmyq-postgres env | grep -E "POSTGRES_"

echo ""
echo "3. Listing PostgreSQL users..."
docker exec -i karmyq-postgres psql -U postgres -c "\du"

echo ""
echo "4. Listing databases..."
docker exec -i karmyq-postgres psql -U postgres -c "\l"

echo ""
echo "5. Checking service environment variables..."
echo "--- Auth Service DATABASE_URL ---"
docker exec karmyq-auth-service env | grep DATABASE_URL

echo ""
echo "--- Community Service DATABASE_URL ---"
docker exec karmyq-community-service env | grep DATABASE_URL

echo ""
echo "6. Checking .env files..."
if [ -f ~/karmyq/.env ]; then
    echo "Found .env file:"
    grep -E "DB_|POSTGRES_" ~/karmyq/.env | grep -v "PASSWORD" || echo "No DB config in .env"
else
    echo ".env file not found"
fi

if [ -f ~/karmyq/.env.production ]; then
    echo ""
    echo "Found .env.production file:"
    grep -E "DB_|POSTGRES_" ~/karmyq/.env.production | grep -v "PASSWORD" || echo "No DB config in .env.production"
else
    echo ".env.production file not found"
fi

echo ""
echo "======================================"
echo "Configuration Check Complete"
echo "======================================"
