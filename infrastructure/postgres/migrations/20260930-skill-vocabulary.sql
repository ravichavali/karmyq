-- Sprint 132 PR A / ADR-099: one skill store, with an exact-match vocabulary.
-- Keep seed rows identical to seed-data.sql: fresh installs skip applied migrations.
CREATE TABLE IF NOT EXISTS auth.skill_vocabulary (
  slug VARCHAR(50) PRIMARY KEY,
  label VARCHAR(100) NOT NULL,
  synonyms TEXT[] NOT NULL DEFAULT '{}'
);

INSERT INTO auth.skill_vocabulary (slug, label, synonyms) VALUES
  ('driving', 'Driving', ARRAY['driving']::text[]),
  ('moving', 'Moving', ARRAY['moving help']::text[]),
  ('childcare', 'Childcare', ARRAY['childcare']::text[]),
  ('pet_care', 'Pet care', ARRAY['pet care']::text[]),
  ('tech_support', 'Tech support', ARRAY[]::text[]),
  ('coding', 'Coding', ARRAY[]::text[]),
  ('home_repair', 'Home repair', ARRAY[]::text[]),
  ('handyman', 'Handyman', ARRAY[]::text[]),
  ('electrical', 'Electrical', ARRAY['electrical']::text[]),
  ('plumbing', 'Plumbing', ARRAY['plumbing']::text[]),
  ('carpentry', 'Carpentry', ARRAY['carpentry']::text[]),
  ('gardening', 'Gardening', ARRAY['gardening']::text[]),
  ('cooking', 'Cooking', ARRAY['cooking']::text[]),
  ('baking', 'Baking', ARRAY[]::text[]),
  ('tutoring', 'Tutoring', ARRAY['spanish tutoring']::text[]),
  ('languages', 'Languages', ARRAY[]::text[]),
  ('career_advice', 'Career advice', ARRAY[]::text[]),
  ('design', 'Design', ARRAY['web design']::text[]),
  ('writing', 'Writing', ARRAY[]::text[]),
  ('photography', 'Photography', ARRAY['photography']::text[]),
  ('music', 'Music', ARRAY['music lessons']::text[]),
  ('art', 'Art', ARRAY[]::text[]),
  ('cleaning', 'Cleaning', ARRAY[]::text[]),
  ('organizing', 'Organizing', ARRAY[]::text[]),
  ('elder_care', 'Elder care', ARRAY[]::text[]),
  ('bookkeeping', 'Bookkeeping', ARRAY[]::text[])
ON CONFLICT (slug) DO NOTHING;

ALTER TABLE auth.user_tags
  ADD COLUMN IF NOT EXISTS skill_slug VARCHAR(50) NULL REFERENCES auth.skill_vocabulary(slug);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'user_tags_skill_slug_only_on_skills'
      AND conrelid = 'auth.user_tags'::regclass
  ) THEN
    ALTER TABLE auth.user_tags ADD CONSTRAINT user_tags_skill_slug_only_on_skills
      CHECK (skill_slug IS NULL OR tag_type = 'skill');
  END IF;
END $$;

-- Resolve existing free-text skill tags without substring matching.
WITH normalized_tags AS (
  SELECT id, lower(trim(regexp_replace(tag_value, '[[:space:]]+', ' ', 'g'))) AS value
  FROM auth.user_tags WHERE tag_type = 'skill' AND skill_slug IS NULL
)
UPDATE auth.user_tags t SET skill_slug = v.slug FROM auth.skill_vocabulary v
 JOIN normalized_tags n ON replace(n.value, ' ', '_') = v.slug
   OR n.value = lower(v.label) OR n.value = ANY (v.synonyms)
 WHERE t.id = n.id;

-- The legacy API accepted arbitrary text. Preserve unresolved selections too, and
-- resolve known labels/synonyms now so a rerun cannot change a newly imported tag.
WITH normalized_legacy AS (
  SELECT user_id, skill, lower(trim(regexp_replace(skill, '[[:space:]]+', ' ', 'g'))) AS value
  FROM auth.user_skills
)
INSERT INTO auth.user_tags (user_id, tag_type, tag_value, skill_slug)
SELECT s.user_id, 'skill', COALESCE(v.label, s.skill), v.slug
  FROM normalized_legacy s LEFT JOIN auth.skill_vocabulary v
    ON v.slug = replace(s.value, ' ', '_') OR lower(v.label) = s.value OR s.value = ANY (v.synonyms)
ON CONFLICT ON CONSTRAINT user_tags_unique DO NOTHING;

COMMENT ON TABLE auth.user_skills IS 'DEPRECATED Sprint 132 (ADR-099): superseded by auth.user_tags '
  '(tag_type=skill, skill_slug). Kept only so an image rollback still boots; drop in a later sprint.';
