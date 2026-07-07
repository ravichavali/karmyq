-- Migration 009: Social Graph & Trust Paths
-- Purpose: Add invitation tracking and social distance computation tables
-- Version: v9.1.0
-- Created: 2025-12-27

BEGIN;

-- ============================================================================
-- PART 1: User Invitations Table
-- ============================================================================
-- Track who invited whom, forming the social graph

CREATE TABLE IF NOT EXISTS auth.user_invitations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    inviter_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    invitee_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    invited_at TIMESTAMP NOT NULL DEFAULT NOW(),
    invitation_code TEXT UNIQUE NOT NULL,
    invitation_accepted_at TIMESTAMP,
    community_id UUID NOT NULL REFERENCES communities.communities(id) ON DELETE CASCADE,

    -- Metadata
    invitation_method VARCHAR(50) DEFAULT 'link', -- 'email', 'sms', 'link', 'qr_code'
    inviter_note TEXT, -- Optional message from inviter

    -- Constraints
    CONSTRAINT unique_invitation_per_community UNIQUE(inviter_id, invitee_id, community_id),
    CONSTRAINT no_self_invitation CHECK (inviter_id != invitee_id),
    CONSTRAINT invitation_code_format CHECK (invitation_code ~ '^KARMYQ-[A-Z0-9]+-[0-9]{4}-[A-Z0-9]{4}$')
);

-- Indexes for efficient graph traversal
CREATE INDEX idx_invitations_inviter ON auth.user_invitations(inviter_id);
CREATE INDEX idx_invitations_invitee ON auth.user_invitations(invitee_id);
CREATE INDEX idx_invitations_community ON auth.user_invitations(community_id);
CREATE INDEX idx_invitations_accepted ON auth.user_invitations(invitation_accepted_at) WHERE invitation_accepted_at IS NOT NULL;
CREATE INDEX idx_invitations_code ON auth.user_invitations(invitation_code);

-- Graph traversal index (adjacency list)
CREATE INDEX idx_invitations_graph ON auth.user_invitations(inviter_id, invitee_id) WHERE invitation_accepted_at IS NOT NULL;

-- ============================================================================
-- PART 2: Precomputed Social Distances (Performance Cache)
-- ============================================================================
-- Cache of shortest paths between users to avoid expensive BFS queries

CREATE TABLE IF NOT EXISTS auth.social_distances (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_a_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    user_b_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    community_id UUID NOT NULL REFERENCES communities.communities(id) ON DELETE CASCADE,

    -- Path information
    degrees_of_separation INTEGER NOT NULL CHECK (degrees_of_separation >= 1 AND degrees_of_separation <= 4),
    shortest_path JSONB NOT NULL, -- Array of user IDs: ["user_a", "intermediary_1", ..., "user_b"]
    highest_trust_path JSONB, -- Alternative path with highest total karma
    path_trust_score INTEGER, -- Sum of karma scores along highest_trust_path

    -- Cache metadata
    computed_at TIMESTAMP NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMP NOT NULL DEFAULT NOW() + INTERVAL '7 days',

    -- Constraints
    CONSTRAINT unique_user_pair_per_community UNIQUE(user_a_id, user_b_id, community_id),
    CONSTRAINT no_self_distance CHECK (user_a_id != user_b_id)
);

-- Indexes for fast lookups
CREATE INDEX idx_social_distances_user_a ON auth.social_distances(user_a_id);
CREATE INDEX idx_social_distances_user_b ON auth.social_distances(user_b_id);
CREATE INDEX idx_social_distances_community ON auth.social_distances(community_id);
CREATE INDEX idx_social_distances_degrees ON auth.social_distances(degrees_of_separation);
CREATE INDEX idx_social_distances_expires ON auth.social_distances(expires_at);

-- Composite index for common query pattern (without volatile function in predicate)
CREATE INDEX idx_social_distances_lookup ON auth.social_distances(user_a_id, user_b_id, community_id);

-- ============================================================================
-- PART 3: Inviter Statistics (Gamification)
-- ============================================================================
-- Track invitation quality and network building metrics

CREATE TABLE IF NOT EXISTS auth.inviter_stats (
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    community_id UUID NOT NULL REFERENCES communities.communities(id) ON DELETE CASCADE,

    -- Invitation metrics
    total_invitations_sent INTEGER DEFAULT 0,
    total_invitations_accepted INTEGER DEFAULT 0,
    acceptance_rate DECIMAL(5,2) DEFAULT 0.00, -- Percentage (0-100)

    -- Invitee quality metrics
    avg_invitee_karma DECIMAL(5,2) DEFAULT 0.00,
    avg_invitee_trust_score DECIMAL(5,2) DEFAULT 0.00,
    total_invitee_exchanges INTEGER DEFAULT 0, -- Sum of all exchanges by invitees

    -- Network impact
    total_network_size INTEGER DEFAULT 0, -- Total people reachable within 3 degrees
    bridge_score INTEGER DEFAULT 0, -- How many disconnected communities this user connects

    -- Quality tier
    inviter_tier VARCHAR(20) DEFAULT 'bronze', -- 'bronze', 'silver', 'gold', 'platinum'
    tier_updated_at TIMESTAMP DEFAULT NOW(),

    -- Computed metadata
    last_computed TIMESTAMP DEFAULT NOW(),

    -- Constraints
    PRIMARY KEY (user_id, community_id),
    CONSTRAINT valid_tier CHECK (inviter_tier IN ('bronze', 'silver', 'gold', 'platinum'))
);

