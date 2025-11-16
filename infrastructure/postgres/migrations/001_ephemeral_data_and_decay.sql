-- Migration: Ephemeral Data & Reputation Decay (v5.1.0)
-- Adds TTL support and reputation decay functionality

-- ============= COMMUNITY SETTINGS TABLE =============
-- Store per-community configuration for TTLs and decay parameters
CREATE TABLE IF NOT EXISTS communities.settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    community_id UUID NOT NULL UNIQUE REFERENCES communities.communities(id) ON DELETE CASCADE,

    -- TTL Settings (in days)
    request_ttl_days INTEGER DEFAULT 60,
    offer_ttl_days INTEGER DEFAULT 60,
    message_ttl_days INTEGER DEFAULT 60,
    notification_ttl_days INTEGER DEFAULT 60,

    -- Reputation Decay Settings
    reputation_half_life_months INTEGER DEFAULT 6,

    -- Activity Types that reset decay (JSONB array)
    -- Default: ["complete_request", "complete_offer"]
    activity_types JSONB DEFAULT '["complete_request", "complete_offer"]'::JSONB,

    -- Metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_community_settings_community_id ON communities.settings(community_id);

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION communities.update_settings_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER settings_updated_at
    BEFORE UPDATE ON communities.settings
    FOR EACH ROW
    EXECUTE FUNCTION communities.update_settings_timestamp();

-- ============= ADD EXPIRES_AT COLUMNS =============

-- Help Requests
ALTER TABLE requests.help_requests
ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS expired BOOLEAN DEFAULT FALSE;

CREATE INDEX idx_help_requests_expires_at ON requests.help_requests(expires_at) WHERE expired = FALSE;
CREATE INDEX idx_help_requests_expired ON requests.help_requests(expired);

-- Help Offers
ALTER TABLE requests.help_offers
ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS expired BOOLEAN DEFAULT FALSE;

CREATE INDEX idx_help_offers_expires_at ON requests.help_offers(expires_at) WHERE expired = FALSE;
CREATE INDEX idx_help_offers_expired ON requests.help_offers(expired);

-- Messages
ALTER TABLE messaging.messages
ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS expired BOOLEAN DEFAULT FALSE;

CREATE INDEX idx_messages_expires_at ON messaging.messages(expires_at) WHERE expired = FALSE;
CREATE INDEX idx_messages_expired ON messaging.messages(expired);

-- Notifications
ALTER TABLE notifications.notifications
ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS expired BOOLEAN DEFAULT FALSE;

CREATE INDEX idx_notifications_expires_at ON notifications.notifications(expires_at) WHERE expired = FALSE;
CREATE INDEX idx_notifications_expired ON notifications.notifications(expired);

-- ============= ADD ACTIVITY TRACKING =============

-- Add last_activity_at to trust_scores for decay calculation
ALTER TABLE reputation.trust_scores
ADD COLUMN IF NOT EXISTS last_activity_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

CREATE INDEX idx_trust_scores_last_activity ON reputation.trust_scores(last_activity_at);

-- ============= ACTIVITY LOG TABLE =============
-- Track user activities for reputation decay
CREATE TABLE IF NOT EXISTS reputation.activity_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    community_id UUID NOT NULL REFERENCES communities.communities(id) ON DELETE CASCADE,
    activity_type VARCHAR(100) NOT NULL,
    related_entity_id UUID,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_activity_log_user_community ON reputation.activity_log(user_id, community_id);
CREATE INDEX idx_activity_log_created_at ON reputation.activity_log(created_at DESC);
CREATE INDEX idx_activity_log_type ON reputation.activity_log(activity_type);

-- ============= FUNCTIONS FOR AUTOMATIC EXPIRATION =============

-- Function to calculate expires_at based on community settings
CREATE OR REPLACE FUNCTION communities.calculate_expires_at(
    p_community_id UUID,
    p_entity_type VARCHAR,
    p_created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
)
RETURNS TIMESTAMP AS $$
DECLARE
    v_ttl_days INTEGER;
