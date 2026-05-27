-- Sprint 69: Fission Mechanism
-- Creates three tables for the community split lifecycle

CREATE TABLE IF NOT EXISTS communities.split_proposals (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id         UUID NOT NULL REFERENCES communities.communities(id),
  proposed_by          UUID NOT NULL REFERENCES auth.users(id),
  split_type           TEXT NOT NULL CHECK (split_type IN ('size_threshold', 'admin_initiated')),
  rationale            TEXT,
  group_a_name         TEXT NOT NULL,
  group_b_name         TEXT NOT NULL,
  status               TEXT NOT NULL DEFAULT 'discussion'
                         CHECK (status IN ('discussion', 'voting', 'approved', 'rejected', 'executed')),
  quorum_pct           INTEGER NOT NULL DEFAULT 60,
  approval_pct         INTEGER NOT NULL DEFAULT 60,
  discussion_ends_at   TIMESTAMPTZ,
  voting_ends_at       TIMESTAMPTZ,
  executed_at          TIMESTAMPTZ,
  child_community_a_id UUID REFERENCES communities.communities(id),
  child_community_b_id UUID REFERENCES communities.communities(id),
  created_at           TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (community_id, status)
);

CREATE TABLE IF NOT EXISTS communities.split_votes (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id     UUID NOT NULL REFERENCES communities.split_proposals(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES auth.users(id),
  vote            TEXT NOT NULL CHECK (vote IN ('yes', 'no', 'abstain')),
  prestige_weight NUMERIC(8,2) NOT NULL DEFAULT 1.0,
  voted_at        TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (proposal_id, user_id)
);

CREATE TABLE IF NOT EXISTS communities.split_member_assignments (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id        UUID NOT NULL REFERENCES communities.split_proposals(id) ON DELETE CASCADE,
  user_id            UUID NOT NULL REFERENCES auth.users(id),
  assigned_to        TEXT NOT NULL DEFAULT 'unassigned'
                       CHECK (assigned_to IN ('group_a', 'group_b', 'unassigned')),
  cluster_suggestion TEXT CHECK (cluster_suggestion IN ('group_a', 'group_b')),
  admin_overridden   BOOLEAN NOT NULL DEFAULT FALSE,
  created_at         TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (proposal_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_split_proposals_community ON communities.split_proposals(community_id);
CREATE INDEX IF NOT EXISTS idx_split_votes_proposal ON communities.split_votes(proposal_id);
CREATE INDEX IF NOT EXISTS idx_split_assignments_proposal ON communities.split_member_assignments(proposal_id);
