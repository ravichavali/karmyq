-- ============================================================================
-- KarmyQ Federation Schema
-- Adds tables and columns needed for federated operation
-- ============================================================================

-- Create federation schema
CREATE SCHEMA IF NOT EXISTS federation;

-- ============================================================================
-- Instance Identity & Management
-- ============================================================================

-- Represents this instance's identity
CREATE TABLE federation.local_instance (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    domain VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    location JSONB,
    admin_contact VARCHAR(255),
    public_key TEXT NOT NULL,
    private_key TEXT NOT NULL,  -- Encrypted at rest
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    federation_enabled BOOLEAN DEFAULT false,
    federation_policy JSONB DEFAULT '{"open_registration": true, "accepts_federated_requests": true, "requires_approval": true}'::jsonb
);

-- Federated instances we know about
CREATE TABLE federation.instances (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    domain VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255),
    description TEXT,
    location JSONB,
    admin_contact VARCHAR(255),
    public_key TEXT NOT NULL,
    software VARCHAR(100),
    version VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_seen_at TIMESTAMP,
    status VARCHAR(50) DEFAULT 'discovered',  -- discovered, requested, active, suspended, blocked
    statistics JSONB DEFAULT '{}'::jsonb,
    federation_policy JSONB DEFAULT '{}'::jsonb
);

-- Active federation relationships
CREATE TABLE federation.federation_links (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    instance_id UUID NOT NULL REFERENCES federation.instances(id) ON DELETE CASCADE,
    status VARCHAR(50) DEFAULT 'pending',  -- pending, active, suspended, terminated
    initiated_by VARCHAR(50),  -- local, remote
    requested_at TIMESTAMP,
    accepted_at TIMESTAMP,
    terminated_at TIMESTAMP,
    policies JSONB DEFAULT '{}'::jsonb,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(instance_id)
);

-- Instance blocking (spam, abuse, etc.)
CREATE TABLE federation.blocked_instances (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    instance_domain VARCHAR(255) NOT NULL,
    blocked_by_instance BOOLEAN DEFAULT false,  -- Instance-wide block
    blocked_by_community UUID REFERENCES communities.communities(id),  -- Community-specific
    reason TEXT,
    blocked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    blocked_by_user UUID REFERENCES auth.users(id),
    expires_at TIMESTAMP,  -- Optional temporary block
    UNIQUE(instance_domain, blocked_by_community)
);

-- ============================================================================
-- Federated Users
-- ============================================================================

-- Cache of users from other instances
CREATE TABLE federation.federated_users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    federated_id VARCHAR(255) UNIQUE NOT NULL,  -- alice@seattle.karmyq.org
    local_id VARCHAR(255),  -- ID on their home instance
    home_instance_id UUID NOT NULL REFERENCES federation.instances(id),
    display_name VARCHAR(255),
    avatar_url TEXT,
    bio TEXT,
    public_profile JSONB DEFAULT '{}'::jsonb,
    federated_reputation JSONB DEFAULT '{}'::jsonb,
    last_synced_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Map federated users to local user records (for joined communities)
CREATE TABLE federation.federated_user_mappings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    federated_user_id UUID NOT NULL REFERENCES federation.federated_users(id),
    local_user_id UUID REFERENCES auth.users(id),  -- NULL if purely federated
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(federated_user_id)
);

-- ============================================================================
-- Federated Content
-- ============================================================================

-- Federated help requests (cached from other instances)
CREATE TABLE federation.federated_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    federated_id VARCHAR(255) UNIQUE NOT NULL,  -- req_123@seattle.karmyq.org
    local_id VARCHAR(255),  -- ID on origin instance
    origin_instance_id UUID NOT NULL REFERENCES federation.instances(id),
    requester_federated_id VARCHAR(255) NOT NULL,
    requester_display_name VARCHAR(255),
    community_federated_id VARCHAR(255),
    community_name VARCHAR(255),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    category VARCHAR(100),
    urgency VARCHAR(50),
    location JSONB,
    visibility VARCHAR(50) DEFAULT 'federated',
    status VARCHAR(50) DEFAULT 'open',
    created_at TIMESTAMP,
    expires_at TIMESTAMP,
    last_synced_at TIMESTAMP,
    signature TEXT NOT NULL,  -- Cryptographic signature from origin
    raw_data JSONB,  -- Full original payload
    CONSTRAINT fk_requester FOREIGN KEY (requester_federated_id) REFERENCES federation.federated_users(federated_id)
);

-- Federated communities (communities on other instances)
CREATE TABLE federation.federated_communities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    federated_id VARCHAR(255) UNIQUE NOT NULL,  -- capitol-hill@seattle.karmyq.org
    local_id VARCHAR(255),  -- ID on origin instance
    origin_instance_id UUID NOT NULL REFERENCES federation.instances(id),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    location JSONB,
    federation_mode VARCHAR(50),  -- local_only, discoverable, federated, open
    member_count INTEGER DEFAULT 0,
    created_at TIMESTAMP,
    last_synced_at TIMESTAMP,
    raw_data JSONB
);

-- ============================================================================
-- Activity Inbox/Outbox (ActivityPub-style)
-- ============================================================================

