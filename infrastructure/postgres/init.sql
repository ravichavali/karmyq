-- Karmyq Database Schema Initialization
-- This script creates all tables for the microservices

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============= AUTH SERVICE SCHEMA =============
CREATE SCHEMA IF NOT EXISTS auth;

CREATE TABLE auth.users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    bio TEXT,
    avatar_url VARCHAR(255),
    invited_by UUID REFERENCES auth.users(id),
    invitation_accepted_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE auth.sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    token TEXT NOT NULL UNIQUE,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE auth.user_skills (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    skill VARCHAR(100) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, skill)
);

CREATE INDEX idx_auth_users_email ON auth.users(email);
CREATE INDEX idx_auth_sessions_user_id ON auth.sessions(user_id);
CREATE INDEX idx_auth_user_skills_user_id ON auth.user_skills(user_id);

-- Social Graph tables (Social Graph Service - Port 3010)
CREATE TABLE auth.user_invitations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    inviter_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    invitee_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,  -- Nullable until invitation is accepted
    invited_at TIMESTAMP NOT NULL DEFAULT NOW(),
    invitation_code TEXT UNIQUE NOT NULL,
    invitation_accepted_at TIMESTAMP,
    community_id UUID,  -- Will reference communities.communities after it's created
    invitation_method VARCHAR(50),
    inviter_note TEXT,
    UNIQUE(inviter_id, invitee_id, community_id)
);

-- Constraint: prevent self-invitations (allow NULL invitee_id for pending invitations)
ALTER TABLE auth.user_invitations ADD CONSTRAINT no_self_invitation CHECK (invitee_id IS NULL OR inviter_id <> invitee_id);

-- Constraint: validate invitation code format
ALTER TABLE auth.user_invitations ADD CONSTRAINT invitation_code_format CHECK (invitation_code ~ '^KARMYQ-[A-Z0-9]+-[0-9]{4}-[A-Z0-9]{4}$');

CREATE TABLE auth.social_distances (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_a_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    user_b_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    community_id UUID,  -- Will reference communities.communities after it's created
    degrees_of_separation INTEGER NOT NULL CHECK (degrees_of_separation >= 1 AND degrees_of_separation <= 4),
    shortest_path JSONB NOT NULL,
    highest_trust_path JSONB,
    path_trust_score INTEGER,
    computed_at TIMESTAMP NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMP NOT NULL DEFAULT NOW() + INTERVAL '7 days',
    UNIQUE(user_a_id, user_b_id, community_id)
);

CREATE INDEX idx_invitations_inviter ON auth.user_invitations(inviter_id);
CREATE INDEX idx_invitations_invitee ON auth.user_invitations(invitee_id);
CREATE INDEX idx_invitations_community ON auth.user_invitations(community_id);
CREATE INDEX idx_invitations_accepted ON auth.user_invitations(invitation_accepted_at);
CREATE INDEX idx_social_distances_user_a ON auth.social_distances(user_a_id);
CREATE INDEX idx_social_distances_user_b ON auth.social_distances(user_b_id);
CREATE INDEX idx_social_distances_community ON auth.social_distances(community_id);
CREATE INDEX idx_social_distances_degrees ON auth.social_distances(degrees_of_separation);
CREATE INDEX idx_social_distances_expires ON auth.social_distances(expires_at);

-- Inviter stats table for gamification
CREATE TABLE auth.inviter_stats (
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    community_id UUID,  -- Will reference communities.communities after it's created
    total_invitations_sent INTEGER DEFAULT 0,
    total_invitations_accepted INTEGER DEFAULT 0,
    acceptance_rate DECIMAL(5,2) DEFAULT 0,
    avg_invitee_karma DECIMAL(5,2) DEFAULT 0,
    avg_invitee_trust_score DECIMAL(5,2) DEFAULT 0,
    total_invitee_exchanges INTEGER DEFAULT 0,
    total_network_size INTEGER DEFAULT 0,
    bridge_score INTEGER DEFAULT 0,
    inviter_tier VARCHAR(20) DEFAULT 'bronze',
    tier_updated_at TIMESTAMP,
    last_computed TIMESTAMP DEFAULT NOW(),
    PRIMARY KEY (user_id, community_id)
);

CREATE INDEX idx_inviter_stats_tier ON auth.inviter_stats(inviter_tier);
CREATE INDEX idx_inviter_stats_community ON auth.inviter_stats(community_id);

