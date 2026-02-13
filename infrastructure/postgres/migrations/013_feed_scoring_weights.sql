-- Migration 013: Feed Scoring Weights
-- Phase 2 of ADR-031: Community-configurable feed scoring weights
--
-- Adds four weight columns to community_configs that control how the curated feed
-- ranks requests. Each weight is 0.00-1.00 and they must sum to 1.0.
--
-- Defaults: skill_match=0.40, trust_distance=0.25, community_relevance=0.20, urgency=0.15

-- Add feed weight columns
ALTER TABLE communities.community_configs
  ADD COLUMN feed_weight_skill_match DECIMAL(3,2) DEFAULT 0.40
    CHECK (feed_weight_skill_match BETWEEN 0.0 AND 1.0),
  ADD COLUMN feed_weight_trust_distance DECIMAL(3,2) DEFAULT 0.25
    CHECK (feed_weight_trust_distance BETWEEN 0.0 AND 1.0),
  ADD COLUMN feed_weight_community_relevance DECIMAL(3,2) DEFAULT 0.20
    CHECK (feed_weight_community_relevance BETWEEN 0.0 AND 1.0),
  ADD COLUMN feed_weight_urgency DECIMAL(3,2) DEFAULT 0.15
    CHECK (feed_weight_urgency BETWEEN 0.0 AND 1.0);

-- Constraint: feed weights must sum to 1.0
ALTER TABLE communities.community_configs
  ADD CONSTRAINT feed_weights_sum CHECK (
    ABS((feed_weight_skill_match + feed_weight_trust_distance + feed_weight_community_relevance + feed_weight_urgency) - 1.0) < 0.01
  );

COMMENT ON COLUMN communities.community_configs.feed_weight_skill_match IS 'Weight for skill-based matching in feed scoring (0.0-1.0)';
COMMENT ON COLUMN communities.community_configs.feed_weight_trust_distance IS 'Weight for trust distance in feed scoring (0.0-1.0)';
COMMENT ON COLUMN communities.community_configs.feed_weight_community_relevance IS 'Weight for community type relevance in feed scoring (0.0-1.0)';
COMMENT ON COLUMN communities.community_configs.feed_weight_urgency IS 'Weight for urgency in feed scoring (0.0-1.0)';

-- Update seed templates to include feed weights
UPDATE communities.config_templates
SET config_json = config_json ||
  '{"feed_weight_skill_match": 0.40, "feed_weight_trust_distance": 0.25, "feed_weight_community_relevance": 0.20, "feed_weight_urgency": 0.15}'::jsonb
WHERE name = 'Cohousing Default';

-- Neighborhood Cautious: higher trust weight (trust-building focused)
UPDATE communities.config_templates
SET config_json = config_json ||
  '{"feed_weight_skill_match": 0.30, "feed_weight_trust_distance": 0.35, "feed_weight_community_relevance": 0.20, "feed_weight_urgency": 0.15}'::jsonb
WHERE name = 'Neighborhood Cautious';

-- Experimental Reciprocal: higher community relevance (experimental)
UPDATE communities.config_templates
SET config_json = config_json ||
  '{"feed_weight_skill_match": 0.35, "feed_weight_trust_distance": 0.20, "feed_weight_community_relevance": 0.30, "feed_weight_urgency": 0.15}'::jsonb
WHERE name = 'Experimental Reciprocal';

-- ============= MIGRATION COMPLETE =============
-- To rollback:
-- ALTER TABLE communities.community_configs DROP CONSTRAINT IF EXISTS feed_weights_sum;
-- ALTER TABLE communities.community_configs
--   DROP COLUMN IF EXISTS feed_weight_skill_match,
--   DROP COLUMN IF EXISTS feed_weight_trust_distance,
--   DROP COLUMN IF EXISTS feed_weight_community_relevance,
--   DROP COLUMN IF EXISTS feed_weight_urgency;
