-- Sprint 133 PR B / ADR-100: a member vouches for a co-member's skill after a completed match.
CREATE TABLE IF NOT EXISTS auth.skill_endorsements (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  endorser_id   uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endorsee_id   uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_tag_id   uuid NOT NULL REFERENCES auth.user_tags(id) ON DELETE CASCADE,
  -- requests.matches(id) of the qualifying completed match. No cross-schema FK (schema ownership).
  match_id      uuid NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  withdrawn_at  timestamptz,
  -- Monotonic per-row change counter; the event job id is endorsement-<id>-r<revision>.
  revision      bigint NOT NULL DEFAULT 1,
  CONSTRAINT skill_endorsements_not_self CHECK (endorser_id <> endorsee_id),
  CONSTRAINT skill_endorsements_one_per_tag UNIQUE (endorser_id, user_tag_id)
);
CREATE INDEX IF NOT EXISTS idx_skill_endorsements_pair
  ON auth.skill_endorsements (endorser_id, endorsee_id) WHERE withdrawn_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_skill_endorsements_tag
  ON auth.skill_endorsements (user_tag_id) WHERE withdrawn_at IS NULL;
