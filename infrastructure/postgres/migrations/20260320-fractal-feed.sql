-- Sprint 32: Global evolution preference for users
-- ADR-046: Fractal Feed — user-level global opt-out for trust evolution

CREATE TABLE IF NOT EXISTS reputation.user_trust_preferences (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  global_evolution_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
