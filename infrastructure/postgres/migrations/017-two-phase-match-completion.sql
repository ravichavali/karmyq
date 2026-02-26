-- Migration 017: Two-phase match completion
--
-- Previously, the first party to click "Done" immediately set status='completed',
-- removing the match from both users' views before the second party could rate.
-- This adds per-party completion timestamps so each party's Done action is
-- recorded independently; the match only becomes 'completed' when both confirm.

ALTER TABLE requests.matches
  ADD COLUMN IF NOT EXISTS requester_done_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS responder_done_at TIMESTAMP;

-- Index to efficiently query matches where one party has confirmed but not both
-- (used by the complete endpoint to check transition condition)
CREATE INDEX IF NOT EXISTS idx_matches_partial_completion
  ON requests.matches (status, requester_done_at, responder_done_at)
  WHERE status = 'matched';
