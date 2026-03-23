-- Sprint 36: Admin boost capability for help_requests
-- Migration: 20260322-request-boost.sql

ALTER TABLE requests.help_requests
  ADD COLUMN IF NOT EXISTS is_boosted BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS boosted_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS boosted_expires_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS boosted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_requests_is_boosted
  ON requests.help_requests (is_boosted, boosted_expires_at)
  WHERE is_boosted = TRUE;