-- Function to generate unique invitation codes
CREATE OR REPLACE FUNCTION auth.generate_invitation_code(
    user_name TEXT,
    year INTEGER
)
RETURNS TEXT AS $$
DECLARE
    random_suffix TEXT;
    new_invitation_code TEXT;
    code_exists BOOLEAN;
BEGIN
    LOOP
        -- Generate random 4-character suffix
        random_suffix := upper(substring(md5(random()::text) from 1 for 4));

        -- Format: KARMYQ-NAME-YEAR-XXXX
        new_invitation_code := 'KARMYQ-' ||
                          upper(substring(replace(user_name, ' ', '') from 1 for 8)) ||
                          '-' || year || '-' || random_suffix;

        -- Check if code already exists
        SELECT EXISTS(
            SELECT 1 FROM auth.user_invitations
            WHERE invitation_code = new_invitation_code
        ) INTO code_exists;

        -- Exit loop if unique code found
        EXIT WHEN NOT code_exists;
    END LOOP;

    RETURN new_invitation_code;
END;
$$ LANGUAGE plpgsql;

-- User privacy settings (for karma display, profile visibility, etc.)
CREATE TABLE auth.user_privacy_settings (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    show_my_karma_to_me BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_user_privacy_settings_user_id ON auth.user_privacy_settings(user_id);

-- ============= COMMUNITY SERVICE SCHEMA =============
CREATE SCHEMA IF NOT EXISTS communities;

CREATE TABLE communities.communities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    location VARCHAR(255),
    category VARCHAR(100),
    max_members INTEGER DEFAULT 150,
    current_members INTEGER DEFAULT 0,
    creator_id UUID NOT NULL REFERENCES auth.users(id),
    access_type VARCHAR(50) DEFAULT 'public',
    status VARCHAR(50) DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE communities.members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    community_id UUID NOT NULL REFERENCES communities.communities(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role VARCHAR(50) DEFAULT 'member',
    invited_by UUID REFERENCES auth.users(id),
    status VARCHAR(50) DEFAULT 'active',
    join_request_message TEXT,
    joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(community_id, user_id)
);

CREATE TABLE communities.norms (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    community_id UUID NOT NULL REFERENCES communities.communities(id) ON DELETE CASCADE,
    description TEXT NOT NULL,
    rationale TEXT,
    created_by UUID NOT NULL REFERENCES auth.users(id),
    status VARCHAR(50) DEFAULT 'proposed',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE communities.norm_approvals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    norm_id UUID NOT NULL REFERENCES communities.norms(id) ON DELETE CASCADE,
    approved_by UUID NOT NULL REFERENCES auth.users(id),
    approved_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(norm_id, approved_by)
);

-- Community settings for ephemeral data and reputation decay (ADR-009, ADR-011)
CREATE TABLE communities.settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    community_id UUID NOT NULL REFERENCES communities.communities(id) ON DELETE CASCADE UNIQUE,
    request_ttl_days INTEGER DEFAULT 60,
    offer_ttl_days INTEGER DEFAULT 60,
    message_ttl_days INTEGER DEFAULT 90,
    notification_ttl_days INTEGER DEFAULT 30,
    reputation_half_life_months INTEGER DEFAULT 6,
    activity_types JSONB DEFAULT '["complete_request", "complete_offer"]'::jsonb,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_communities_creator_id ON communities.communities(creator_id);
CREATE INDEX idx_communities_location ON communities.communities(location);
CREATE INDEX idx_communities_category ON communities.communities(category);
CREATE INDEX idx_communities_status ON communities.communities(status);
CREATE INDEX idx_members_community_id ON communities.members(community_id);
CREATE INDEX idx_members_user_id ON communities.members(user_id);
CREATE INDEX idx_norms_community_id ON communities.norms(community_id);

-- ============= REQUEST SERVICE SCHEMA =============
CREATE SCHEMA IF NOT EXISTS requests;

-- v9.0: Polymorphic request type enum (matches migration 009)
CREATE TYPE request_type_enum AS ENUM ('generic', 'ride', 'borrow', 'service', 'event');

CREATE TABLE requests.help_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    requester_id UUID NOT NULL REFERENCES auth.users(id),
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    category VARCHAR(100) NOT NULL,
    urgency VARCHAR(50) DEFAULT 'medium',
    preferred_start_date TIMESTAMP,
    preferred_end_date TIMESTAMP,
    status VARCHAR(50) DEFAULT 'open',
    expired BOOLEAN DEFAULT FALSE,
    expires_at TIMESTAMP,
    request_type request_type_enum NOT NULL DEFAULT 'generic',  -- v9.0: Polymorphic request type (matches migration 009)
    payload JSONB DEFAULT '{}',  -- v9.0: Type-specific structured data
    requirements JSONB DEFAULT '{}',  -- v9.0: Structured requirements
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Junction table: Links requests to communities (many-to-many)
-- A single request can be posted to multiple communities
CREATE TABLE requests.request_communities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    request_id UUID NOT NULL REFERENCES requests.help_requests(id) ON DELETE CASCADE,
    community_id UUID NOT NULL REFERENCES communities.communities(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_request_community UNIQUE (request_id, community_id)
);

CREATE TABLE requests.help_offers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    community_id UUID NOT NULL REFERENCES communities.communities(id),
    offerer_id UUID NOT NULL REFERENCES auth.users(id),
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    category VARCHAR(100) NOT NULL,
    availability_start_date TIMESTAMP,
    availability_end_date TIMESTAMP,
    status VARCHAR(50) DEFAULT 'active',
    expired BOOLEAN DEFAULT FALSE,
    expires_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE requests.matches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    request_id UUID NOT NULL REFERENCES requests.help_requests(id) ON DELETE CASCADE,
    offer_id UUID REFERENCES requests.help_offers(id) ON DELETE SET NULL,
    responder_id UUID NOT NULL REFERENCES auth.users(id),
    status VARCHAR(50) DEFAULT 'proposed',
    completed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_requests_requester_id ON requests.help_requests(requester_id);
CREATE INDEX idx_requests_payload ON requests.help_requests USING GIN (payload);  -- v9.0: Fast searching in JSONB payload
CREATE INDEX idx_requests_type ON requests.help_requests(request_type);  -- v9.0: Fast filtering by request type
CREATE INDEX idx_request_communities_request ON requests.request_communities(request_id);
CREATE INDEX idx_request_communities_community ON requests.request_communities(community_id);
CREATE INDEX idx_offers_community_id ON requests.help_offers(community_id);
CREATE INDEX idx_matches_request_id ON requests.matches(request_id);
CREATE INDEX idx_matches_responder_id ON requests.matches(responder_id);

-- ============= REPUTATION SERVICE SCHEMA =============
CREATE SCHEMA IF NOT EXISTS reputation;

CREATE TABLE reputation.karma_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    community_id UUID NOT NULL REFERENCES communities.communities(id),
    points INTEGER NOT NULL,
    reason VARCHAR(255) NOT NULL,
    related_entity_id UUID,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE reputation.trust_scores (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    community_id UUID NOT NULL REFERENCES communities.communities(id),
    score INTEGER DEFAULT 50,
    requests_completed INTEGER DEFAULT 0,
    offers_accepted INTEGER DEFAULT 0,
    average_feedback NUMERIC(3,2) DEFAULT 0,
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, community_id)
);

