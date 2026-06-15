-- ============================================================================
-- Sprint 100 / ADR-078 — Backfill historical community connections + trust edges
-- ============================================================================
--
-- For every COMPLETED match, ensure:
--   1. a social_graph.connections row for the (requester, responder) pair, and
--   2. a per-community social_graph.trust_edges row for EACH community the request
--      belongs to (requests.request_communities).
--
-- WHY: before ADR-078 the match_completed subscriber only created a community trust
-- edge when the event payload carried `community_id` — which the publisher never set.
-- So completed exchanges the community pulse counts had no connection / trust edge.
-- The live audit found 0 trust edges for two communities whose pulses counted 9
-- completed exchanges each (see docs/bugs/sprint-100-pulse-truth-actionability.md).
--
-- This is a SCRIPT, not a migration (NOT placed in infrastructure/postgres/migrations/).
-- It is IDEMPOTENT (ON CONFLICT DO NOTHING) and safe to re-run — a second run inserts 0
-- rows. New edges only carry the match_completed contribution (raw_weight = count ×
-- community match_completed weight, default 1.0); existing edges are left untouched.
--
-- Self-matches (requester = responder) are excluded.
--
-- Run (inside the karmyq-postgres container):
--   docker exec karmyq-postgres sh -c 'PGPASSWORD=$POSTGRES_PASSWORD psql -U "$POSTGRES_USER" \
--     -d "$POSTGRES_DB" -f /tmp/backfill-community-connections.sql'
-- ============================================================================

\echo '===== BEFORE ====='
SELECT
  (SELECT COUNT(*) FROM social_graph.connections)                                   AS connections_total,
  (SELECT COUNT(*) FROM social_graph.trust_edges)                                   AS trust_edges_total,
  (SELECT COUNT(*) FROM (
     SELECT DISTINCT LEAST(hr.requester_id::text, m.responder_id::text),
                     GREATEST(hr.requester_id::text, m.responder_id::text)
     FROM requests.matches m
     JOIN requests.help_requests hr ON hr.id = m.request_id
     WHERE m.status = 'completed' AND hr.requester_id <> m.responder_id
   ) p)                                                                             AS distinct_completed_pairs,
  (SELECT COUNT(*) FROM (
     SELECT DISTINCT LEAST(hr.requester_id::text, m.responder_id::text) AS a,
                     GREATEST(hr.requester_id::text, m.responder_id::text) AS b,
                     rc.community_id
     FROM requests.matches m
     JOIN requests.help_requests hr ON hr.id = m.request_id
     JOIN requests.request_communities rc ON rc.request_id = m.request_id
     WHERE m.status = 'completed' AND hr.requester_id <> m.responder_id
   ) pc)                                                                            AS expected_community_edges;

-- ---------------------------------------------------------------------------
-- 1. Connections (community-agnostic relationship)
-- ---------------------------------------------------------------------------
INSERT INTO social_graph.connections (user_a_id, user_b_id, type, first_connected_at, last_interaction_at)
SELECT
  LEAST(hr.requester_id::text, m.responder_id::text)::uuid,
  GREATEST(hr.requester_id::text, m.responder_id::text)::uuid,
  'exchange',
  MIN(m.completed_at),
  MAX(m.completed_at)
FROM requests.matches m
JOIN requests.help_requests hr ON hr.id = m.request_id
WHERE m.status = 'completed' AND hr.requester_id <> m.responder_id
GROUP BY 1, 2
ON CONFLICT (
  LEAST(user_a_id::text, user_b_id::text),
  GREATEST(user_a_id::text, user_b_id::text)
) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 2. Per-community trust edges (one per community the request belongs to)
--    raw_weight = match_completed_count × community match_completed weight
--    (prefer the community-specific weight, else the platform default, else 1.0).
-- ---------------------------------------------------------------------------
INSERT INTO social_graph.trust_edges
  (user_id_a, user_id_b, community_id, match_completed_count, raw_weight, last_interaction_at)
SELECT
  pair.ua,
  pair.ub,
  pair.community_id,
  pair.mc_count,
  pair.mc_count * COALESCE(
    (SELECT iw.weight FROM social_graph.interaction_weights iw
      WHERE iw.interaction_type = 'match_completed'
        AND (iw.community_id = pair.community_id OR iw.community_id IS NULL)
      ORDER BY iw.community_id NULLS LAST
      LIMIT 1),
    1.0
  ) AS raw_weight,
  pair.last_completed
FROM (
  SELECT
    LEAST(hr.requester_id::text, m.responder_id::text)::uuid    AS ua,
    GREATEST(hr.requester_id::text, m.responder_id::text)::uuid AS ub,
    rc.community_id                                             AS community_id,
    COUNT(*)                                                    AS mc_count,
    MAX(m.completed_at)                                         AS last_completed
  FROM requests.matches m
  JOIN requests.help_requests hr ON hr.id = m.request_id
  JOIN requests.request_communities rc ON rc.request_id = m.request_id
  WHERE m.status = 'completed' AND hr.requester_id <> m.responder_id
  GROUP BY ua, ub, rc.community_id
) pair
ON CONFLICT (user_id_a, user_id_b, community_id) DO NOTHING;

\echo '===== AFTER ====='
SELECT
  (SELECT COUNT(*) FROM social_graph.connections) AS connections_total,
  (SELECT COUNT(*) FROM social_graph.trust_edges) AS trust_edges_total;
