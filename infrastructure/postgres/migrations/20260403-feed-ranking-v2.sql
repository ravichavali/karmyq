-- 20260403-feed-ranking-v2.sql
-- Sprint 43: Extend feed scoring weights + add feed_events table

BEGIN;

-- 1. Drop the old weight-sum constraint FIRST (before column additions or updates).
--    The actual constraint name on the demo server is 'feed_weights_sum';
--    try all known names in case of schema drift across environments.
ALTER TABLE communities.community_configs
  DROP CONSTRAINT IF EXISTS feed_weights_sum,
  DROP CONSTRAINT IF EXISTS community_configs_feed_weights_sum_check,
  DROP CONSTRAINT IF EXISTS chk_feed_weights_sum;

-- 2. Add new weight columns (after dropping the constraint so DEFAULT 0 doesn't fail it)
ALTER TABLE communities.community_configs
  ADD COLUMN IF NOT EXISTS feed_weight_requester_trust   DECIMAL(3,2) NOT NULL DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS feed_weight_prior_interaction DECIMAL(3,2) NOT NULL DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS feed_weight_recency           DECIMAL(3,2) NOT NULL DEFAULT 0.00;

-- 3. Redistribute all existing rows to new 7-signal defaults (sum = 1.00)
UPDATE communities.community_configs SET
  feed_weight_skill_match         = 0.25,
  feed_weight_trust_distance      = 0.20,
  feed_weight_community_relevance = 0.15,
  feed_weight_urgency             = 0.10,
  feed_weight_requester_trust     = 0.15,
  feed_weight_prior_interaction   = 0.10,
  feed_weight_recency             = 0.05;

-- 4. Create feed_events table
CREATE TABLE IF NOT EXISTS requests.feed_events (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  request_id    UUID NOT NULL REFERENCES requests.help_requests(id) ON DELETE CASCADE,
  event_type    TEXT NOT NULL CHECK (event_type IN ('impression', 'offer_made', 'match_completed')),
  feed_score    NUMERIC(5,2),
  feed_rank     INTEGER,
  source_tier   TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_feed_events_user
  ON requests.feed_events(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_feed_events_request
  ON requests.feed_events(request_id, event_type);
CREATE INDEX IF NOT EXISTS idx_feed_events_type_date
  ON requests.feed_events(event_type, created_at DESC);

COMMIT;
