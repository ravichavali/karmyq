-- Migration 021: Community Trust Scores
-- ADR-040: Community Trust Score — bonding/bridging formula with configurable weights
-- Community trust reflects both internal cohesion (bonding) and external reach (bridging)

-- New table to store computed community trust scores
CREATE TABLE IF NOT EXISTS reputation.community_trust_scores (
  community_id UUID PRIMARY KEY REFERENCES communities.communities(id) ON DELETE CASCADE,
  score INTEGER DEFAULT 0 CHECK (score BETWEEN 0 AND 100),
  member_quality_score INTEGER DEFAULT 0,
  bonding_score INTEGER DEFAULT 0,
  bridging_score INTEGER DEFAULT 0,
  active_member_count INTEGER DEFAULT 0,
  last_calculated TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Community config: bonding vs bridging weight (parallel to individual trust depth/breadth weights)
ALTER TABLE communities.community_configs
  ADD COLUMN IF NOT EXISTS community_trust_bonding_weight NUMERIC(3,2) DEFAULT 0.60
    CHECK (community_trust_bonding_weight BETWEEN 0.0 AND 1.0),
  ADD COLUMN IF NOT EXISTS community_trust_bridging_weight NUMERIC(3,2) DEFAULT 0.40
    CHECK (community_trust_bridging_weight BETWEEN 0.0 AND 1.0);
