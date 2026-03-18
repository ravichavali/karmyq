-- 20260318-rate-cards.sql
-- Sprint 29: Add rate cards table and preferred_provider_id to help_requests

CREATE TABLE IF NOT EXISTS requests.provider_rate_cards (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id    UUID NOT NULL REFERENCES requests.provider_profiles(id) ON DELETE CASCADE,
  label          VARCHAR(100) NOT NULL,
  service_type   TEXT,
  pricing_model  TEXT NOT NULL DEFAULT 'standard',
  rate_amount    NUMERIC(10,2),
  rate_unit      TEXT,
  currency       CHAR(3) NOT NULL DEFAULT 'USD',
  notes          TEXT,
  is_active      BOOLEAN NOT NULL DEFAULT TRUE,
  created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT chk_pricing_model CHECK (pricing_model IN ('standard', 'free', 'negotiable')),
  CONSTRAINT chk_standard_rate CHECK (
    pricing_model != 'standard' OR (rate_amount IS NOT NULL AND rate_unit IS NOT NULL)
  ),
  CONSTRAINT chk_nonstandard_rate CHECK (
    pricing_model = 'standard' OR (rate_amount IS NULL AND rate_unit IS NULL)
  ),
  CONSTRAINT chk_rate_unit CHECK (
    rate_unit IS NULL OR rate_unit IN ('per_hour', 'per_session', 'per_trip', 'flat_rate')
  ),
  CONSTRAINT chk_rate_amount CHECK (rate_amount IS NULL OR rate_amount >= 0)
);

CREATE INDEX IF NOT EXISTS idx_provider_rate_cards_provider_id ON requests.provider_rate_cards(provider_id);
CREATE INDEX IF NOT EXISTS idx_provider_rate_cards_service_type ON requests.provider_rate_cards(service_type);

ALTER TABLE requests.help_requests
  ADD COLUMN IF NOT EXISTS preferred_provider_id UUID;

ALTER TABLE requests.help_requests
  ADD CONSTRAINT IF NOT EXISTS fk_help_requests_preferred_provider
    FOREIGN KEY (preferred_provider_id)
    REFERENCES requests.provider_profiles(id)
    ON DELETE SET NULL;
