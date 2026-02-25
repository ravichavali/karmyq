-- Migration 016: Match Fulfillment — scheduled_at and travel_time_minutes
-- ADR-033 Phase 1: Type-aware post-accept workflow
-- Allows storing when a match is scheduled and helper's travel time to pickup

ALTER TABLE requests.matches
  ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS travel_time_minutes INTEGER DEFAULT 60;

-- Index for efficient reminder scanning (cron job queries by scheduled_at)
CREATE INDEX IF NOT EXISTS idx_matches_scheduled_at
  ON requests.matches(scheduled_at)
  WHERE scheduled_at IS NOT NULL AND status = 'matched';

COMMENT ON COLUMN requests.matches.scheduled_at IS 'When the match is scheduled (e.g. ride departure_time). Set from request payload on accept.';
COMMENT ON COLUMN requests.matches.travel_time_minutes IS 'Minutes helper needs to travel to pickup/start location. Used to time departure reminder.';