BEGIN
    -- Get TTL for entity type from community settings
    SELECT
        CASE p_entity_type
            WHEN 'request' THEN request_ttl_days
            WHEN 'offer' THEN offer_ttl_days
            WHEN 'message' THEN message_ttl_days
            WHEN 'notification' THEN notification_ttl_days
            ELSE 60 -- Default
        END
    INTO v_ttl_days
    FROM communities.settings
    WHERE community_id = p_community_id;

    -- If no settings found, use default 60 days
    IF v_ttl_days IS NULL THEN
        v_ttl_days := 60;
    END IF;

    -- Calculate expiration timestamp
    RETURN p_created_at + (v_ttl_days || ' days')::INTERVAL;
END;
$$ LANGUAGE plpgsql;

-- Function to set expires_at on new help requests
CREATE OR REPLACE FUNCTION requests.set_request_expires_at()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.expires_at IS NULL THEN
        NEW.expires_at := communities.calculate_expires_at(NEW.community_id, 'request', NEW.created_at);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to set expires_at on new help offers
CREATE OR REPLACE FUNCTION requests.set_offer_expires_at()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.expires_at IS NULL THEN
        NEW.expires_at := communities.calculate_expires_at(NEW.community_id, 'offer', NEW.created_at);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to set expires_at on new messages
CREATE OR REPLACE FUNCTION messaging.set_message_expires_at()
RETURNS TRIGGER AS $$
DECLARE
    v_community_id UUID;
BEGIN
    -- Get community_id from conversation's match
    SELECT c.community_id INTO v_community_id
    FROM messaging.conversations conv
    JOIN requests.matches m ON conv.request_match_id = m.id
    JOIN requests.help_requests r ON m.request_id = r.id
    WHERE conv.id = NEW.conversation_id;

    IF v_community_id IS NOT NULL AND NEW.expires_at IS NULL THEN
        NEW.expires_at := communities.calculate_expires_at(v_community_id, 'message', NEW.created_at);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to set expires_at on new notifications
CREATE OR REPLACE FUNCTION notifications.set_notification_expires_at()
RETURNS TRIGGER AS $$
DECLARE
    v_community_id UUID;
BEGIN
    -- Extract community_id from data JSONB if exists
    v_community_id := (NEW.data->>'community_id')::UUID;

    IF v_community_id IS NOT NULL AND NEW.expires_at IS NULL THEN
        NEW.expires_at := communities.calculate_expires_at(v_community_id, 'notification', NEW.created_at);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============= CREATE TRIGGERS =============

DROP TRIGGER IF EXISTS trigger_set_request_expires_at ON requests.help_requests;
CREATE TRIGGER trigger_set_request_expires_at
    BEFORE INSERT ON requests.help_requests
    FOR EACH ROW
    EXECUTE FUNCTION requests.set_request_expires_at();

DROP TRIGGER IF EXISTS trigger_set_offer_expires_at ON requests.help_offers;
CREATE TRIGGER trigger_set_offer_expires_at
    BEFORE INSERT ON requests.help_offers
    FOR EACH ROW
    EXECUTE FUNCTION requests.set_offer_expires_at();

DROP TRIGGER IF EXISTS trigger_set_message_expires_at ON messaging.messages;
CREATE TRIGGER trigger_set_message_expires_at
    BEFORE INSERT ON messaging.messages
    FOR EACH ROW
    EXECUTE FUNCTION messaging.set_message_expires_at();

DROP TRIGGER IF EXISTS trigger_set_notification_expires_at ON notifications.notifications;
CREATE TRIGGER trigger_set_notification_expires_at
    BEFORE INSERT ON notifications.notifications
    FOR EACH ROW
    EXECUTE FUNCTION notifications.set_notification_expires_at();

-- ============= FUNCTION FOR REPUTATION DECAY CALCULATION =============

