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
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE auth.sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    token VARCHAR(500) NOT NULL UNIQUE,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_auth_users_email ON auth.users(email);
CREATE INDEX idx_auth_sessions_user_id ON auth.sessions(user_id);

-- ============= COMMUNITY SERVICE SCHEMA =============
CREATE SCHEMA IF NOT EXISTS communities;

CREATE TABLE communities.communities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    max_members INTEGER DEFAULT 150,
    current_members INTEGER DEFAULT 0,
    creator_id UUID NOT NULL REFERENCES auth.users(id),
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

CREATE INDEX idx_communities_creator_id ON communities.communities(creator_id);
CREATE INDEX idx_members_community_id ON communities.members(community_id);
CREATE INDEX idx_members_user_id ON communities.members(user_id);
CREATE INDEX idx_norms_community_id ON communities.norms(community_id);

-- ============= REQUEST SERVICE SCHEMA =============
CREATE SCHEMA IF NOT EXISTS requests;

CREATE TABLE requests.help_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    community_id UUID NOT NULL REFERENCES communities.communities(id),
    requester_id UUID NOT NULL REFERENCES auth.users(id),
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    category VARCHAR(100) NOT NULL,
    urgency VARCHAR(50) DEFAULT 'medium',
    preferred_start_date TIMESTAMP,
    preferred_end_date TIMESTAMP,
    status VARCHAR(50) DEFAULT 'open',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
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

CREATE INDEX idx_requests_community_id ON requests.help_requests(community_id);
CREATE INDEX idx_requests_requester_id ON requests.help_requests(requester_id);
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

CREATE TABLE notifications.notification_preferences (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
    email_on_new_request BOOLEAN DEFAULT TRUE,
    email_on_request_match BOOLEAN DEFAULT TRUE,
    email_on_message BOOLEAN DEFAULT TRUE,
    email_digest BOOLEAN DEFAULT TRUE,
    push_enabled BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE notifications.notification_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    type VARCHAR(100) NOT NULL,
    subject VARCHAR(255) NOT NULL,
    content TEXT,
    channel VARCHAR(50), -- 'email', 'push', 'in_app'
    status VARCHAR(50), -- 'sent', 'delivered', 'failed'
    sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_notification_preferences_user_id ON notifications.notification_preferences(user_id);
CREATE INDEX idx_notification_log_user_id ON notifications.notification_log(user_id);

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

-- Grant schema permissions
GRANT USAGE ON SCHEMA auth, communities, requests, reputation, messaging, notifications, feedback, governance, events TO karmyq;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA auth, communities, requests, reputation, messaging, notifications, feedback, governance, events TO karmyq;