CREATE TABLE reputation.badges (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    icon_url VARCHAR(255),
    earned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_karma_user_id ON reputation.karma_records(user_id);
CREATE INDEX idx_karma_community_id ON reputation.karma_records(community_id);
CREATE INDEX idx_trust_scores_user_id ON reputation.trust_scores(user_id);

-- Reputation decay function (ADR-011)
CREATE OR REPLACE FUNCTION reputation.calculate_decayed_karma(
    original_karma INTEGER,
    earned_date TIMESTAMPTZ,
    half_life_months INTEGER DEFAULT 6
)
RETURNS NUMERIC AS $$
DECLARE
    months_elapsed NUMERIC;
    decay_factor NUMERIC;
BEGIN
    -- Calculate months since karma was earned
    months_elapsed := EXTRACT(EPOCH FROM (NOW() - earned_date)) / (30.44 * 24 * 60 * 60);

    -- Calculate decay factor using exponential decay formula
    -- decay_factor = 2^(-months_elapsed / half_life_months)
    decay_factor := POWER(2, -months_elapsed / half_life_months);

    -- Return decayed karma
    RETURN decay_factor;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ============= MESSAGING SERVICE SCHEMA =============
CREATE SCHEMA IF NOT EXISTS messaging;

CREATE TABLE messaging.conversations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    request_match_id UUID REFERENCES requests.matches(id) ON DELETE CASCADE,
    last_message_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE messaging.conversation_participants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id UUID NOT NULL REFERENCES messaging.conversations(id) ON DELETE CASCADE,
    participant_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    UNIQUE(conversation_id, participant_id)
);

