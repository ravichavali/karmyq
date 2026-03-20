-- infrastructure/postgres/migrations/20260320-community-evolution.sql
-- Sprint 31: Community Evolution Engine (ADR-047)
-- Core principle: communities evolve from collective member experience, not by admin decree.

-- 1. Flip evolution defaults: opt-out instead of opt-in
ALTER TABLE reputation.user_trust_configs
  ALTER COLUMN evolution_enabled SET DEFAULT TRUE;

-- Update existing rows (demo data design reset — intentional)
UPDATE reputation.user_trust_configs SET evolution_enabled = TRUE;

ALTER TABLE communities.community_configs
  ALTER COLUMN community_evolution_enabled SET DEFAULT TRUE;

UPDATE communities.community_configs SET community_evolution_enabled = TRUE;

-- 2. Community evolution audit log
CREATE TABLE IF NOT EXISTS reputation.community_evolution_log (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id              UUID NOT NULL REFERENCES communities.communities(id) ON DELETE CASCADE,
  parameter                 VARCHAR(50) NOT NULL,
  old_value                 DECIMAL(6,2) NOT NULL,
  new_value                 DECIMAL(6,2) NOT NULL,
  aggregate_delta           DECIMAL(6,2) NOT NULL,
  contributing_member_count INTEGER NOT NULL,
  interaction_rate_snapshot DECIMAL(6,2),
  damping_applied           DECIMAL(3,2) NOT NULL DEFAULT 1.00,
  applied_at                TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cel_community_applied
  ON reputation.community_evolution_log (community_id, applied_at DESC);
