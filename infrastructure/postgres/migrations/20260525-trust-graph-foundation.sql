-- 20260525-trust-graph-foundation.sql
-- Trust Graph Foundation: weighted user-user and community-community edges

-- Weighted trust edges (community-scoped, bidirectional)
CREATE TABLE IF NOT EXISTS social_graph.trust_edges (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id_a             UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_id_b             UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  community_id          UUID NOT NULL REFERENCES communities.communities(id) ON DELETE CASCADE,
  match_completed_count INT NOT NULL DEFAULT 0,
  endorsement_count     INT NOT NULL DEFAULT 0,
  karma_given_count     INT NOT NULL DEFAULT 0,
  event_count           INT NOT NULL DEFAULT 0,
  raw_weight            FLOAT NOT NULL DEFAULT 0,
  last_interaction_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT trust_edges_normalized CHECK (user_id_a::text < user_id_b::text),
  UNIQUE(user_id_a, user_id_b, community_id)
);

CREATE INDEX IF NOT EXISTS trust_edges_user_a_community ON social_graph.trust_edges(user_id_a, community_id);
CREATE INDEX IF NOT EXISTS trust_edges_user_b_community ON social_graph.trust_edges(user_id_b, community_id);
CREATE INDEX IF NOT EXISTS trust_edges_community ON social_graph.trust_edges(community_id);
CREATE INDEX IF NOT EXISTS trust_edges_weight ON social_graph.trust_edges(raw_weight DESC);

-- Interaction weight config (NULL community_id = platform default)
CREATE TABLE IF NOT EXISTS social_graph.interaction_weights (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id     UUID REFERENCES communities.communities(id) ON DELETE CASCADE,
  interaction_type TEXT NOT NULL CHECK (interaction_type IN ('match_completed','endorsement','karma_given','event')),
  weight           FLOAT NOT NULL DEFAULT 1.0,
  UNIQUE(community_id, interaction_type)
);

-- Platform default weights. A bare UNIQUE(community_id, interaction_type) does NOT dedupe rows with
-- community_id = NULL (Postgres treats NULLs as distinct), so a bare ON CONFLICT DO NOTHING would
-- silently re-insert duplicate global rows on every re-run. A partial unique index on the NULL rows
-- gives ON CONFLICT a real target (same pattern as 20260607-designed-to-forget.sql).
CREATE UNIQUE INDEX IF NOT EXISTS uq_interaction_weights_global
  ON social_graph.interaction_weights (interaction_type) WHERE community_id IS NULL;

INSERT INTO social_graph.interaction_weights (community_id, interaction_type, weight) VALUES
  (NULL, 'match_completed', 10.0),
  (NULL, 'endorsement',      5.0),
  (NULL, 'karma_given',      3.0),
  (NULL, 'event',            2.0)
ON CONFLICT (interaction_type) WHERE community_id IS NULL DO NOTHING;

-- Community-to-community trust edges (fractal level 2)
CREATE TABLE IF NOT EXISTS social_graph.community_trust_edges (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id_a          UUID NOT NULL REFERENCES communities.communities(id) ON DELETE CASCADE,
  community_id_b          UUID NOT NULL REFERENCES communities.communities(id) ON DELETE CASCADE,
  cross_interaction_count INT NOT NULL DEFAULT 0,
  weight                  FLOAT NOT NULL DEFAULT 0,
  last_interaction_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT community_trust_normalized CHECK (community_id_a::text < community_id_b::text),
  UNIQUE(community_id_a, community_id_b)
);

-- Backfill trust_edges from existing completed matches
-- Uses 10.0 weight per match (platform default for match_completed)
-- Takes the first shared community between requester and responder
INSERT INTO social_graph.trust_edges (
  user_id_a, user_id_b, community_id,
  match_completed_count, raw_weight, last_interaction_at
)
SELECT
  LEAST(hr.requester_id::text, m.responder_id::text)::uuid   AS user_id_a,
  GREATEST(hr.requester_id::text, m.responder_id::text)::uuid AS user_id_b,
  rc.community_id,
  COUNT(*)::int                                               AS match_completed_count,
  COUNT(*) * 10.0                                             AS raw_weight,
  MAX(m.completed_at)                                         AS last_interaction_at
FROM requests.matches m
JOIN requests.help_requests hr ON hr.id = m.request_id
JOIN requests.request_communities rc ON rc.request_id = m.request_id
WHERE m.status = 'completed'
  AND m.completed_at IS NOT NULL
GROUP BY
  LEAST(hr.requester_id::text, m.responder_id::text),
  GREATEST(hr.requester_id::text, m.responder_id::text),
  rc.community_id
ON CONFLICT (user_id_a, user_id_b, community_id) DO UPDATE SET
  match_completed_count = EXCLUDED.match_completed_count,
  raw_weight            = EXCLUDED.raw_weight,
  last_interaction_at   = EXCLUDED.last_interaction_at,
  updated_at            = NOW();