CREATE TABLE messaging.messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sender_id UUID NOT NULL REFERENCES auth.users(id),
    conversation_id UUID NOT NULL REFERENCES messaging.conversations(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    status VARCHAR(50) DEFAULT 'sent',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_conversations_request_match_id ON messaging.conversations(request_match_id);
CREATE INDEX idx_messages_conversation_id ON messaging.messages(conversation_id);
CREATE INDEX idx_messages_sender_id ON messaging.messages(sender_id);

-- ============= NOTIFICATION SERVICE SCHEMA =============
CREATE SCHEMA IF NOT EXISTS notifications;

-- Notifications table (in-app notifications)
CREATE TABLE notifications.notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL,
  title VARCHAR(255) NOT NULL,
  body TEXT NOT NULL,
  data JSONB DEFAULT '{}',
  read BOOLEAN DEFAULT FALSE,
  action_url VARCHAR(500),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  read_at TIMESTAMP
);

-- Notification preferences table (event-specific)
CREATE TABLE notifications.preferences (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  community_id UUID REFERENCES communities.communities(id) ON DELETE CASCADE,
  event_type VARCHAR(50) NOT NULL,
  in_app_enabled BOOLEAN DEFAULT TRUE,
  push_enabled BOOLEAN DEFAULT TRUE,
  email_enabled BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, community_id, event_type)
);

-- Global preferences (user-level settings)
CREATE TABLE notifications.global_preferences (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  in_app_enabled BOOLEAN DEFAULT TRUE,
  push_enabled BOOLEAN DEFAULT TRUE,
  email_enabled BOOLEAN DEFAULT FALSE,
  quiet_hours_start TIME,
  quiet_hours_end TIME,
  timezone VARCHAR(50) DEFAULT 'UTC',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX idx_notifications_user_id ON notifications.notifications(user_id);
CREATE INDEX idx_notifications_type ON notifications.notifications(type);
CREATE INDEX idx_notifications_created_at ON notifications.notifications(created_at DESC);
CREATE INDEX idx_notifications_unread ON notifications.notifications(user_id, read) WHERE read = FALSE;
CREATE INDEX idx_preferences_user_id ON notifications.preferences(user_id);
CREATE INDEX idx_preferences_event_type ON notifications.preferences(event_type);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION notifications.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for preferences table
CREATE TRIGGER preferences_updated_at
  BEFORE UPDATE ON notifications.preferences
  FOR EACH ROW
  EXECUTE FUNCTION notifications.update_updated_at();

-- Trigger for global_preferences table
CREATE TRIGGER global_preferences_updated_at
  BEFORE UPDATE ON notifications.global_preferences
  FOR EACH ROW
  EXECUTE FUNCTION notifications.update_updated_at();

-- ============= FEEDBACK SCHEMA =============
CREATE SCHEMA IF NOT EXISTS feedback;

CREATE TABLE feedback.feedback (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    from_user_id UUID NOT NULL REFERENCES auth.users(id),
    to_user_id UUID NOT NULL REFERENCES auth.users(id),
    request_match_id UUID NOT NULL REFERENCES requests.matches(id),
    community_id UUID NOT NULL REFERENCES communities.communities(id),
    rating INTEGER NOT NULL,
    comment TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE feedback.feedback_categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    feedback_id UUID NOT NULL REFERENCES feedback.feedback(id) ON DELETE CASCADE,
    category VARCHAR(100) NOT NULL
);

CREATE INDEX idx_feedback_from_user ON feedback.feedback(from_user_id);
CREATE INDEX idx_feedback_to_user ON feedback.feedback(to_user_id);
CREATE INDEX idx_feedback_match ON feedback.feedback(request_match_id);

-- ============= GOVERNANCE SERVICE SCHEMA =============
CREATE SCHEMA IF NOT EXISTS governance;

CREATE TABLE governance.proposals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    community_id UUID NOT NULL REFERENCES communities.communities(id),
    proposed_by UUID NOT NULL REFERENCES auth.users(id),
    type VARCHAR(100) NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    status VARCHAR(50) DEFAULT 'proposed',
    proposed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    voting_starts_at TIMESTAMP,
    voting_ends_at TIMESTAMP
);

CREATE TABLE governance.votes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    proposal_id UUID NOT NULL REFERENCES governance.proposals(id) ON DELETE CASCADE,
    voter_id UUID NOT NULL REFERENCES auth.users(id),
    community_id UUID NOT NULL REFERENCES communities.communities(id),
    choice VARCHAR(50) NOT NULL, -- 'yes', 'no', 'abstain'
    voted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(proposal_id, voter_id)
);

