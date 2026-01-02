#!/bin/bash
# Fix the set_request_expires_at trigger function to work without community_id column

echo "=========================================="
echo "Fix Request Expires Trigger Function"
echo "=========================================="
echo ""

cd ~/karmyq/infrastructure/docker

echo "Updating trigger function to remove community_id dependency..."
echo ""

docker exec -i karmyq-postgres psql -U karmyq_prod -d karmyq_prod << 'EOF'
-- Drop and recreate the trigger function without community_id reference
-- Since requests can belong to multiple communities via junction table,
-- we'll use a default TTL instead of community-specific TTL

CREATE OR REPLACE FUNCTION requests.set_request_expires_at()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.expires_at IS NULL THEN
        -- Default to 60 days from creation (production default TTL)
        -- This will be overridden if needed via API/application logic
        NEW.expires_at := NEW.created_at + INTERVAL '60 days';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Verify the function was updated
SELECT pg_get_functiondef(oid)
FROM pg_proc
WHERE proname = 'set_request_expires_at'
  AND pronamespace = 'requests'::regnamespace;
EOF

echo ""
echo "=========================================="
echo "✅ Trigger Function Updated"
echo "=========================================="
echo ""
echo "The function now sets a default 60-day expiration"
echo "without trying to access the non-existent community_id field."
