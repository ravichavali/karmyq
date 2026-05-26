-- 009-governance-schema.sql
-- Trust-Gated Governance: governance settings, nominations, and ratifications

-- Governance config on communities
ALTER TABLE communities.communities
  ADD COLUMN IF NOT EXISTS governance_settings JSONB
  NOT NULL DEFAULT '{"eligibility_threshold": 50, "quorum_size": 3, "template": "small-collective"}'::jsonb;

-- Nominations
CREATE TABLE IF NOT EXISTS communities.governance_nominations (
  id                     UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id           UUID        NOT NULL REFERENCES communities.communities(id) ON DELETE CASCADE,
  nominated_user_id      UUID        NOT NULL REFERENCES auth.users(id),
  nominated_for_role     VARCHAR(50) NOT NULL,
  nominator_id           UUID        NOT NULL REFERENCES auth.users(id),
  status                 VARCHAR(20) NOT NULL DEFAULT 'pending',
  required_ratifications INT         NOT NULL DEFAULT 3,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at            TIMESTAMPTZ,
  CONSTRAINT valid_nomination_status CHECK (status IN ('pending', 'ratified', 'rejected', 'withdrawn'))
);

CREATE INDEX IF NOT EXISTS idx_governance_nominations_community
  ON communities.governance_nominations(community_id);

-- Ratifications (PK prevents duplicate ratifier per nomination)
CREATE TABLE IF NOT EXISTS communities.governance_ratifications (
  nomination_id UUID        NOT NULL REFERENCES communities.governance_nominations(id) ON DELETE CASCADE,
  ratifier_id   UUID        NOT NULL REFERENCES auth.users(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (nomination_id, ratifier_id)
);