CREATE TABLE governance.conflict_cases (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    community_id UUID NOT NULL REFERENCES communities.communities(id),
    accuser_id UUID NOT NULL REFERENCES auth.users(id),
    accused_id UUID NOT NULL REFERENCES auth.users(id),
    description TEXT NOT NULL,
    related_request_match_id UUID REFERENCES requests.matches(id),
    status VARCHAR(50) DEFAULT 'reported',
    reported_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    resolved_at TIMESTAMP,
    resolution TEXT
);

CREATE TABLE governance.conflict_mediators (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conflict_case_id UUID NOT NULL REFERENCES governance.conflict_cases(id) ON DELETE CASCADE,
    mediator_id UUID NOT NULL REFERENCES auth.users(id),
    assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_proposals_community_id ON governance.proposals(community_id);
CREATE INDEX idx_proposals_proposed_by ON governance.proposals(proposed_by);
CREATE INDEX idx_votes_proposal_id ON governance.votes(proposal_id);
CREATE INDEX idx_conflict_cases_community_id ON governance.conflict_cases(community_id);

-- ============= EVENT LOG SCHEMA =============
CREATE SCHEMA IF NOT EXISTS events;

CREATE TABLE events.event_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_type VARCHAR(100) NOT NULL,
    source_service VARCHAR(100) NOT NULL,
    payload JSONB NOT NULL,
    processed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    processed_at TIMESTAMP
);

CREATE INDEX idx_event_log_type ON events.event_log(event_type);
CREATE INDEX idx_event_log_processed ON events.event_log(processed);
CREATE INDEX idx_event_log_created_at ON events.event_log(created_at);

-- ============= FEED SERVICE SCHEMA =============
CREATE SCHEMA IF NOT EXISTS feed;

-- User feed preferences
CREATE TABLE feed.preferences (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    show_community_activity BOOLEAN DEFAULT true,
    show_open_requests BOOLEAN DEFAULT true,
    show_completed_exchanges BOOLEAN DEFAULT false,
    suggest_adjacent_requests BOOLEAN DEFAULT true,
    exploration_level VARCHAR(20) DEFAULT 'balanced' CHECK (exploration_level IN ('conservative', 'balanced', 'adventurous')),
    show_explanations BOOLEAN DEFAULT true,
    show_broader_stories BOOLEAN DEFAULT true,
    allow_public_featuring BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Dismissed feed items (to avoid showing again)
CREATE TABLE feed.dismissed_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    item_type VARCHAR(50) NOT NULL,
    item_id VARCHAR(255) NOT NULL,
    dismissed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, item_type, item_id)
);

-- Indexes for feed service
CREATE INDEX idx_feed_preferences_user_id ON feed.preferences(user_id);
CREATE INDEX idx_feed_dismissed_user_id ON feed.dismissed_items(user_id);
CREATE INDEX idx_feed_dismissed_at ON feed.dismissed_items(dismissed_at);

-- ========================================
-- ROW-LEVEL SECURITY (RLS) POLICIES
-- ========================================
-- Multi-tenant isolation via RLS
-- Session variables:
--   - app.current_user_id: Current authenticated user
--   - app.current_community_id: Current community context

-- Enable RLS on community-scoped tables
ALTER TABLE communities.communities ENABLE ROW LEVEL SECURITY;
ALTER TABLE communities.members ENABLE ROW LEVEL SECURITY;
ALTER TABLE communities.norms ENABLE ROW LEVEL SECURITY;
ALTER TABLE communities.norm_approvals ENABLE ROW LEVEL SECURITY;

ALTER TABLE requests.help_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE requests.help_offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE requests.matches ENABLE ROW LEVEL SECURITY;

ALTER TABLE reputation.karma_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE reputation.trust_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE reputation.badges ENABLE ROW LEVEL SECURITY;

ALTER TABLE messaging.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messaging.conversation_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE messaging.messages ENABLE ROW LEVEL SECURITY;

ALTER TABLE notifications.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications.preferences ENABLE ROW LEVEL SECURITY;

ALTER TABLE feedback.feedback ENABLE ROW LEVEL SECURITY;

ALTER TABLE governance.proposals ENABLE ROW LEVEL SECURITY;
ALTER TABLE governance.votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE governance.conflict_cases ENABLE ROW LEVEL SECURITY;

ALTER TABLE feed.preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE feed.dismissed_items ENABLE ROW LEVEL SECURITY;

-- Community isolation policies
-- Only show data from communities the user is a member of

