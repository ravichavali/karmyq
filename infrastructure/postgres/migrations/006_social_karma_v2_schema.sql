-- =============================================================================
-- Migration: Social Karma v2.0 - Privacy Controls and Community Health Metrics
-- Version: 6.1.0
-- Date: 2025-01-13
-- =============================================================================

-- =============================================================================
-- 1. REQUEST SERVICE SCHEMA (requests)
-- =============================================================================

-- Add privacy controls to help_requests
ALTER TABLE requests.help_requests
ADD COLUMN IF NOT EXISTS is_public BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS requester_visibility_consent BOOLEAN DEFAULT false;

COMMENT ON COLUMN requests.help_requests.is_public IS 'Whether this request is publicly visible (default: false, private)';
COMMENT ON COLUMN requests.help_requests.requester_visibility_consent IS 'Requester consents to having their name visible in completions';

-- Add privacy controls to help_offers
ALTER TABLE requests.help_offers
ADD COLUMN IF NOT EXISTS is_public BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS offerer_visibility_consent BOOLEAN DEFAULT false;

COMMENT ON COLUMN requests.help_offers.is_public IS 'Whether this offer is publicly visible (default: false, private)';
COMMENT ON COLUMN requests.help_offers.offerer_visibility_consent IS 'Offerer consents to having their name visible in completions';

-- Add privacy and interaction tracking to matches
ALTER TABLE requests.matches
ADD COLUMN IF NOT EXISTS requester_visible BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS responder_visible BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS interaction_category VARCHAR(100);

COMMENT ON COLUMN requests.matches.requester_visible IS 'Both parties consented to show requester name';
COMMENT ON COLUMN requests.matches.responder_visible IS 'Both parties consented to show responder name';
COMMENT ON COLUMN requests.matches.interaction_category IS 'Category copy for metrics (from help_request)';

-- Create interaction_feedback table
CREATE TABLE IF NOT EXISTS requests.interaction_feedback (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    match_id UUID NOT NULL REFERENCES requests.matches(id) ON DELETE CASCADE,
    from_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    to_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

    -- Interaction quality ratings (1-5)
    helpfulness INTEGER CHECK (helpfulness BETWEEN 1 AND 5),
    responsiveness INTEGER CHECK (responsiveness BETWEEN 1 AND 5),
    clarity INTEGER CHECK (clarity BETWEEN 1 AND 5),

    -- Optional comment about the exchange (not the person)
    comment TEXT,

    -- Visibility consent for featuring in stories
    allow_featuring BOOLEAN DEFAULT false,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(match_id, from_user_id)
);

CREATE INDEX IF NOT EXISTS idx_interaction_feedback_match ON requests.interaction_feedback(match_id);
CREATE INDEX IF NOT EXISTS idx_interaction_feedback_to_user ON requests.interaction_feedback(to_user_id);

COMMENT ON TABLE requests.interaction_feedback IS 'Feedback about the interaction/exchange quality, not the person';
COMMENT ON COLUMN requests.interaction_feedback.helpfulness IS 'How helpful was the exchange (1-5)';
COMMENT ON COLUMN requests.interaction_feedback.responsiveness IS 'How responsive was communication (1-5)';
COMMENT ON COLUMN requests.interaction_feedback.clarity IS 'How clear was the communication (1-5)';

-- =============================================================================
-- 2. REPUTATION SERVICE SCHEMA (reputation)
-- =============================================================================

