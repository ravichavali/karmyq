-- Sprint 70: Fusion Mechanism
-- Adds fusion_proposals + fusion_votes tables, extends community_links link_type

-- 1. Extend community_links to support fusion_origin
ALTER TABLE communities.community_links DROP CONSTRAINT IF EXISTS community_links_link_type_check;
ALTER TABLE communities.community_links ADD CONSTRAINT community_links_link_type_check
  CHECK (link_type IN ('sister', 'parent_child', 'split_origin', 'fusion_origin'));

-- 2. Fusion proposals
CREATE TABLE IF NOT EXISTS communities.fusion_proposals (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  community_a_id        UUID NOT NULL REFERENCES communities.communities(id),
  community_b_id        UUID NOT NULL REFERENCES communities.communities(id),
  proposed_by           UUID NOT NULL REFERENCES auth.users(id),
  merged_community_name TEXT NOT NULL,
  rationale             TEXT,
  status                TEXT NOT NULL DEFAULT 'pending_acceptance'
                          CHECK (status IN (
                            'pending_acceptance', 'discussion', 'voting',
                            'approved', 'rejected', 'executed'
                          )),
  quorum_pct            INTEGER NOT NULL DEFAULT 60,
  approval_pct          INTEGER NOT NULL DEFAULT 60,
  accepted_by           UUID REFERENCES auth.users(id),
  voting_ends_at        TIMESTAMPTZ,
  executed_at           TIMESTAMPTZ,
  merged_community_id   UUID REFERENCES communities.communities(id),
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  CHECK (community_a_id <> community_b_id)
);

-- 3. Fusion votes (community-scoped so parallel tallies work)
CREATE TABLE IF NOT EXISTS communities.fusion_votes (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id     UUID NOT NULL REFERENCES communities.fusion_proposals(id) ON DELETE CASCADE,
  community_id    UUID NOT NULL REFERENCES communities.communities(id),
  user_id         UUID NOT NULL REFERENCES auth.users(id),
  vote            TEXT NOT NULL CHECK (vote IN ('yes', 'no', 'abstain')),
  prestige_weight NUMERIC(8,2) NOT NULL DEFAULT 1.0,
  voted_at        TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (proposal_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_fusion_proposals_a ON communities.fusion_proposals(community_a_id);
CREATE INDEX IF NOT EXISTS idx_fusion_proposals_b ON communities.fusion_proposals(community_b_id);
CREATE INDEX IF NOT EXISTS idx_fusion_votes_proposal ON communities.fusion_votes(proposal_id);
CREATE INDEX IF NOT EXISTS idx_fusion_votes_community ON communities.fusion_votes(proposal_id, community_id);
