-- infrastructure/postgres/migrations/20260407-group-communities.sql
-- Sprint 47: Group Communities (ADR-050)

BEGIN;

-- 1. Add community_type to existing communities table
ALTER TABLE communities.communities
  ADD COLUMN IF NOT EXISTS community_type VARCHAR(50) NOT NULL DEFAULT 'mutual_aid';

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'chk_community_type'
      AND table_schema = 'communities'
  ) THEN
    ALTER TABLE communities.communities
      ADD CONSTRAINT chk_community_type
      CHECK (community_type IN ('mutual_aid', 'group'));
  END IF;
END$$;

-- 2. Activities table
CREATE TABLE IF NOT EXISTS communities.activities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    community_id UUID NOT NULL REFERENCES communities.communities(id) ON DELETE CASCADE,
    created_by UUID NOT NULL REFERENCES auth.users(id),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    activity_type VARCHAR(100) NOT NULL DEFAULT 'other',
    scheduled_at TIMESTAMPTZ NOT NULL,
    duration_minutes INTEGER,
    location TEXT,
    latitude NUMERIC(10,7),
    longitude NUMERIC(10,7),
    max_participants INTEGER,
    current_participants INTEGER DEFAULT 0,
    status VARCHAR(50) NOT NULL DEFAULT 'open',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_activity_status CHECK (status IN ('open', 'cancelled', 'completed')),
    CONSTRAINT chk_activity_type CHECK (activity_type IN ('pickup_game', 'group_run', 'workout', 'social', 'other'))
);

-- 3. Activity participants table
CREATE TABLE IF NOT EXISTS communities.activity_participants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    activity_id UUID NOT NULL REFERENCES communities.activities(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(activity_id, user_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_activities_community_id ON communities.activities(community_id);
CREATE INDEX IF NOT EXISTS idx_activities_scheduled_at ON communities.activities(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_activities_status ON communities.activities(status);
CREATE INDEX IF NOT EXISTS idx_activity_participants_activity_id ON communities.activity_participants(activity_id);
CREATE INDEX IF NOT EXISTS idx_activity_participants_user_id ON communities.activity_participants(user_id);

COMMIT;
