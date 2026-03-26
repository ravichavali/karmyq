-- 20260326-provider-offers.sql
-- Sprint 41: Provider offers table for the offer submission flow
-- Separate from requests.matches — represents a commercial offer with pricing
-- Statuses: pending (awaiting requester decision), accepted (requester accepted),
--           declined (requester declined), withdrawn (provider withdrew)

-- Create provider schema if it doesn't exist
CREATE SCHEMA IF NOT EXISTS provider;

-- Main offers table
CREATE TABLE IF NOT EXISTS provider.offers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id UUID NOT NULL,
  provider_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  request_id UUID NOT NULL REFERENCES requests.help_requests(id) ON DELETE CASCADE,
  price NUMERIC(10,2),
  note TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'accepted', 'declined', 'withdrawn')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_provider_offers_provider_user
  ON provider.offers(provider_user_id);
CREATE INDEX IF NOT EXISTS idx_provider_offers_request
  ON provider.offers(request_id);
CREATE INDEX IF NOT EXISTS idx_provider_offers_status
  ON provider.offers(status);
