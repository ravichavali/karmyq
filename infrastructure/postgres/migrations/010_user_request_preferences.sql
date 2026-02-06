-- Migration 010: User Request Preferences
-- Day 8: Interest-based subscriptions
-- Adds tables for user request type preferences and interests

-- User preferences for request types (subscribe/unsubscribe)
CREATE TABLE IF NOT EXISTS auth.user_request_preferences (
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    request_type request_type_enum NOT NULL,
    subscribed BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, request_type)
);

-- User interest categories (for services, borrow, events)
CREATE TABLE IF NOT EXISTS auth.user_interests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    interest_type VARCHAR(50) NOT NULL, -- 'service_category', 'item_category', 'event_type'
    interest_value VARCHAR(100) NOT NULL, -- 'plumbing', 'tools', 'volunteer'
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, interest_type, interest_value)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_preferences_user ON auth.user_request_preferences(user_id);
CREATE INDEX IF NOT EXISTS idx_user_preferences_subscribed ON auth.user_request_preferences(user_id, subscribed) WHERE subscribed = true;
CREATE INDEX IF NOT EXISTS idx_user_interests_user ON auth.user_interests(user_id);
CREATE INDEX IF NOT EXISTS idx_user_interests_type ON auth.user_interests(interest_type, interest_value);

-- Function to auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_user_preferences_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for auto-updating timestamps
DROP TRIGGER IF EXISTS update_user_preferences_timestamp ON auth.user_request_preferences;
CREATE TRIGGER update_user_preferences_timestamp
    BEFORE UPDATE ON auth.user_request_preferences
    FOR EACH ROW
    EXECUTE FUNCTION update_user_preferences_timestamp();

-- Insert default preferences for existing users (all types subscribed by default)
-- This ensures backward compatibility
INSERT INTO auth.user_request_preferences (user_id, request_type, subscribed)
SELECT u.id, rt.type, true
FROM auth.users u
CROSS JOIN (
    VALUES
        ('generic'::request_type_enum),
        ('ride'::request_type_enum),
        ('service'::request_type_enum),
        ('event'::request_type_enum),
        ('borrow'::request_type_enum)
) AS rt(type)
ON CONFLICT (user_id, request_type) DO NOTHING;

-- Comments for documentation
COMMENT ON TABLE auth.user_request_preferences IS 'User preferences for which request types to see in their feed';
COMMENT ON TABLE auth.user_interests IS 'User interests for specific categories within request types (e.g., interested in plumbing services)';
COMMENT ON COLUMN auth.user_request_preferences.subscribed IS 'Whether user wants to see this request type in their feed';
COMMENT ON COLUMN auth.user_interests.interest_type IS 'The type of interest: service_category, item_category, event_type';
COMMENT ON COLUMN auth.user_interests.interest_value IS 'The specific value of the interest (e.g., plumbing, tools, volunteer)';
