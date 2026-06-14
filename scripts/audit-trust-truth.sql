-- Sprint 98 Trust Truth Audit
-- Read-only audit of trust edge membership, graph/path cache drift, provider shared
-- communities, dibs relationship truth, and dashboard feed data.
-- Run inside the demo postgres container:
--   docker exec karmyq-postgres sh -c \
--     'PGPASSWORD=$POSTGRES_PASSWORD psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -f /tmp/audit-trust-truth.sql'

\echo '=== 1. Trust edges whose endpoints are not active members of edge community ==='
SELECT te.community_id, c.name AS community_name, te.user_id_a, ua.email AS user_a_email,
       te.user_id_b, ub.email AS user_b_email, te.raw_weight
FROM social_graph.trust_edges te
JOIN communities.communities c ON c.id = te.community_id
JOIN auth.users ua ON ua.id = te.user_id_a
JOIN auth.users ub ON ub.id = te.user_id_b
LEFT JOIN communities.members ma
  ON ma.community_id = te.community_id AND ma.user_id = te.user_id_a AND ma.status = 'active'
LEFT JOIN communities.members mb
  ON mb.community_id = te.community_id AND mb.user_id = te.user_id_b AND mb.status = 'active'
WHERE ma.id IS NULL OR mb.id IS NULL
ORDER BY c.name, te.raw_weight DESC;

\echo '=== 1b. Count of trust edges with non-active endpoints ==='
SELECT COUNT(*) AS non_member_trust_edges
FROM social_graph.trust_edges te
LEFT JOIN communities.members ma
  ON ma.community_id = te.community_id AND ma.user_id = te.user_id_a AND ma.status = 'active'
LEFT JOIN communities.members mb
  ON mb.community_id = te.community_id AND mb.user_id = te.user_id_b AND mb.status = 'active'
WHERE ma.id IS NULL OR mb.id IS NULL;

\echo '=== 2. exchange social_graph.connections without a completed match between the users ==='
SELECT sg.user_a_id, ua.email AS user_a_email, sg.user_b_id, ub.email AS user_b_email, sg.type
FROM social_graph.connections sg
JOIN auth.users ua ON ua.id = sg.user_a_id
JOIN auth.users ub ON ub.id = sg.user_b_id
WHERE sg.type = 'exchange'
  AND NOT EXISTS (
  SELECT 1
  FROM requests.matches m
  JOIN requests.help_requests hr ON hr.id = m.request_id
  WHERE m.status = 'completed'
    AND (
      (hr.requester_id = sg.user_a_id AND m.responder_id = sg.user_b_id)
      OR (hr.requester_id = sg.user_b_id AND m.responder_id = sg.user_a_id)
    )
)
ORDER BY ua.email, ub.email;

\echo '=== 3. Cached social distances with missing, expired, or suspicious community context ==='
SELECT sd.user_a_id, ua.email AS user_a_email, sd.user_b_id, ub.email AS user_b_email,
       sd.community_id, sd.degrees_of_separation, sd.connection_type, sd.expires_at
FROM auth.social_distances sd
JOIN auth.users ua ON ua.id = sd.user_a_id
JOIN auth.users ub ON ub.id = sd.user_b_id
WHERE sd.community_id IS NULL
   OR sd.expires_at <= NOW()
   OR NOT EXISTS (
     SELECT 1
     FROM communities.communities c
     WHERE c.id = sd.community_id
   )
ORDER BY sd.computed_at DESC
LIMIT 100;

\echo '=== 3b. Distinct community_id values cached in social_distances (look for non-UUID/legacy) ==='
SELECT sd.community_id, COUNT(*) AS rows
FROM auth.social_distances sd
GROUP BY sd.community_id
ORDER BY rows DESC
LIMIT 50;

\echo '=== 4. Provider shared-community candidates that are not active on both sides ==='
SELECT pp.id AS provider_id, viewer.email AS viewer_email, provider_user.email AS provider_email,
       cm_provider.community_id, cm_provider.status AS provider_status, cm_viewer.status AS viewer_status
FROM requests.provider_profiles pp
JOIN auth.users provider_user ON provider_user.id = pp.user_id
JOIN communities.members cm_provider ON cm_provider.user_id = pp.user_id
JOIN communities.members cm_viewer ON cm_viewer.community_id = cm_provider.community_id
JOIN auth.users viewer ON viewer.id = cm_viewer.user_id
WHERE cm_provider.status <> 'active' OR cm_viewer.status <> 'active'
LIMIT 100;

\echo '=== 5. Dibs admin-proposed matches with no active shared community ==='
SELECT m.request_id, hr.requester_id, m.responder_id
FROM requests.matches m
JOIN requests.help_requests hr ON hr.id = m.request_id
WHERE m.admin_proposed = TRUE
  AND NOT EXISTS (
    SELECT 1
    FROM communities.members requester_member
    JOIN communities.members responder_member
      ON responder_member.community_id = requester_member.community_id
     AND responder_member.user_id = m.responder_id
     AND responder_member.status = 'active'
    WHERE requester_member.user_id = hr.requester_id
      AND requester_member.status = 'active'
  )
LIMIT 100;
