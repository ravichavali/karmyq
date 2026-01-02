#!/bin/bash
# Fix the set_message_expires_at trigger function to work without r.community_id

echo "=========================================="
echo "Fix Message Expires Trigger Function"
echo "=========================================="
echo ""

cd ~/karmyq/infrastructure/docker

echo "Updating trigger function to remove r.community_id reference..."
echo ""

docker exec -i karmyq-postgres psql -U karmyq_prod -d karmyq_prod << 'EOF'
-- Drop and recreate the trigger function without r.community_id reference
-- Since requests use junction table (request_communities), we need to get
-- community_id differently or use default TTL

CREATE OR REPLACE FUNCTION messaging.set_message_expires_at()
RETURNS TRIGGER AS $$
DECLARE
    v_community_id UUID;
BEGIN
    -- Get community_id from conversation's match via request_communities junction table
    SELECT rc.community_id INTO v_community_id
    FROM messaging.conversations conv
    JOIN requests.matches m ON conv.request_match_id = m.id
    JOIN requests.request_communities rc ON m.request_id = rc.request_id
    WHERE conv.id = NEW.conversation_id
    LIMIT 1; -- Take first community if request is in multiple

    IF v_community_id IS NOT NULL AND NEW.expires_at IS NULL THEN
        NEW.expires_at := communities.calculate_expires_at(v_community_id, 'message', NEW.created_at);
    ELSIF NEW.expires_at IS NULL THEN
        -- Fallback to default 60 days if no community found
        NEW.expires_at := NEW.created_at + INTERVAL '60 days';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Verify the function was updated
SELECT pg_get_functiondef(oid)
FROM pg_proc
WHERE proname = 'set_message_expires_at'
  AND pronamespace = 'messaging'::regnamespace;
EOF

echo ""
echo "=========================================="
echo "✅ Message Trigger Function Updated"
echo "=========================================="
echo ""
echo "The function now gets community_id from request_communities junction table"
echo "instead of trying to access the non-existent r.community_id column."
