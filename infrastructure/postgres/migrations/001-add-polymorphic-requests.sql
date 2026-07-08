-- Migration: Add polymorphic request support (v9.0)
-- Adds request_type, payload, requirements columns for flexible request types
-- Adds privacy columns for Social Karma v2.0

\c karmyq_prod;

-- Add polymorphic request columns
ALTER TABLE requests.help_requests
  ADD COLUMN IF NOT EXISTS request_type VARCHAR(50) DEFAULT 'generic',
  ADD COLUMN IF NOT EXISTS payload JSONB DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS requirements JSONB DEFAULT '{}';

-- Add privacy columns (Social Karma v2.0)
ALTER TABLE requests.help_requests
  ADD COLUMN IF NOT EXISTS is_public BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS requester_visibility_consent BOOLEAN DEFAULT false;

-- Create index on request_type for filtering
CREATE INDEX IF NOT EXISTS idx_help_requests_type ON requests.help_requests(request_type);

-- Create index on is_public for privacy queries
CREATE INDEX IF NOT EXISTS idx_help_requests_public ON requests.help_requests(is_public);

-- Backfill request_type from category for existing data. Guarded: this is v9.0-era repair that
-- only makes sense while request_type is still the VARCHAR this migration created. On a schema
-- where request_type has since become request_type_enum (init.sql-seeded DBs), the raw UPDATE is a
-- type error at parse time — and pouring mixed-vocab category values (enum tokens on new rows,
-- skill tokens on old, see ADR-067) into the enum would be wrong anyway. PL/pgSQL only plans the
-- inner UPDATE when the branch is taken, so the enum schema never even parses it.
DO $$
BEGIN
  IF (SELECT data_type FROM information_schema.columns
      WHERE table_schema = 'requests' AND table_name = 'help_requests'
        AND column_name = 'request_type') = 'character varying' THEN
    UPDATE requests.help_requests
    SET request_type = category
    WHERE request_type IS NULL OR request_type = 'generic';
  END IF;
END $$;

COMMENT ON COLUMN requests.help_requests.request_type IS 'Type of request: generic, ride, borrow, service, event';
COMMENT ON COLUMN requests.help_requests.payload IS 'Type-specific data (pickup/dropoff for rides, item details for borrows, etc)';
COMMENT ON COLUMN requests.help_requests.requirements IS 'Requirements for helpers (skills, equipment, time commitment)';
COMMENT ON COLUMN requests.help_requests.is_public IS 'Whether request is visible to non-members';
COMMENT ON COLUMN requests.help_requests.requester_visibility_consent IS 'Whether requester consents to identity being shown';
