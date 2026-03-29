-- Add dibs_pending status and scheduled_for column to help_requests
-- Sprint 42: Dibs Request Feature

ALTER TYPE request_status_enum ADD VALUE IF NOT EXISTS 'dibs_pending' AFTER 'open';

ALTER TABLE requests.help_requests
  ADD COLUMN IF NOT EXISTS scheduled_for TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_help_requests_scheduled_for
  ON requests.help_requests(scheduled_for)
  WHERE scheduled_for IS NOT NULL;