-- Calculate current karma with time-based decay
CREATE OR REPLACE FUNCTION reputation.calculate_decayed_karma(
    p_user_id UUID,
    p_community_id UUID
)
RETURNS INTEGER AS $$
DECLARE
    v_total_karma INTEGER := 0;
    v_half_life_months INTEGER;
    v_record RECORD;
    v_months_ago NUMERIC;
    v_decay_factor NUMERIC;
BEGIN
    -- Get half-life setting from community
    SELECT reputation_half_life_months INTO v_half_life_months
    FROM communities.settings
    WHERE community_id = p_community_id;

    -- Default to 6 months if not set
    IF v_half_life_months IS NULL THEN
        v_half_life_months := 6;
    END IF;

    -- Calculate decayed karma for all records
    FOR v_record IN
        SELECT points, created_at
        FROM reputation.karma_records
        WHERE user_id = p_user_id AND community_id = p_community_id
    LOOP
        -- Calculate how many months ago this karma was earned
        v_months_ago := EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - v_record.created_at)) / (30.44 * 24 * 60 * 60);

        -- Calculate decay factor using exponential decay formula
        -- decay_factor = 0.5^(months_ago / half_life_months)
        v_decay_factor := POWER(0.5, v_months_ago / v_half_life_months);

        -- Add decayed karma to total
        v_total_karma := v_total_karma + ROUND(v_record.points * v_decay_factor);
    END LOOP;

    RETURN GREATEST(v_total_karma, 0); -- Never negative
END;
$$ LANGUAGE plpgsql;

-- ============= DEFAULT SETTINGS FOR EXISTING COMMUNITIES =============

-- Create default settings for all existing communities
INSERT INTO communities.settings (
    community_id,
    request_ttl_days,
    offer_ttl_days,
    message_ttl_days,
    notification_ttl_days,
    reputation_half_life_months,
    activity_types
)
SELECT
    id,
    60,  -- request_ttl_days
    60,  -- offer_ttl_days
    60,  -- message_ttl_days
    60,  -- notification_ttl_days
    6,   -- reputation_half_life_months
    '["complete_request", "complete_offer"]'::JSONB
FROM communities.communities
WHERE id NOT IN (SELECT community_id FROM communities.settings);

-- ============= UPDATE EXISTING DATA =============

-- Set expires_at for existing help requests (based on created_at + 60 days)
UPDATE requests.help_requests
SET expires_at = created_at + INTERVAL '60 days'
WHERE expires_at IS NULL;

-- Set expires_at for existing help offers
UPDATE requests.help_offers
SET expires_at = created_at + INTERVAL '60 days'
WHERE expires_at IS NULL;

-- Set expires_at for existing messages
UPDATE messaging.messages
SET expires_at = created_at + INTERVAL '60 days'
WHERE expires_at IS NULL;

-- Set expires_at for existing notifications
UPDATE notifications.notifications
SET expires_at = created_at + INTERVAL '60 days'
WHERE expires_at IS NULL;

-- ============= COMMENTS =============

COMMENT ON TABLE communities.settings IS 'Per-community configuration for TTL and reputation decay';
COMMENT ON COLUMN communities.settings.request_ttl_days IS 'Days before help requests expire';
COMMENT ON COLUMN communities.settings.offer_ttl_days IS 'Days before help offers expire';
COMMENT ON COLUMN communities.settings.message_ttl_days IS 'Days before messages expire';
COMMENT ON COLUMN communities.settings.notification_ttl_days IS 'Days before notifications expire';
COMMENT ON COLUMN communities.settings.reputation_half_life_months IS 'Months for karma to decay to 50% of original value';
COMMENT ON COLUMN communities.settings.activity_types IS 'Activities that reset last_activity_at (JSONB array)';

COMMENT ON TABLE reputation.activity_log IS 'Log of user activities for reputation decay calculation';
COMMENT ON COLUMN reputation.trust_scores.last_activity_at IS 'Last time user performed a counted activity in this community';

COMMENT ON FUNCTION communities.calculate_expires_at IS 'Calculate expiration timestamp based on community TTL settings';
COMMENT ON FUNCTION reputation.calculate_decayed_karma IS 'Calculate user karma with exponential time-based decay';
