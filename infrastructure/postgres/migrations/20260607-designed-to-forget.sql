-- 20260607-designed-to-forget.sql
-- Sprint 90: Designed to Forget
-- Makes the "designed to forget" promise real for content: a retention policy that anonymizes
-- completed-exchange free-text to sentinels, hard-deletes expired/unmatched requests, and cascade-
-- forgets messages with their parent exchange. Aggregates (matches, karma_records) are left intact.
--
-- Every statement is idempotent (IF NOT EXISTS / guarded inserts) so this can be re-run safely.
-- Mirrors the social_graph.trust_decay_config precedent (cross-schema FK to communities.communities,
-- NULL community_id = global default row).

-- 1. Retention config (mirrors social_graph.trust_decay_config).
--    NOTE: a bare UNIQUE(community_id) does NOT prevent duplicate NULL global rows in Postgres
--    (NULLs are distinct), so ON CONFLICT won't fire on re-run. A partial unique index on the NULL
--    row + a WHERE NOT EXISTS guarded insert make the migration truly idempotent.
CREATE TABLE IF NOT EXISTS requests.retention_config (
  id                            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id                  UUID REFERENCES communities.communities(id) ON DELETE CASCADE,
  completed_request_window_days INT NOT NULL DEFAULT 180,
  expired_request_window_days   INT NOT NULL DEFAULT 30,
  message_window_days           INT NOT NULL DEFAULT 180,
  created_at                    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(community_id)  -- guards per-community rows (non-null)
);

-- Enforce a single global (NULL) row — bare UNIQUE can't (Postgres treats NULLs as distinct).
CREATE UNIQUE INDEX IF NOT EXISTS uq_retention_config_global
  ON requests.retention_config ((community_id IS NULL)) WHERE community_id IS NULL;

-- Seed the global default row, idempotently (ON CONFLICT can't target the NULL row).
INSERT INTO requests.retention_config (community_id)
SELECT NULL
WHERE NOT EXISTS (SELECT 1 FROM requests.retention_config WHERE community_id IS NULL);

-- 2. Forgetting markers (anonymization stamps — content is sentinelled, stamp records WHEN).
--    Karma is intentionally NOT included: karma_records has no PII and its reason is a load-bearing enum.
ALTER TABLE requests.help_requests ADD COLUMN IF NOT EXISTS content_forgotten_at TIMESTAMPTZ NULL;
ALTER TABLE messaging.messages     ADD COLUMN IF NOT EXISTS forgotten_at         TIMESTAMPTZ NULL;

-- 3. Partial indexes so each sweep only scans not-yet-forgotten rows.
CREATE INDEX IF NOT EXISTS idx_help_requests_not_forgotten
  ON requests.help_requests (updated_at) WHERE content_forgotten_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_messages_not_forgotten
  ON messaging.messages (created_at) WHERE forgotten_at IS NULL;
