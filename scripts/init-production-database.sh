#!/bin/bash
# Initialize production database schemas
# The database and user already exist, we just need to run the init.sql

echo "======================================"
echo "Initializing Production Database"
echo "======================================"
echo ""

# Get database credentials from container
DB_USER=$(docker exec karmyq-postgres env | grep POSTGRES_USER | cut -d= -f2)
DB_NAME=$(docker exec karmyq-postgres env | grep POSTGRES_DB | cut -d= -f2)
DB_PASSWORD=$(docker exec karmyq-postgres env | grep POSTGRES_PASSWORD | cut -d= -f2)

echo "Database: $DB_NAME"
echo "User: $DB_USER"
echo ""

echo "1. Checking if database exists..."
docker exec -i karmyq-postgres psql -U "$DB_USER" -d "$DB_NAME" -c "SELECT current_database(), current_user;" 2>&1

if [ $? -eq 0 ]; then
    echo "✓ Database connection successful"
else
    echo "✗ Database connection failed"
    echo ""
    echo "The database and user exist but there might be a permission issue."
    echo "Let's check if we need to run init.sql..."
fi

echo ""
echo "2. Checking existing schemas..."
SCHEMAS=$(docker exec -i karmyq-postgres psql -U "$DB_USER" -d "$DB_NAME" -t -c "SELECT schema_name FROM information_schema.schemata WHERE schema_name NOT LIKE 'pg_%' AND schema_name != 'information_schema';" 2>&1)

echo "Current schemas:"
echo "$SCHEMAS"

echo ""
echo "3. Checking if init.sql exists in container..."
docker exec karmyq-postgres ls -la /docker-entrypoint-initdb.d/

echo ""
echo "4. Running init.sql manually (if needed)..."
if [ -f ~/karmyq/infrastructure/postgres/init.sql ]; then
    echo "Found init.sql locally, copying to container..."
    docker cp ~/karmyq/infrastructure/postgres/init.sql karmyq-postgres:/tmp/init.sql

    echo "Executing init.sql..."
    docker exec -i karmyq-postgres psql -U "$DB_USER" -d "$DB_NAME" -f /tmp/init.sql 2>&1 | head -50

    if [ ${PIPESTATUS[0]} -eq 0 ]; then
        echo "✓ Database initialized"
    else
        echo "⚠ Some errors occurred (may be expected if tables already exist)"
    fi
else
    echo "✗ init.sql not found at ~/karmyq/infrastructure/postgres/init.sql"
fi

echo ""
echo "5. Verifying schemas after init..."
docker exec -i karmyq-postgres psql -U "$DB_USER" -d "$DB_NAME" -c "SELECT schema_name FROM information_schema.schemata WHERE schema_name NOT LIKE 'pg_%' AND schema_name != 'information_schema';"

echo ""
echo "6. Checking tables in auth schema..."
docker exec -i karmyq-postgres psql -U "$DB_USER" -d "$DB_NAME" -c "SELECT tablename FROM pg_tables WHERE schemaname = 'auth';"

echo ""
echo "======================================"
echo "Database Initialization Complete"
echo "======================================"
echo ""
echo "Next steps:"
echo "1. Restart services: docker-compose restart"
echo "2. Check logs: docker logs karmyq-auth-service --tail=20"
echo "3. Test API: curl https://karmyq.com/api/auth/health"
