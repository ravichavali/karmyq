-- Migration: Add user skills and community access control
-- Date: 2025-11-05

-- Add skills table for users
CREATE TABLE IF NOT EXISTS auth.user_skills (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    skill VARCHAR(100) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, skill)
);

CREATE INDEX IF NOT EXISTS idx_user_skills_user_id ON auth.user_skills(user_id);
CREATE INDEX IF NOT EXISTS idx_user_skills_skill ON auth.user_skills(skill);

-- Add access_type to communities (public/private)
ALTER TABLE communities.communities
ADD COLUMN IF NOT EXISTS access_type VARCHAR(20) DEFAULT 'public' CHECK (access_type IN ('public', 'private'));

-- Add status to community members table for pending join requests
-- Already has status field, just need to add index
CREATE INDEX IF NOT EXISTS idx_members_status ON communities.members(status);

-- Add join_request_message field to members for pending requests
ALTER TABLE communities.members
ADD COLUMN IF NOT EXISTS join_request_message TEXT;

COMMENT ON COLUMN communities.communities.access_type IS 'public: anyone can join, private: requires approval';
COMMENT ON COLUMN communities.members.status IS 'active: member, pending: awaiting approval, invited: has invite';
COMMENT ON COLUMN communities.members.join_request_message IS 'Message included with join request';