-- Incoming activities from federated instances
CREATE TABLE federation.inbox (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    activity_type VARCHAR(100) NOT NULL,  -- Create, Update, Delete, Offer, Accept, etc.
    actor VARCHAR(255) NOT NULL,  -- federated_id of actor
    object JSONB NOT NULL,
    origin_instance_id UUID REFERENCES federation.instances(id),
    received_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    processed BOOLEAN DEFAULT false,
    processed_at TIMESTAMP,
    signature TEXT NOT NULL,
    raw_payload JSONB NOT NULL,
    processing_error TEXT
);

-- Outgoing activities to federated instances
CREATE TABLE federation.outbox (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    activity_type VARCHAR(100) NOT NULL,
    actor VARCHAR(255) NOT NULL,  -- Local user's federated_id
    object JSONB NOT NULL,
    target_instances UUID[],  -- Array of instance IDs to send to
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    sent_at TIMESTAMP,
    signature TEXT,
    delivery_status JSONB DEFAULT '{}'::jsonb,  -- Per-instance delivery status
    retry_count INTEGER DEFAULT 0,
    last_retry_at TIMESTAMP
);

-- ============================================================================
-- Reputation & Attestations
-- ============================================================================

-- Signed reputation attestations from other instances
CREATE TABLE federation.reputation_attestations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    subject_federated_id VARCHAR(255) NOT NULL,
    attestor_instance_id UUID NOT NULL REFERENCES federation.instances(id),
    attestation JSONB NOT NULL,  -- Reputation data
    signature TEXT NOT NULL,
    public_key TEXT NOT NULL,
    calculated_at TIMESTAMP,
    received_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    verified BOOLEAN DEFAULT false,
    CONSTRAINT fk_subject FOREIGN KEY (subject_federated_id) REFERENCES federation.federated_users(federated_id)
);

-- ============================================================================
-- User Migration
-- ============================================================================

-- Track user migrations between instances
CREATE TABLE federation.user_migrations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id),
    old_federated_id VARCHAR(255),
    new_federated_id VARCHAR(255),
    old_instance_id UUID REFERENCES federation.instances(id),
    new_instance_id UUID REFERENCES federation.instances(id),
    migration_package JSONB,  -- Signed data package
    status VARCHAR(50) DEFAULT 'pending',  -- pending, verified, completed, failed
    requested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP,
    notes TEXT
);

-- ============================================================================
-- Indexes
-- ============================================================================

CREATE INDEX idx_instances_domain ON federation.instances(domain);
CREATE INDEX idx_instances_status ON federation.instances(status);
CREATE INDEX idx_federation_links_status ON federation.federation_links(status);
CREATE INDEX idx_federated_users_federated_id ON federation.federated_users(federated_id);
CREATE INDEX idx_federated_users_instance ON federation.federated_users(home_instance_id);
CREATE INDEX idx_federated_requests_origin ON federation.federated_requests(origin_instance_id);
CREATE INDEX idx_federated_requests_status ON federation.federated_requests(status);
CREATE INDEX idx_inbox_processed ON federation.inbox(processed);
CREATE INDEX idx_inbox_received ON federation.inbox(received_at);
CREATE INDEX idx_outbox_sent ON federation.outbox(sent_at);
CREATE INDEX idx_outbox_status ON federation.outbox((delivery_status->>'status'));

-- ============================================================================
-- Add Federation Columns to Existing Tables
-- ============================================================================

-- Add federated_id to users (for when they interact with federated instances)
ALTER TABLE auth.users
ADD COLUMN federated_id VARCHAR(255) UNIQUE,
ADD COLUMN allow_federation BOOLEAN DEFAULT true,
ADD COLUMN federation_privacy JSONB DEFAULT '{"profile_visibility": "federated", "activity_visibility": "federated", "reputation_visibility": "federated"}'::jsonb;

-- Add federation mode to communities
ALTER TABLE communities.communities
ADD COLUMN federation_mode VARCHAR(50) DEFAULT 'local_only',  -- local_only, discoverable, federated, open
ADD COLUMN accepts_federated_members BOOLEAN DEFAULT false,
ADD COLUMN federated_id VARCHAR(255) UNIQUE;

-- Add visibility to help requests
ALTER TABLE requests.help_requests
ADD COLUMN visibility VARCHAR(50) DEFAULT 'community',  -- private, community, instance, federated, public
ADD COLUMN federated_id VARCHAR(255) UNIQUE;

-- ============================================================================
-- Triggers
-- ============================================================================

-- Update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_local_instance_updated_at BEFORE UPDATE ON federation.local_instance
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_federation_links_updated_at BEFORE UPDATE ON federation.federation_links
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_federated_users_updated_at BEFORE UPDATE ON federation.federated_users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- Grants
-- ============================================================================

GRANT USAGE ON SCHEMA federation TO karmyq_user;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA federation TO karmyq_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA federation TO karmyq_user;

-- ============================================================================
-- Initial Data
-- ============================================================================

-- Create local instance record (to be populated during setup)
-- INSERT INTO federation.local_instance (domain, name, description)
-- VALUES ('localhost', 'KarmyQ Development Instance', 'Development instance');
