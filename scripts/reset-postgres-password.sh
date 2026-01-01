#!/bin/bash
# Reset PostgreSQL password to match environment variable

echo "======================================"
echo "Resetting PostgreSQL Password"
echo "======================================"
echo ""

# Get the password from environment
PG_PASSWORD=$(docker exec karmyq-postgres env | grep POSTGRES_PASSWORD | cut -d= -f2)

echo "Expected password from environment: $PG_PASSWORD"
echo ""

echo "1. Resetting password for karmyq_prod user..."
docker exec -i karmyq-postgres psql -U karmyq_prod -d karmyq_prod <<EOF
ALTER USER karmyq_prod WITH PASSWORD '$PG_PASSWORD';
EOF

if [ $? -eq 0 ]; then
    echo "✓ Password reset successfully"
else
    echo "✗ Failed to reset password"
    echo ""
    echo "Trying with postgres superuser (if it exists)..."

    # Try to find if there's a postgres user we can use
    docker exec -i karmyq-postgres psql -U postgres -d postgres <<EOF 2>&1
ALTER USER karmyq_prod WITH PASSWORD '$PG_PASSWORD';
EOF

    if [ $? -eq 0 ]; then
        echo "✓ Password reset using postgres superuser"
    fi
fi

echo ""
echo "2. Verifying user exists and checking authentication method..."
docker exec -i karmyq-postgres psql -U karmyq_prod -d karmyq_prod -c "\du karmyq_prod"

echo ""
echo "3. Testing connection with new password..."
# Export password and test
docker exec -i karmyq-postgres sh -c "PGPASSWORD='$PG_PASSWORD' psql -U karmyq_prod -d karmyq_prod -c 'SELECT current_user, current_database();'"

if [ $? -eq 0 ]; then
    echo ""
    echo "✓ Connection successful with new password!"
    echo ""
    echo "Now restart the auth service:"
    echo "  docker restart karmyq-auth-service"
    echo "  sleep 10"
    echo "  docker logs karmyq-auth-service --tail=20"
else
    echo ""
    echo "✗ Connection still failing"
    echo ""
    echo "Checking pg_hba.conf for authentication method..."
    docker exec karmyq-postgres cat /var/lib/postgresql/data/pg_hba.conf | grep -v "^#" | grep -v "^$" | tail -5
fi

echo ""
echo "======================================"
echo "Password Reset Complete"
echo "======================================"
