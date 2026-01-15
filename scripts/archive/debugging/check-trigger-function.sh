#!/bin/bash
# Check the set_request_expires_at trigger function definition

echo "=========================================="
echo "Trigger Function Definition"
echo "=========================================="
echo ""

cd ~/karmyq/infrastructure/docker

docker exec -i karmyq-postgres psql -U karmyq_prod -d karmyq_prod << 'EOF'
-- Get the function definition
SELECT pg_get_functiondef(oid)
FROM pg_proc
WHERE proname = 'set_request_expires_at'
  AND pronamespace = 'requests'::regnamespace;
EOF

echo ""
echo "=========================================="
echo "Function Check Complete"
echo "=========================================="