CREATE POLICY community_isolation ON communities.communities
  USING (
    id IN (
      SELECT community_id
      FROM communities.members
      WHERE user_id = current_setting('app.current_user_id', true)::uuid
    )
  );

CREATE POLICY community_isolation ON communities.members
  USING (
    community_id IN (
      SELECT community_id
      FROM communities.members
      WHERE user_id = current_setting('app.current_user_id', true)::uuid
    )
  );

CREATE POLICY community_isolation ON communities.norms
  USING (
    community_id = current_setting('app.current_community_id', true)::uuid
  );

CREATE POLICY community_isolation ON communities.norm_approvals
  USING (
    norm_id IN (
      SELECT id FROM communities.norms
      WHERE community_id = current_setting('app.current_community_id', true)::uuid
    )
  );

-- RLS for help_requests: Check if request is linked to the current community via junction table
CREATE POLICY community_isolation ON requests.help_requests
  USING (
    EXISTS (
      SELECT 1 FROM requests.request_communities rc
      WHERE rc.request_id = help_requests.id
      AND rc.community_id = current_setting('app.current_community_id', true)::uuid
    )
  );

CREATE POLICY community_isolation ON requests.help_offers
  USING (
    community_id = current_setting('app.current_community_id', true)::uuid
  );

-- RLS for matches: Check if match's request is linked to the current community
CREATE POLICY community_isolation ON requests.matches
  USING (
    request_id IN (
      SELECT rc.request_id FROM requests.request_communities rc
      WHERE rc.community_id = current_setting('app.current_community_id', true)::uuid
    )
  );

CREATE POLICY community_isolation ON reputation.karma_records
  USING (
    community_id = current_setting('app.current_community_id', true)::uuid
  );

CREATE POLICY community_isolation ON reputation.trust_scores
  USING (
    community_id = current_setting('app.current_community_id', true)::uuid
  );

-- Badges are global to users, not community-specific
CREATE POLICY community_isolation ON reputation.badges
  USING (true); -- All badges visible (they're user-specific, not community-specific)

-- RLS for conversations: Check via match -> request -> request_communities
CREATE POLICY community_isolation ON messaging.conversations
  USING (
    request_match_id IN (
      SELECT m.id FROM requests.matches m
      WHERE m.request_id IN (
        SELECT rc.request_id FROM requests.request_communities rc
        WHERE rc.community_id = current_setting('app.current_community_id', true)::uuid
      )
    )
  );

-- RLS for conversation_participants: Check via conversation RLS
CREATE POLICY community_isolation ON messaging.conversation_participants
  USING (
    conversation_id IN (
      SELECT c.id FROM messaging.conversations c
      WHERE c.request_match_id IN (
        SELECT m.id FROM requests.matches m
        WHERE m.request_id IN (
          SELECT rc.request_id FROM requests.request_communities rc
          WHERE rc.community_id = current_setting('app.current_community_id', true)::uuid
        )
      )
    )
  );

-- RLS for messages: Check via conversation RLS
CREATE POLICY community_isolation ON messaging.messages
  USING (
    conversation_id IN (
      SELECT c.id FROM messaging.conversations c
      WHERE c.request_match_id IN (
        SELECT m.id FROM requests.matches m
        WHERE m.request_id IN (
          SELECT rc.request_id FROM requests.request_communities rc
          WHERE rc.community_id = current_setting('app.current_community_id', true)::uuid
        )
      )
    )
  );

-- Notifications are user-specific, not community-specific
CREATE POLICY community_isolation ON notifications.notifications
  USING (
    user_id = current_setting('app.current_user_id', true)::uuid
  );

CREATE POLICY community_isolation ON notifications.preferences
  USING (
    user_id = current_setting('app.current_user_id', true)::uuid
  );

CREATE POLICY community_isolation ON feedback.feedback
  USING (
    community_id = current_setting('app.current_community_id', true)::uuid
  );

CREATE POLICY community_isolation ON governance.proposals
  USING (
    community_id = current_setting('app.current_community_id', true)::uuid
  );

CREATE POLICY community_isolation ON governance.votes
  USING (
    proposal_id IN (
      SELECT id FROM governance.proposals
      WHERE community_id = current_setting('app.current_community_id', true)::uuid
    )
  );

CREATE POLICY community_isolation ON governance.conflict_cases
  USING (
    community_id = current_setting('app.current_community_id', true)::uuid
  );

CREATE POLICY community_isolation ON feed.preferences
  USING (
    user_id = current_setting('app.current_user_id', true)::uuid
  );

CREATE POLICY community_isolation ON feed.dismissed_items
  USING (
    user_id = current_setting('app.current_user_id', true)::uuid
  );

-- Note: auth.users table does NOT have RLS
-- Users can belong to multiple communities, so user data is shared across communities

-- ============= GEOCODING CACHE (SHARED ACROSS ALL USERS) =============
-- No schema needed - this is a shared utility table
CREATE TABLE IF NOT EXISTS geocoding_cache (
    query TEXT PRIMARY KEY,
    results JSONB NOT NULL,
    cached_at TIMESTAMP DEFAULT NOW(),
    expires_at TIMESTAMP DEFAULT NOW() + INTERVAL '30 days',
    hit_count INTEGER DEFAULT 1,
    last_accessed TIMESTAMP DEFAULT NOW(),
    source VARCHAR(50) DEFAULT 'nominatim' -- Track which API provided the data
);

CREATE INDEX idx_geocoding_expires ON geocoding_cache(expires_at);
CREATE INDEX idx_geocoding_hits ON geocoding_cache(hit_count DESC);
CREATE INDEX idx_geocoding_last_accessed ON geocoding_cache(last_accessed DESC);

COMMENT ON TABLE geocoding_cache IS 'Shared geocoding cache - reduces external API calls by 95%+';
COMMENT ON COLUMN geocoding_cache.query IS 'Normalized search query (lowercase, trimmed)';
COMMENT ON COLUMN geocoding_cache.results IS 'Array of geocoding results with display_name, address, lat, lng, type';
COMMENT ON COLUMN geocoding_cache.hit_count IS 'Number of times this cache entry was accessed';

-- Create karmyq role if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'karmyq') THEN
        CREATE ROLE karmyq WITH LOGIN PASSWORD 'karmyq_password';
    END IF;