-- Indexes for leaderboards and analytics
CREATE INDEX idx_inviter_stats_tier ON auth.inviter_stats(inviter_tier);
CREATE INDEX idx_inviter_stats_community ON auth.inviter_stats(community_id);
CREATE INDEX idx_inviter_stats_avg_karma ON auth.inviter_stats(avg_invitee_karma DESC);
CREATE INDEX idx_inviter_stats_network_size ON auth.inviter_stats(total_network_size DESC);

-- ============================================================================
-- PART 4: User Table Updates
-- ============================================================================
-- Add invitation tracking columns and privacy settings to users table

-- Invitation tracking
ALTER TABLE auth.users
    ADD COLUMN IF NOT EXISTS invited_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE auth.users
    ADD COLUMN IF NOT EXISTS invitation_accepted_at TIMESTAMP;

-- Privacy settings for social graph visibility
ALTER TABLE auth.users
    ADD COLUMN IF NOT EXISTS show_connection_path BOOLEAN DEFAULT true;

ALTER TABLE auth.users
    ADD COLUMN IF NOT EXISTS show_who_invited_me BOOLEAN DEFAULT true;

ALTER TABLE auth.users
    ADD COLUMN IF NOT EXISTS show_who_i_invited BOOLEAN DEFAULT false;

-- Index for graph traversal
CREATE INDEX IF NOT EXISTS idx_users_invited_by ON auth.users(invited_by) WHERE invited_by IS NOT NULL;

-- ============================================================================
-- PART 5: Row-Level Security (RLS) Policies
-- ============================================================================

-- Enable RLS on new tables
ALTER TABLE auth.user_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE auth.social_distances ENABLE ROW LEVEL SECURITY;
ALTER TABLE auth.inviter_stats ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view invitations in their communities
CREATE POLICY invitations_select_policy ON auth.user_invitations
    FOR SELECT
    USING (
        community_id IN (
            SELECT community_id
            FROM communities.members
            WHERE user_id = current_setting('app.current_user_id')::UUID
        )
    );

-- Policy: Users can insert invitations they send
CREATE POLICY invitations_insert_policy ON auth.user_invitations
    FOR INSERT
    WITH CHECK (
        inviter_id = current_setting('app.current_user_id')::UUID
        AND community_id IN (
            SELECT community_id
            FROM communities.members
            WHERE user_id = current_setting('app.current_user_id')::UUID
        )
    );

-- Policy: Users can view social distances in their communities
CREATE POLICY social_distances_select_policy ON auth.social_distances
    FOR SELECT
    USING (
        community_id IN (
            SELECT community_id
            FROM communities.members
            WHERE user_id = current_setting('app.current_user_id')::UUID
        )
        AND (
            user_a_id = current_setting('app.current_user_id')::UUID
            OR user_b_id = current_setting('app.current_user_id')::UUID
        )
    );

-- Policy: Only system can insert/update social distances (background jobs)
-- Users cannot directly manipulate path computations
CREATE POLICY social_distances_system_only ON auth.social_distances
    FOR ALL
    USING (false); -- Block all user operations, only system role can modify

-- Policy: Users can view their own inviter stats
CREATE POLICY inviter_stats_select_policy ON auth.inviter_stats
    FOR SELECT
    USING (
        user_id = current_setting('app.current_user_id')::UUID
        OR community_id IN (
            SELECT community_id
            FROM communities.members
            WHERE user_id = current_setting('app.current_user_id')::UUID
        )
    );

-- ============================================================================
-- PART 6: Helper Functions
-- ============================================================================

-- Function to generate invitation codes. DROP first: a stale init.sql snapshot independently
-- defines the same (TEXT, INTEGER) overload as auth.generate_invitation_code(user_name, year), and
-- Postgres's CREATE OR REPLACE refuses to rename parameters on an existing signature. That stale
-- version also only strips spaces (not all punctuation) from the name, so a name with an apostrophe
-- or hyphen could violate the invitation_code_format CHECK — the DROP+CREATE here converges to this
-- migration's REGEXP_REPLACE version regardless of which definition was already present.
DROP FUNCTION IF EXISTS auth.generate_invitation_code(TEXT, INTEGER);
CREATE OR REPLACE FUNCTION auth.generate_invitation_code(
    p_inviter_name TEXT,
    p_year INTEGER DEFAULT EXTRACT(YEAR FROM NOW())::INTEGER
)
RETURNS TEXT AS $$
DECLARE
    v_code TEXT;
    v_random_suffix TEXT;
    v_exists BOOLEAN;
