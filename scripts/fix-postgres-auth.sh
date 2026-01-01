#!/bin/bash
# Fix PostgreSQL authentication settings

echo "======================================"
echo "Fixing PostgreSQL Authentication"
echo "======================================"
echo ""

# Get the password
PG_PASSWORD=$(docker exec karmyq-postgres env | grep POSTGRES_PASSWORD | cut -d= -f2)

echo "1. Checking if karmyq_prod user can authenticate..."
docker exec -i karmyq-postgres psql -U karmyq_prod -d karmyq_prod -c "SELECT 'Authentication works!' as status;" 2>&1

if [ $? -ne 0 ]; then
    echo ""
    echo "2. Authentication failed. Checking pg_hba.conf..."
    docker exec karmyq-postgres cat /var/lib/postgresql/data/pg_hba.conf | grep -v "^#" | grep -v "^$"

    echo ""
    echo "3. Setting password for karmyq_prod user..."
    docker exec -i karmyq-postgres psql -U karmyq_prod -d karmyq_prod <<EOF
ALTER USER karmyq_prod WITH PASSWORD '$PG_PASSWORD';
EOF

    echo ""
    echo "4. Testing connection again..."
    docker exec -i karmyq-postgres psql -U karmyq_prod -d karmyq_prod -c "SELECT 'Now it works!' as status;"
else
    echo "✓ Direct authentication works"
fi

echo ""
echo "5. Testing connection FROM auth service container..."
# Test connection from the auth service using the same credentials
docker exec karmyq-auth-service sh -c "apt-get update -qq && apt-get install -y -qq postgresql-client > /dev/null 2>&1 && PGPASSWORD='$PG_PASSWORD' psql -h postgres -U karmyq_prod -d karmyq_prod -c 'SELECT current_database();'" 2>&1

if [ $? -eq 0 ]; then
    echo "✓ Connection from auth service works!"
else
    echo "✗ Connection from auth service failed"
    echo ""
    echo "This might be a pg_hba.conf issue. Let's check the configuration..."

    echo ""
    echo "6. Checking PostgreSQL pg_hba.conf..."
    docker exec karmyq-postgres cat /var/lib/postgresql/data/pg_hba.conf

    echo ""
    echo "7. Updating pg_hba.conf to allow all connections with password..."
    docker exec karmyq-postgres sh -c "echo 'host all all all md5' >> /var/lib/postgresql/data/pg_hba.conf"

    echo ""
    echo "8. Reloading PostgreSQL configuration..."
    docker exec karmyq-postgres psql -U karmyq_prod -d karmyq_prod -c "SELECT pg_reload_conf();"

    echo ""
    echo "9. Testing connection again from auth service..."
    docker exec karmyq-auth-service sh -c "PGPASSWORD='$PG_PASSWORD' psql -h postgres -U karmyq_prod -d karmyq_prod -c 'SELECT current_database();'" 2>&1
fi

echo ""
echo "======================================"
echo "PostgreSQL Authentication Check Complete"
echo "======================================"
echo ""
echo "If authentication now works, restart auth service:"
echo "  docker restart karmyq-auth-service"
echo "  docker logs karmyq-auth-service --tail=20"
