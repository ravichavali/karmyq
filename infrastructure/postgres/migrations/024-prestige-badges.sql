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
  community_id    UUID REFERENCES community.communities(id) ON DELETE SET NULL,
  badge_type      TEXT NOT NULL,
  earned_at       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (user_id, badge_type)   -- one badge per type per user (global, not per-community for Phase 1)
);

CREATE INDEX IF NOT EXISTS idx_badges_user_id ON reputation.badges (user_id);
CREATE INDEX IF NOT EXISTS idx_badges_badge_type ON reputation.badges (badge_type);
