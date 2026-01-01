#!/bin/bash
# Sync database password between PostgreSQL and services

echo "======================================"
echo "Database Password Sync"
echo "======================================"
echo ""

# Get the password from PostgreSQL container
PG_PASSWORD=$(docker exec karmyq-postgres env | grep POSTGRES_PASSWORD | cut -d= -f2)
echo "PostgreSQL password: $PG_PASSWORD"

echo ""
echo "Checking service DATABASE_URLs..."

# Check auth service
echo "--- Auth Service ---"
AUTH_URL=$(docker exec karmyq-auth-service env | grep DATABASE_URL)
echo "Current: $AUTH_URL"

# Extract just the password from the URL
AUTH_PASSWORD=$(echo "$AUTH_URL" | sed -n 's/.*:\/\/karmyq_prod:\([^@]*\)@.*/\1/p')
echo "Password in URL: $AUTH_PASSWORD"

if [ "$AUTH_PASSWORD" = "$PG_PASSWORD" ]; then
    echo "✓ Passwords match"
else
    echo "✗ Password mismatch!"
    echo ""
    echo "PostgreSQL expects: $PG_PASSWORD"
    echo "Service is using:   $AUTH_PASSWORD"
fi

echo ""
echo "======================================"
echo "Testing Connection"
echo "======================================"
echo ""

# Build the correct connection string
CORRECT_URL="postgresql://karmyq_prod:${PG_PASSWORD}@postgres:5432/karmyq_prod"
echo "Correct DATABASE_URL should be:"
echo "$CORRECT_URL"

echo ""
echo "Testing with correct password..."
docker exec -i karmyq-postgres psql -U karmyq_prod -d karmyq_prod <<EOF
SELECT 'Connection successful!' as status;
EOF

if [ $? -eq 0 ]; then
    echo ""
    echo "✓ Connection works with PostgreSQL password"
    echo ""
    echo "To fix services, update environment variables to use:"
    echo "DATABASE_URL=$CORRECT_URL"
    echo ""
    echo "This needs to be set in your docker-compose.yml or .env file"
    echo ""
    echo "Looking for compose file..."

    # Try to find compose file
    if [ -f docker-compose.yml ]; then
        echo "Found: docker-compose.yml"
    elif [ -f infrastructure/docker/docker-compose.prod.yml ]; then
        echo "Found: infrastructure/docker/docker-compose.prod.yml"
    elif [ -f infrastructure/docker/docker-compose.yml ]; then
        echo "Found: infrastructure/docker/docker-compose.yml"
    else
        echo "Compose file not found in current directory"
    fi
else
    echo ""
    echo "✗ Connection failed even with PostgreSQL password"
    echo "There may be a different issue"
fi
