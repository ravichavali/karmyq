-- Migration 014: Multi-Tier Visibility (ADR-022 / ADR-031 Phase 4)
-- Adds visibility scope to requests and feed preferences to users
-- Three tiers: community (default), trust_network, platform

-- ============= VISIBILITY SCOPE ENUM =============

CREATE TYPE visibility_scope_enum AS ENUM ('community', 'trust_network', 'platform');

-- ============= REQUEST VISIBILITY =============

-- Add visibility columns to help_requests
ALTER TABLE requests.help_requests
ADD COLUMN visibility_scope visibility_scope_enum NOT NULL DEFAULT 'community';

ALTER TABLE requests.help_requests
ADD COLUMN visibility_max_degrees INTEGER DEFAULT 3
  CHECK (visibility_max_degrees BETWEEN 1 AND 6);

-- Index for efficient tier-based feed queries
CREATE INDEX idx_requests_visibility ON requests.help_requests(visibility_scope)
  WHERE status = 'open' AND expired = FALSE;

-- ============= USER FEED PREFERENCES =============

-- Store user feed preferences for multi-tier visibility
-- Separate table since auth.user_request_preferences is per-type subscriptions
CREATE TABLE IF NOT EXISTS auth.user_feed_preferences (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    feed_show_trust_network BOOLEAN DEFAULT true,
    feed_trust_network_max_degrees INTEGER DEFAULT 3
      CHECK (feed_trust_network_max_degrees BETWEEN 1 AND 6),
    feed_show_platform BOOLEAN DEFAULT false,  -- Opt-in to explore
    feed_platform_categories JSONB DEFAULT '["digital", "questions"]'::jsonb,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_user_feed_prefs_user ON auth.user_feed_preferences(user_id);

-- ============= COMMUNITY DEFAULT SCOPE =============

-- Communities can set a default visibility scope for new requests
ALTER TABLE communities.communities
ADD COLUMN default_request_scope visibility_scope_enum DEFAULT 'community';

-- ============= BACKFILL =============

-- All existing requests default to 'community' (safe — no visibility change)
-- The DEFAULT on the column handles this, but let's be explicit:
UPDATE requests.help_requests
SET visibility_scope = 'community', visibility_max_degrees = 3
WHERE visibility_scope IS NULL;

-- Create default feed preferences for existing users
INSERT INTO auth.user_feed_preferences (user_id)
SELECT id FROM auth.users
ON CONFLICT (user_id) DO NOTHING;

-- ============= COMMENTS =============

COMMENT ON COLUMN requests.help_requests.visibility_scope IS 'Who can see this request: community (members only), trust_network (N-degree connections), platform (all opted-in users)';
COMMENT ON COLUMN requests.help_requests.visibility_max_degrees IS 'For trust_network scope: max degrees of separation (1-6). Ignored for community/platform scope.';
COMMENT ON TABLE auth.user_feed_preferences IS 'User preferences for multi-tier feed visibility (ADR-022)';
COMMENT ON COLUMN auth.user_feed_preferences.feed_show_trust_network IS 'Whether to show requests from trust network (beyond own communities)';
COMMENT ON COLUMN auth.user_feed_preferences.feed_show_platform IS 'Whether to show platform-wide requests (opt-in explore mode)';
COMMENT ON COLUMN communities.communities.default_request_scope IS 'Default visibility scope for new requests created in this community';
