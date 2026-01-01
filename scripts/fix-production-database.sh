#!/bin/bash
# Fix production database user and permissions

echo "======================================"
echo "Fixing Production Database Configuration"
echo "======================================"
echo ""

# Get the database password from environment or generate one
DB_PASSWORD="${POSTGRES_PASSWORD:-$(openssl rand -hex 16)}"

echo "1. Creating database user 'karmyq_prod'..."
docker exec -i karmyq-postgres psql -U postgres <<EOF
-- Create the user if it doesn't exist
DO \$\$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_user WHERE usename = 'karmyq_prod') THEN
        CREATE USER karmyq_prod WITH PASSWORD '$DB_PASSWORD';
    END IF;
END
\$\$;

-- Create the database if it doesn't exist
SELECT 'CREATE DATABASE karmyq_prod OWNER karmyq_prod'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'karmyq_prod')\gexec

-- Grant all privileges
GRANT ALL PRIVILEGES ON DATABASE karmyq_prod TO karmyq_prod;

-- Connect to karmyq_prod and set up schemas
\c karmyq_prod

-- Grant schema permissions
GRANT ALL ON SCHEMA public TO karmyq_prod;
GRANT ALL ON SCHEMA auth TO karmyq_prod;
GRANT ALL ON SCHEMA community TO karmyq_prod;
GRANT ALL ON SCHEMA requests TO karmyq_prod;
GRANT ALL ON SCHEMA reputation TO karmyq_prod;
GRANT ALL ON SCHEMA notifications TO karmyq_prod;
GRANT ALL ON SCHEMA messaging TO karmyq_prod;

-- Grant all privileges on all tables
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO karmyq_prod;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA auth TO karmyq_prod;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA community TO karmyq_prod;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA requests TO karmyq_prod;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA reputation TO karmyq_prod;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA notifications TO karmyq_prod;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA messaging TO karmyq_prod;

-- Grant all privileges on all sequences
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO karmyq_prod;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA auth TO karmyq_prod;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA community TO karmyq_prod;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA requests TO karmyq_prod;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA reputation TO karmyq_prod;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA notifications TO karmyq_prod;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA messaging TO karmyq_prod;

-- Set default privileges for future tables
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO karmyq_prod;
ALTER DEFAULT PRIVILEGES IN SCHEMA auth GRANT ALL ON TABLES TO karmyq_prod;
ALTER DEFAULT PRIVILEGES IN SCHEMA community GRANT ALL ON TABLES TO karmyq_prod;
ALTER DEFAULT PRIVILEGES IN SCHEMA requests GRANT ALL ON TABLES TO karmyq_prod;
ALTER DEFAULT PRIVILEGES IN SCHEMA reputation GRANT ALL ON TABLES TO karmyq_prod;
ALTER DEFAULT PRIVILEGES IN SCHEMA notifications GRANT ALL ON TABLES TO karmyq_prod;
ALTER DEFAULT PRIVILEGES IN SCHEMA messaging GRANT ALL ON TABLES TO karmyq_prod;

EOF

if [ $? -eq 0 ]; then
    echo "✓ Database user and permissions configured"
else
    echo "✗ Failed to configure database"
    exit 1
fi

echo ""
echo "2. Verifying database connection..."
docker exec -i karmyq-postgres psql -U karmyq_prod -d karmyq_prod -c "SELECT current_database(), current_user;"

if [ $? -eq 0 ]; then
    echo "✓ Connection verified"
else
    echo "✗ Connection failed"
    exit 1
fi

echo ""
echo "3. Checking if schemas exist..."
docker exec -i karmyq-postgres psql -U karmyq_prod -d karmyq_prod -c "SELECT schema_name FROM information_schema.schemata WHERE schema_name NOT LIKE 'pg_%' AND schema_name != 'information_schema';"

echo ""
echo "======================================"
echo "Database Configuration Complete"
echo "======================================"
echo ""
echo "Database Password: $DB_PASSWORD"
echo ""
echo "Next steps:"
echo "1. Update .env file with: POSTGRES_PASSWORD=$DB_PASSWORD"
echo "2. Restart services: docker-compose restart auth-service community-service request-service"
echo "3. Check logs: docker logs karmyq-auth-service --tail=20"
