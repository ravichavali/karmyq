#!/bin/bash
# Check recent requests in the database

echo "=========================================="
echo "Recent Help Requests"
echo "=========================================="
echo ""

cd ~/karmyq/infrastructure/docker

docker exec karmyq-postgres psql -U karmyq_prod -d karmyq_prod -c "
SELECT
    r.id,
    r.title,
    r.requester_id,
    u.email as requester_email,
    r.status,
    r.created_at,
    STRING_AGG(c.name, ', ') as communities
FROM requests.help_requests r
LEFT JOIN auth.users u ON r.requester_id = u.id
LEFT JOIN requests.request_communities rc ON r.id = rc.request_id
LEFT JOIN communities.communities c ON rc.community_id = c.id
WHERE r.created_at > NOW() - INTERVAL '1 hour'
  AND r.expired = FALSE
GROUP BY r.id, r.title, r.requester_id, u.email, r.status, r.created_at
ORDER BY r.created_at DESC
LIMIT 10;
"

echo ""
echo "Total requests in system:"
docker exec karmyq-postgres psql -U karmyq_prod -d karmyq_prod -t -c "
SELECT COUNT(*) FROM requests.help_requests WHERE expired = FALSE;
"

echo ""
echo "Requests by status:"
docker exec karmyq-postgres psql -U karmyq_prod -d karmyq_prod -c "
SELECT status, COUNT(*) as count
FROM requests.help_requests
WHERE expired = FALSE
GROUP BY status
ORDER BY count DESC;
"
