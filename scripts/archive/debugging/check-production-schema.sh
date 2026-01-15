#!/bin/bash
# Check production database schema for help_requests table

echo "=========================================="
echo "Production Schema Check: help_requests"
echo "=========================================="
echo ""

cd ~/karmyq/infrastructure/docker

echo "Table structure:"
echo ""

docker exec -i karmyq-postgres psql -U karmyq_prod -d karmyq_prod << EOF
-- Get column definitions
\d+ requests.help_requests

-- Check for community_id column
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'requests'
  AND table_name = 'help_requests'
ORDER BY ordinal_position;
EOF

echo ""
echo "=========================================="
echo "Schema Check Complete"
echo "=========================================="