BEGIN
    -- Generate random 4-character alphanumeric suffix
    LOOP
        v_random_suffix := UPPER(SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 4));
        v_code := FORMAT('KARMYQ-%s-%s-%s',
            UPPER(REGEXP_REPLACE(p_inviter_name, '[^A-Za-z0-9]', '', 'g')),
            p_year,
            v_random_suffix
        );

        -- Check if code already exists
        SELECT EXISTS(SELECT 1 FROM auth.user_invitations WHERE invitation_code = v_code) INTO v_exists;

        EXIT WHEN NOT v_exists;
    END LOOP;

    RETURN v_code;
END;
$$ LANGUAGE plpgsql;

-- Function to compute inviter tier based on metrics
CREATE OR REPLACE FUNCTION auth.compute_inviter_tier(
    p_avg_karma DECIMAL,
    p_total_accepted INTEGER,
    p_acceptance_rate DECIMAL
)
RETURNS VARCHAR(20) AS $$
BEGIN
    -- Platinum: 10+ accepted invitations, 80+ avg karma, 70%+ acceptance rate
    IF p_total_accepted >= 10 AND p_avg_karma >= 80 AND p_acceptance_rate >= 70 THEN
        RETURN 'platinum';

    -- Gold: 5+ accepted, 70+ avg karma, 60%+ acceptance
    ELSIF p_total_accepted >= 5 AND p_avg_karma >= 70 AND p_acceptance_rate >= 60 THEN
        RETURN 'gold';

    -- Silver: 3+ accepted, 60+ avg karma, 50%+ acceptance
    ELSIF p_total_accepted >= 3 AND p_avg_karma >= 60 AND p_acceptance_rate >= 50 THEN
        RETURN 'silver';

    -- Bronze: default
    ELSE
        RETURN 'bronze';
    END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Trigger function to update inviter stats when invitation is accepted
CREATE OR REPLACE FUNCTION auth.update_inviter_stats_on_acceptance()
RETURNS TRIGGER AS $$
BEGIN
    -- Only run when invitation_accepted_at changes from NULL to a timestamp
    IF OLD.invitation_accepted_at IS NULL AND NEW.invitation_accepted_at IS NOT NULL THEN
        INSERT INTO auth.inviter_stats (user_id, community_id, total_invitations_accepted)
        VALUES (NEW.inviter_id, NEW.community_id, 1)
        ON CONFLICT (user_id, community_id) DO UPDATE
        SET
            total_invitations_accepted = auth.inviter_stats.total_invitations_accepted + 1,
            acceptance_rate = (
                (auth.inviter_stats.total_invitations_accepted + 1.0) /
                NULLIF(auth.inviter_stats.total_invitations_sent, 0) * 100
            ),
            last_computed = NOW();
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Attach trigger to user_invitations table
CREATE TRIGGER trigger_update_inviter_stats_on_acceptance
    AFTER UPDATE ON auth.user_invitations
    FOR EACH ROW
    EXECUTE FUNCTION auth.update_inviter_stats_on_acceptance();

-- ============================================================================
-- PART 7: Cleanup Job for Expired Social Distances
-- ============================================================================

-- Function to clean up expired social distance cache entries
CREATE OR REPLACE FUNCTION auth.cleanup_expired_social_distances()
RETURNS INTEGER AS $$
DECLARE
    v_deleted_count INTEGER;
BEGIN
    DELETE FROM auth.social_distances
    WHERE expires_at < NOW();

    GET DIAGNOSTICS v_deleted_count = ROW_COUNT;

    RETURN v_deleted_count;
END;
$$ LANGUAGE plpgsql;

COMMIT;

-- ============================================================================
-- MIGRATION NOTES
-- ============================================================================
--
-- This migration adds:
-- 1. user_invitations table - tracks who invited whom
-- 2. social_distances table - precomputed shortest paths (7-day cache)
-- 3. inviter_stats table - gamification and quality metrics
-- 4. Privacy columns on users table - control visibility of social graph
-- 5. RLS policies - ensure users only see paths in their communities
-- 6. Helper functions - invitation code generation, tier computation
-- 7. Triggers - auto-update inviter stats on invitation acceptance
--
-- To apply this migration:
--   cat infrastructure/postgres/migrations/009_social_graph.sql | docker exec -i karmyq-postgres psql -U karmyq_user -d karmyq_db
--
-- To rollback (if needed):
--   DROP TABLE IF EXISTS auth.social_distances CASCADE;
--   DROP TABLE IF EXISTS auth.inviter_stats CASCADE;
--   DROP TABLE IF EXISTS auth.user_invitations CASCADE;
--   ALTER TABLE auth.users DROP COLUMN IF EXISTS invited_by;
--   ALTER TABLE auth.users DROP COLUMN IF EXISTS invitation_accepted_at;
--   ALTER TABLE auth.users DROP COLUMN IF EXISTS show_connection_path;
--   ALTER TABLE auth.users DROP COLUMN IF EXISTS show_who_invited_me;
--   ALTER TABLE auth.users DROP COLUMN IF EXISTS show_who_i_invited;
--
-- ============================================================================