END
$$;

-- Grant schema permissions
GRANT USAGE ON SCHEMA auth, communities, requests, reputation, messaging, notifications, feedback, governance, events, feed TO karmyq;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA auth, communities, requests, reputation, messaging, notifications, feedback, governance, events, feed TO karmyq;

-- ============= MIGRATION 011: COMMUNITY CONFIGURATION SYSTEM =============
-- Phase 1: Communities define their own rules for trust mechanics, karma distribution, and coordination patterns
-- Related: ADR-030 (Community Configuration System)

-- Community Configs Table
CREATE TABLE communities.community_configs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    community_id UUID NOT NULL REFERENCES communities.communities(id) ON DELETE CASCADE UNIQUE,

    -- Identity & Boundaries
    member_cap INTEGER DEFAULT 150 CHECK (member_cap BETWEEN 10 AND 150),
    visibility_mode VARCHAR(50) DEFAULT 'public' CHECK (visibility_mode IN ('public', 'members_only', 'hybrid')),
    outsider_response_allowed BOOLEAN DEFAULT FALSE,

    -- Request Types (community-defined taxonomy)
    enabled_request_types JSONB NOT NULL DEFAULT '[]'::jsonb,

    -- Karma Mechanics
    karma_split_helper INTEGER DEFAULT 60 CHECK (karma_split_helper BETWEEN 0 AND 100),
    karma_split_requestor INTEGER DEFAULT 40 CHECK (karma_split_requestor BETWEEN -50 AND 100),
    base_karma_pool_per_request INTEGER DEFAULT 100 CHECK (base_karma_pool_per_request BETWEEN 10 AND 1000),
    karma_decay_half_life_days INTEGER DEFAULT 0 CHECK (karma_decay_half_life_days BETWEEN 0 AND 365),

    -- Trust Mechanics
    trust_depth_weight DECIMAL(3,2) DEFAULT 0.60 CHECK (trust_depth_weight BETWEEN 0.0 AND 1.0),
    trust_breadth_weight DECIMAL(3,2) DEFAULT 0.40 CHECK (trust_breadth_weight BETWEEN 0.0 AND 1.0),
    trust_decay_half_life_days INTEGER DEFAULT 90 CHECK (trust_decay_half_life_days BETWEEN 30 AND 365),
    trust_path_max_hops INTEGER DEFAULT 3 CHECK (trust_path_max_hops BETWEEN 1 AND 5),
    min_interactions_for_trust INTEGER DEFAULT 1 CHECK (min_interactions_for_trust BETWEEN 1 AND 10),

    -- Community Onboarding
    request_approval_required BOOLEAN DEFAULT FALSE,
    new_member_karma_lockout_days INTEGER DEFAULT 0 CHECK (new_member_karma_lockout_days BETWEEN 0 AND 30),
    join_approval_required BOOLEAN DEFAULT TRUE,
    joining_counts_as_interaction BOOLEAN DEFAULT TRUE,

    -- Metadata
    template_source VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    -- Validation constraint: trust weights must sum to 1.0
    CONSTRAINT trust_weights_sum CHECK (
        ABS((trust_depth_weight + trust_breadth_weight) - 1.0) < 0.01
    )
);

