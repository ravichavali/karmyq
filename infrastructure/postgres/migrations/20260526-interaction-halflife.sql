-- 20260526-interaction-halflife.sql
-- Sprint 68: Interaction Half-Life
-- Adds intrinsic Ebbinghaus decay to trust edges via a live view.

-- 1. Add stability column to trust_edges (existing rows default to 1.0)
ALTER TABLE social_graph.trust_edges
  ADD COLUMN IF NOT EXISTS stability FLOAT NOT NULL DEFAULT 1.0;

-- 2. Decay config table — tunable per community
CREATE TABLE IF NOT EXISTS social_graph.trust_decay_config (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id            UUID REFERENCES communities.communities(id) ON DELETE CASCADE,
  base_half_life_days     FLOAT NOT NULL DEFAULT 30.0,
  stability_growth_rate   FLOAT NOT NULL DEFAULT 0.20,
  disappearance_threshold FLOAT NOT NULL DEFAULT 0.5,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(community_id)
);

-- Global default row (community_id = NULL)
INSERT INTO social_graph.trust_decay_config
  (community_id, base_half_life_days, stability_growth_rate, disappearance_threshold)
VALUES (NULL, 30.0, 0.20, 0.5)
ON CONFLICT DO NOTHING;

-- 3. Live view: current_weight computed at every read
-- Formula: current_weight = raw_weight × e^(-days_since_last_interaction / (stability × half_life))
CREATE OR REPLACE VIEW social_graph.trust_edges_live AS
SELECT
  te.*,
  te.raw_weight * EXP(
    -EXTRACT(EPOCH FROM (NOW() - te.last_interaction_at)) / 86400.0
    / (te.stability * COALESCE(
        (SELECT base_half_life_days FROM social_graph.trust_decay_config
         WHERE community_id = te.community_id LIMIT 1),
        (SELECT base_half_life_days FROM social_graph.trust_decay_config
         WHERE community_id IS NULL LIMIT 1),
        30.0
      ))
  ) AS current_weight
FROM social_graph.trust_edges te;
