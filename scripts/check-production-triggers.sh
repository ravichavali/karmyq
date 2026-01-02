#!/bin/bash
# Check for problematic triggers in production database

echo "=========================================="
echo "Production Database Trigger Check"
echo "=========================================="
echo ""

cd ~/karmyq/infrastructure/docker

# Get database password
POSTGRES_PASSWORD=$(grep POSTGRES_PASSWORD .env | cut -d '=' -f2)

echo "Checking triggers on requests.help_requests table..."
echo ""

docker exec -i karmyq-postgres psql -U karmyq_prod -d karmyq_prod << EOF
-- List all triggers on help_requests
SELECT
    tgname AS trigger_name,
    pg_get_triggerdef(oid) AS trigger_definition
FROM pg_trigger
WHERE tgrelid = 'requests.help_requests'::regclass
  AND tgisinternal = false;

-- Check if there's a trigger referencing community_id
SELECT
    tgname,
    pg_get_triggerdef(oid)
FROM pg_trigger
WHERE pg_get_triggerdef(oid) LIKE '%community_id%'
  AND tgrelid IN (
    SELECT oid
    FROM pg_class
    WHERE relnamespace = 'requests'::regnamespace
  );
EOF

echo ""
echo "=========================================="
echo "Trigger Check Complete"
echo "=========================================="