COMMENT ON TABLE communities.community_configs IS 'Comprehensive configuration for community trust, karma, and coordination mechanics';

-- Config Templates Table
CREATE TABLE communities.config_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL UNIQUE,
    description TEXT NOT NULL,
    config_json JSONB NOT NULL,
    is_public BOOLEAN DEFAULT TRUE,
    usage_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE communities.config_templates IS 'Configuration templates for evolutionary discovery';

-- Indexes
CREATE INDEX idx_community_configs_community_id ON communities.community_configs(community_id);
CREATE INDEX idx_community_configs_template_source ON communities.community_configs(template_source);
CREATE INDEX idx_config_templates_usage ON communities.config_templates(usage_count DESC);
CREATE INDEX idx_config_templates_is_public ON communities.config_templates(is_public);

-- Seed Data: 3 Starter Templates
INSERT INTO communities.config_templates (name, description, config_json) VALUES
('Cohousing Default', 'High-trust, balanced participation, relationship-focused', '{"member_cap": 150, "visibility_mode": "public", "outsider_response_allowed": true, "enabled_request_types": [{"name": "meal_share", "description": "Share meals or cooking", "karma_multiplier": 1.0}, {"name": "tool_borrow", "description": "Borrow tools or equipment", "karma_multiplier": 0.8}, {"name": "ride_share", "description": "Share rides or transportation", "karma_multiplier": 1.2}, {"name": "childcare", "description": "Help with childcare or babysitting", "karma_multiplier": 1.5}], "karma_split_helper": 60, "karma_split_requestor": 40, "base_karma_pool_per_request": 100, "karma_decay_half_life_days": 0, "trust_depth_weight": 0.6, "trust_breadth_weight": 0.4, "trust_decay_half_life_days": 180, "trust_path_max_hops": 3, "min_interactions_for_trust": 1, "request_approval_required": false, "new_member_karma_lockout_days": 0, "join_approval_required": true, "joining_counts_as_interaction": true}'::jsonb),
('Neighborhood Cautious', 'Boundary-conscious, helper-focused, gradual trust-building', '{"member_cap": 100, "visibility_mode": "members_only", "outsider_response_allowed": false, "enabled_request_types": [{"name": "skill_share", "description": "Share skills or expertise", "karma_multiplier": 1.0}, {"name": "errand_help", "description": "Help with errands or tasks", "karma_multiplier": 0.9}, {"name": "pet_sitting", "description": "Pet sitting or care", "karma_multiplier": 1.1}], "karma_split_helper": 80, "karma_split_requestor": 20, "base_karma_pool_per_request": 100, "karma_decay_half_life_days": 0, "trust_depth_weight": 0.7, "trust_breadth_weight": 0.3, "trust_decay_half_life_days": 90, "trust_path_max_hops": 2, "min_interactions_for_trust": 3, "request_approval_required": true, "new_member_karma_lockout_days": 7, "join_approval_required": true, "joining_counts_as_interaction": false}'::jsonb),
('Experimental Reciprocal', 'Experimental gift economy with equal karma split', '{"member_cap": 50, "visibility_mode": "hybrid", "outsider_response_allowed": false, "enabled_request_types": [{"name": "general_help", "description": "General help or support", "karma_multiplier": 1.0}], "karma_split_helper": 50, "karma_split_requestor": 50, "base_karma_pool_per_request": 100, "karma_decay_half_life_days": 0, "trust_depth_weight": 0.5, "trust_breadth_weight": 0.5, "trust_decay_half_life_days": 30, "trust_path_max_hops": 3, "min_interactions_for_trust": 1, "request_approval_required": false, "new_member_karma_lockout_days": 0, "join_approval_required": false, "joining_counts_as_interaction": true}'::jsonb);

-- Trigger: Update updated_at on config changes
CREATE OR REPLACE FUNCTION communities.update_community_config_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_community_config_timestamp
BEFORE UPDATE ON communities.community_configs
FOR EACH ROW
EXECUTE FUNCTION communities.update_community_config_timestamp();
