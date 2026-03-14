-- Sprint 26: Add availability toggle to provider profiles
-- Providers can self-report availability to communities browsing collectives

ALTER TABLE requests.provider_profiles
  ADD COLUMN IF NOT EXISTS is_available BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_provider_profiles_is_available
  ON requests.provider_profiles(is_available)
  WHERE is_active = TRUE;
