\echo '1. Communities where current_members differs from active member rows'
SELECT
  c.id,
  c.name,
  c.current_members,
  COUNT(m.id) FILTER (WHERE m.status = 'active') AS active_member_rows
FROM communities.communities c
LEFT JOIN communities.members m ON m.community_id = c.id
GROUP BY c.id, c.name, c.current_members
HAVING c.current_members IS DISTINCT FROM COUNT(m.id) FILTER (WHERE m.status = 'active')
ORDER BY ABS(c.current_members - COUNT(m.id) FILTER (WHERE m.status = 'active')) DESC;

\echo '2. Recent pulse helpers who are not active members of the pulse community'
SELECT
  rc.community_id,
  c.name AS community_name,
  u.name AS helper_name,
  u.email AS helper_email,
  COUNT(*) AS completed_matches_in_window
FROM requests.matches match
JOIN requests.request_communities rc ON match.request_id = rc.request_id
JOIN communities.communities c ON c.id = rc.community_id
JOIN auth.users u ON u.id = match.responder_id
LEFT JOIN communities.members member
  ON member.community_id = rc.community_id
 AND member.user_id = match.responder_id
 AND member.status = 'active'
WHERE match.status = 'completed'
  AND match.completed_at >= NOW() - INTERVAL '7 days'
  AND member.id IS NULL
GROUP BY rc.community_id, c.name, u.name, u.email
ORDER BY completed_matches_in_window DESC, c.name, u.name;

\echo '3. Open requests without an active request_communities community'
SELECT
  hr.id,
  hr.title,
  hr.requester_id,
  hr.status,
  COUNT(rc.community_id) AS linked_communities
FROM requests.help_requests hr
LEFT JOIN requests.request_communities rc ON rc.request_id = hr.id
LEFT JOIN communities.communities c ON c.id = rc.community_id AND c.status = 'active'
WHERE hr.status = 'open'
  AND hr.expired = FALSE
GROUP BY hr.id, hr.title, hr.requester_id, hr.status
HAVING COUNT(c.id) = 0
ORDER BY hr.created_at DESC;

\echo '4. Rich tester ranking'
WITH member_counts AS (
  SELECT user_id, COUNT(DISTINCT community_id) AS active_communities
  FROM communities.members
  WHERE status = 'active'
  GROUP BY user_id
),
trust_counts AS (
  SELECT user_id, COUNT(*) AS trust_edges, ROUND(SUM(raw_weight)::numeric, 2) AS trust_weight
  FROM (
    SELECT user_id_a AS user_id, raw_weight FROM social_graph.trust_edges
    UNION ALL
    SELECT user_id_b AS user_id, raw_weight FROM social_graph.trust_edges
  ) edges
  GROUP BY user_id
),
connection_counts AS (
  SELECT user_id, COUNT(*) AS connections
  FROM (
    SELECT user_a_id AS user_id FROM social_graph.connections
    UNION ALL
    SELECT user_b_id AS user_id FROM social_graph.connections
  ) connections
  GROUP BY user_id
),
request_counts AS (
  SELECT requester_id AS user_id, COUNT(*) AS requests_created
  FROM requests.help_requests
  GROUP BY requester_id
),
responder_counts AS (
  SELECT responder_id AS user_id, COUNT(*) AS responder_matches
  FROM requests.matches
  GROUP BY responder_id
),
requester_match_counts AS (
  SELECT hr.requester_id AS user_id, COUNT(m.id) AS requester_matches
  FROM requests.help_requests hr
  JOIN requests.matches m ON m.request_id = hr.id
  GROUP BY hr.requester_id
),
profile_counts AS (
  SELECT user_id, COUNT(*) FILTER (WHERE is_active) AS provider_profiles, BOOL_OR(is_available) AS provider_available
  FROM requests.provider_profiles
  GROUP BY user_id
)
SELECT
  u.name,
  u.email,
  COALESCE(mc.active_communities, 0) AS active_communities,
  COALESCE(tc.trust_edges, 0) AS trust_edges,
  COALESCE(tc.trust_weight, 0) AS trust_weight,
  COALESCE(cc.connections, 0) AS connections,
  COALESCE(rc.requests_created, 0) AS requests_created,
  COALESCE(rsc.responder_matches, 0) AS responder_matches,
  COALESCE(rqc.requester_matches, 0) AS requester_matches,
  COALESCE(pc.provider_profiles, 0) AS provider_profiles,
  COALESCE(pc.provider_available, false) AS provider_available
FROM auth.users u
LEFT JOIN member_counts mc ON mc.user_id = u.id
LEFT JOIN trust_counts tc ON tc.user_id = u.id
LEFT JOIN connection_counts cc ON cc.user_id = u.id
LEFT JOIN request_counts rc ON rc.user_id = u.id
LEFT JOIN responder_counts rsc ON rsc.user_id = u.id
LEFT JOIN requester_match_counts rqc ON rqc.user_id = u.id
LEFT JOIN profile_counts pc ON pc.user_id = u.id
WHERE u.email LIKE '%@test.karmyq.com'
ORDER BY (
  COALESCE(mc.active_communities, 0) * 10
  + COALESCE(tc.trust_edges, 0) * 2
  + COALESCE(cc.connections, 0) * 2
  + (COALESCE(rsc.responder_matches, 0) + COALESCE(rqc.requester_matches, 0)) * 3
  + COALESCE(rc.requests_created, 0)
  + COALESCE(pc.provider_profiles, 0) * 8
) DESC
LIMIT 10;
