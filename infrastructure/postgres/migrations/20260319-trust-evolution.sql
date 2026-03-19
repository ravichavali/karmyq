-- infrastructure/postgres/migrations/20260319-trust-evolution.sql
-- Sprint 30: Individual Trust Evolution Layer (ADR-046)
-- Core principle: accuracy over direction — the system calibrates toward reality, not a preferred value.

-- 1. Add community-level evolution flags to existing community_configs
ALTER TABLE communities.community_configs
  ADD COLUMN IF NOT EXISTS community_evolution_enabled BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS cross_community_prior DECIMAL(3,2) DEFAULT 0.50;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.constraint_column_usage
    WHERE constraint_name = 'chk_community_cross_community_prior'
  ) THEN
    ALTER TABLE communities.community_configs
      ADD CONSTRAINT chk_community_cross_community_prior
        CHECK (cross_community_prior BETWEEN 0.05 AND 0.95);
  END IF;
END$$;

-- 2. Per-user trust config (one row per user per community)
CREATE TABLE IF NOT EXISTS reputation.user_trust_configs (
  user_id            UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  community_id       UUID NOT NULL REFERENCES communities.communities(id) ON DELETE CASCADE,
  depth_weight       DECIMAL(3,2) DEFAULT NULL
                       CONSTRAINT chk_utc_depth CHECK (depth_weight IS NULL OR depth_weight BETWEEN 0.10 AND 0.90),
  breadth_weight     DECIMAL(3,2) DEFAULT NULL
                       CONSTRAINT chk_utc_breadth CHECK (breadth_weight IS NULL OR breadth_weight BETWEEN 0.10 AND 0.90),
  cross_community_prior DECIMAL(3,2) NOT NULL DEFAULT 0.50
                       CONSTRAINT chk_utc_prior CHECK (cross_community_prior BETWEEN 0.05 AND 0.95),
  evolution_enabled  BOOLEAN NOT NULL DEFAULT FALSE,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, community_id)
);

CREATE INDEX IF NOT EXISTS idx_utc_user ON reputation.user_trust_configs(user_id);
CREATE INDEX IF NOT EXISTS idx_utc_comm ON reputation.user_trust_configs(community_id);

-- 3. Immutable evolution audit log
CREATE TABLE IF NOT EXISTS reputation.user_trust_evolution_log (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  community_id     UUID NOT NULL REFERENCES communities.communities(id) ON DELETE CASCADE,
  parameter        VARCHAR(50) NOT NULL,
  old_value        DECIMAL(3,2),
  new_value        DECIMAL(3,2) NOT NULL,
  trigger_signal   VARCHAR(100) NOT NULL,
  trigger_event_id UUID,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Composite index: covers cooldown lookups (user, community, parameter, created_at)
-- and history pagination (user, community, created_at)
CREATE INDEX IF NOT EXISTS idx_utel_user_comm_param_created
  ON reputation.user_trust_evolution_log (user_id, community_id, parameter, created_at DESC);
