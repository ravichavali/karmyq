CREATE TABLE IF NOT EXISTS auth.user_tags (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tag_type    VARCHAR(20) NOT NULL CHECK (tag_type IN ('skill', 'interest', 'need')),
  tag_value   VARCHAR(100) NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT user_tags_unique UNIQUE (user_id, tag_type, tag_value)
);

CREATE INDEX IF NOT EXISTS idx_user_tags_user_id ON auth.user_tags(user_id);
