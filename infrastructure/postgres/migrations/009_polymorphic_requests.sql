-- Migration 009: Polymorphic Request Model for "Everything App"
-- Date: 2024-12-24
-- Description: Add request_type discriminator and JSONB payload for specialized request types
--              (rides, borrow, services, events) while maintaining backward compatibility

-- 1. Create the Enum type for request discrimination
CREATE TYPE request_type_enum AS ENUM ('generic', 'ride', 'borrow', 'service', 'event');

-- 2. Alter the table to add specialization columns
ALTER TABLE requests.help_requests
ADD COLUMN request_type request_type_enum NOT NULL DEFAULT 'generic',
ADD COLUMN payload JSONB DEFAULT '{}'::jsonb,
ADD COLUMN requirements JSONB DEFAULT '{}'::jsonb;

-- 3. Add helpful comment
COMMENT ON COLUMN requests.help_requests.request_type IS 'Discriminator for polymorphic request types (generic, ride, borrow, service, event)';
COMMENT ON COLUMN requests.help_requests.payload IS 'Type-specific data (e.g., ride origin/destination, borrow duration)';
COMMENT ON COLUMN requests.help_requests.requirements IS 'Type-specific requirements (e.g., verified driver license for rides)';

-- 4. Create indexes for fast searching
CREATE INDEX idx_requests_payload ON requests.help_requests USING GIN (payload);
CREATE INDEX idx_requests_type ON requests.help_requests(request_type);

-- 5. Verify migration
DO $$
BEGIN
  -- Check that all existing requests are set to 'generic'
  ASSERT (SELECT COUNT(*) FROM requests.help_requests WHERE request_type IS NULL) = 0,
    'All requests should have a request_type';

  ASSERT (SELECT COUNT(*) FROM requests.help_requests WHERE request_type = 'generic') = (SELECT COUNT(*) FROM requests.help_requests),
    'All existing requests should be generic type';

  RAISE NOTICE 'Migration 009 completed successfully';
END $$;
