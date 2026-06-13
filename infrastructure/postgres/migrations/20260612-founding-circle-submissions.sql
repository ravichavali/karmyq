-- 20260612-founding-circle-submissions.sql
-- Sprint 96 (ADR-076): Founding-circle backend intake.
-- Public, unauthenticated landing-page submissions captured into a review queue we own.
-- Pre-account leads: no FK to auth.users by design.

-- uuid_generate_v4() requires uuid-ossp (init.sql installs it for fresh DBs;
-- guard here so the incremental migration also applies on a DB that lacks it).
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS auth.founding_circle_submissions (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email         VARCHAR(320) NOT NULL,          -- RFC 5321 max length
  lens          VARCHAR(200),
  contribution  TEXT,                            -- app-level cap 4000 chars
  concern       TEXT,                            -- app-level cap 4000 chars
  source_page   VARCHAR(64)  NOT NULL DEFAULT 'join',
  status        VARCHAR(24)  NOT NULL DEFAULT 'new',  -- new | reviewed | contacted | archived
  created_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  reviewed_at   TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_founding_circle_status_created
  ON auth.founding_circle_submissions (status, created_at DESC);
