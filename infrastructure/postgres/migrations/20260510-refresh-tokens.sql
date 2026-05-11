-- Sprint 54: Add refresh token table for JWT rotation (ADR-052)

BEGIN;

CREATE TABLE IF NOT EXISTS auth.refresh_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token_hash VARCHAR(64) NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  revoked BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id
  ON auth.refresh_tokens(user_id);

CREATE INDEX IF NOT EXISTS idx_refresh_tokens_token_hash
  ON auth.refresh_tokens(token_hash);

COMMIT;