-- Add interaction quality metrics to trust_scores
ALTER TABLE reputation.trust_scores
ADD COLUMN IF NOT EXISTS avg_helpfulness NUMERIC(3,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS avg_responsiveness NUMERIC(3,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS avg_clarity NUMERIC(3,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_feedback_received INTEGER DEFAULT 0;

COMMENT ON COLUMN reputation.trust_scores.avg_helpfulness IS 'Average helpfulness rating from interactions (1-5)';
COMMENT ON COLUMN reputation.trust_scores.avg_responsiveness IS 'Average responsiveness rating (1-5)';
COMMENT ON COLUMN reputation.trust_scores.avg_clarity IS 'Average clarity rating (1-5)';

-- Create community_health_metrics table
CREATE TABLE IF NOT EXISTS reputation.community_health_metrics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    community_id UUID NOT NULL REFERENCES communities.communities(id) ON DELETE CASCADE,

    -- Snapshot date (daily aggregation)
    snapshot_date DATE NOT NULL DEFAULT CURRENT_DATE,

    -- Network strength metrics
    total_matches_completed INTEGER DEFAULT 0,
    total_active_requesters INTEGER DEFAULT 0,
    total_active_helpers INTEGER DEFAULT 0,
    unique_participant_count INTEGER DEFAULT 0,

    -- Interaction quality aggregates (community-wide averages)
    avg_helpfulness NUMERIC(3,2) DEFAULT 0,
    avg_responsiveness NUMERIC(3,2) DEFAULT 0,
    avg_clarity NUMERIC(3,2) DEFAULT 0,

    -- Network density (connections per member)
    network_density NUMERIC(5,4) DEFAULT 0,

    -- Growth metrics (vs previous period)
    growth_rate_matches NUMERIC(5,2) DEFAULT 0,
    growth_rate_participants NUMERIC(5,2) DEFAULT 0,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(community_id, snapshot_date)
);

CREATE INDEX IF NOT EXISTS idx_health_metrics_community ON reputation.community_health_metrics(community_id);
CREATE INDEX IF NOT EXISTS idx_health_metrics_date ON reputation.community_health_metrics(snapshot_date);

COMMENT ON TABLE reputation.community_health_metrics IS 'Community-level health metrics tracked daily';
COMMENT ON COLUMN reputation.community_health_metrics.network_density IS 'Average connections per member';
COMMENT ON COLUMN reputation.community_health_metrics.growth_rate_matches IS 'Percentage growth in matches vs previous period';

-- Create milestone_events table
CREATE TABLE IF NOT EXISTS reputation.milestone_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    community_id UUID NOT NULL REFERENCES communities.communities(id) ON DELETE CASCADE,

    -- Milestone type
    milestone_type VARCHAR(100) NOT NULL,
    milestone_value INTEGER NOT NULL,
    description TEXT NOT NULL,

    -- Privacy control
    is_featured BOOLEAN DEFAULT true,

    achieved_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_milestone_events_community ON reputation.milestone_events(community_id);
CREATE INDEX IF NOT EXISTS idx_milestone_events_type ON reputation.milestone_events(milestone_type);

COMMENT ON TABLE reputation.milestone_events IS 'Community milestone achievements for celebrating collective progress';
COMMENT ON COLUMN reputation.milestone_events.is_featured IS 'Whether to feature this milestone in public stories';

-- =============================================================================
-- 3. FEED SERVICE SCHEMA (feed)
-- =============================================================================

-- Add new privacy and metrics preferences
ALTER TABLE feed.preferences
ADD COLUMN IF NOT EXISTS show_community_metrics BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS show_milestone_celebrations BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS show_anonymous_stories BOOLEAN DEFAULT true;

COMMENT ON COLUMN feed.preferences.show_community_metrics IS 'Show community health metrics in feed';
COMMENT ON COLUMN feed.preferences.show_milestone_celebrations IS 'Show community milestone achievements';
COMMENT ON COLUMN feed.preferences.show_anonymous_stories IS 'Show anonymous completed exchange stories';

-- Create featured_stories table
CREATE TABLE IF NOT EXISTS feed.featured_stories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    community_id UUID NOT NULL REFERENCES communities.communities(id) ON DELETE CASCADE,

    -- Story type
    story_type VARCHAR(50) NOT NULL,

    -- Story content
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,

    -- Referenced entities (nullable depending on story type)
    match_id UUID REFERENCES requests.matches(id) ON DELETE CASCADE,
    category VARCHAR(100),

    -- Privacy controls
    is_anonymous BOOLEAN DEFAULT true,
    requester_name VARCHAR(255),
    responder_name VARCHAR(255),

    -- Featuring controls
    is_public BOOLEAN DEFAULT false,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_featured_stories_community ON feed.featured_stories(community_id);
CREATE INDEX IF NOT EXISTS idx_featured_stories_type ON feed.featured_stories(story_type);
CREATE INDEX IF NOT EXISTS idx_featured_stories_created ON feed.featured_stories(created_at);

COMMENT ON TABLE feed.featured_stories IS 'Curated stories about interactions for feed and celebration';
COMMENT ON COLUMN feed.featured_stories.is_anonymous IS 'Whether names are shown (requires two-way consent)';

-- =============================================================================
-- 4. COMMUNITY SERVICE SCHEMA (communities)
-- =============================================================================

-- Create health_summary table
CREATE TABLE IF NOT EXISTS communities.health_summary (
    community_id UUID PRIMARY KEY REFERENCES communities.communities(id) ON DELETE CASCADE,

    -- Latest metrics (from reputation.community_health_metrics)
    total_exchanges INTEGER DEFAULT 0,
    active_members INTEGER DEFAULT 0,
    network_strength NUMERIC(5,2) DEFAULT 0,

    -- Trend indicators (7-day vs previous 7-day)
    trend_direction VARCHAR(20) DEFAULT 'stable',
    trend_percentage NUMERIC(5,2) DEFAULT 0,

    -- Last updated
    last_calculated TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE communities.health_summary IS 'Cached summary of community health for quick access';
COMMENT ON COLUMN communities.health_summary.network_strength IS 'Composite score: activity + quality + density';

-- =============================================================================
-- 5. DATA BACKFILL
-- =============================================================================

-- Set existing requests/offers to private by default (already done via DEFAULT false)
-- No backfill needed since columns have DEFAULT false

-- Initialize health_summary for all active communities
INSERT INTO communities.health_summary (community_id, total_exchanges, active_members, network_strength, trend_direction, trend_percentage)
SELECT
    c.id,
    0,
    c.current_members,
    0,
    'stable',
    0
FROM communities.communities c
WHERE c.status = 'active'
ON CONFLICT (community_id) DO NOTHING;

-- =============================================================================
-- Migration Complete
-- =============================================================================

SELECT 'Social Karma v2.0 schema migration completed successfully!' as status;
