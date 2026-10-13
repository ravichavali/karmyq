-- Sprint 133 PR A / ADR-100: opt-out skill sharing with active co-members.
ALTER TABLE auth.user_privacy_settings
  ADD COLUMN IF NOT EXISTS share_skills_with_communities boolean NOT NULL DEFAULT true;

CREATE INDEX IF NOT EXISTS idx_user_tags_skill_slug
  ON auth.user_tags (skill_slug) WHERE tag_type = 'skill';

-- Superseded by auth.user_tags in Sprint 132. The current and rollback images do not read it.
DROP TABLE IF EXISTS auth.user_skills;
