-- Migration 024: Prestige Badges (Phase 1)
-- ADR-016: Prestige-Based Recognition
-- Sprint 14

-- Badge types Phase 1:
--   first_helper   — first completed match as helper (responder)
--   milestone_10   — 10 completed matches as helper
--   milestone_50   — 50 completed matches as helper
--   milestone_100  — 100 completed matches as helper
--   connector      — helped 10+ distinct people

CREATE TABLE IF NOT EXISTS reputation.badges (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  community_id    UUID REFERENCES communities.communities(id) ON DELETE SET NULL,
  badge_type      TEXT NOT NULL,
  earned_at       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (user_id, badge_type)
);

-- Add columns idempotently in case table was created by a partial earlier run
DO
$body$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'reputation' AND table_name = 'badges' AND column_name = 'badge_type'
  ) THEN
    ALTER TABLE reputation.badges ADD COLUMN badge_type TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'reputation' AND table_name = 'badges' AND column_name = 'community_id'
  ) THEN
    ALTER TABLE reputation.badges ADD COLUMN community_id UUID REFERENCES communities.communities(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'reputation' AND table_name = 'badges' AND column_name = 'earned_at'
  ) THEN
    ALTER TABLE reputation.badges ADD COLUMN earned_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP;
  END IF;
END
$body$;

-- Ensure unique constraint exists
DO
$body2$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'badges_user_id_badge_type_key'
      AND conrelid = 'reputation.badges'::regclass
  ) THEN
    ALTER TABLE reputation.badges ADD CONSTRAINT badges_user_id_badge_type_key UNIQUE (user_id, badge_type);
  END IF;
END
$body2$;

CREATE INDEX IF NOT EXISTS idx_badges_user_id ON reputation.badges (user_id);
CREATE INDEX IF NOT EXISTS idx_badges_badge_type ON reputation.badges (badge_type);
