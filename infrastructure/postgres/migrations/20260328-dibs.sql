-- Create dibs table for Sprint 42 Dibs Request feature
-- Allows requesters to give one trusted provider first right of refusal

CREATE TABLE IF NOT EXISTS requests.dibs (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id       UUID NOT NULL REFERENCES requests.help_requests(id) ON DELETE CASCADE,
  requester_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status           TEXT NOT NULL DEFAULT 'pending'
                     CHECK (status IN ('pending', 'accepted', 'declined', 'expired')),
  expires_at       TIMESTAMPTZ NOT NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_dibs_request_id UNIQUE(request_id)
);

CREATE INDEX IF NOT EXISTS idx_dibs_provider_pending
  ON requests.dibs(provider_user_id) WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_dibs_expires_at
  ON requests.dibs(expires_at) WHERE status = 'pending';
