# Sprint 70: Fusion Mechanism — Design Spec

**Date**: 2026-05-27
**Status**: Approved
**Version**: v9.90.0 → v9.95.0
**Sprint Branch**: `feature/sprint-70-fusion`

---

## Overview

Fusion is the counterpart to fission: two separate communities voluntarily merge into a single new community. Where fission is unilateral (one admin splits their own community), fusion is bilateral — both admins must initiate, and both communities' members must vote independently before the merge executes.

The mechanism mirrors fission's lifecycle (`discussion → voting → approved → executed`) but adds a `pending_acceptance` stage at the front. Admin A creates the proposal naming the merged community. Admin B accepts or rejects. Once accepted, both communities hold parallel trust-weighted votes. When both pass, either admin can execute — creating a new merged community, copying all members, copying trust edges with a 0.70 carry factor, and copying karma records from both originals.

This completes the v10.0 Trust Network arc's community evolution toolkit: communities can grow (trust graph), specialize (fission), and consolidate (fusion).

### Core Principle: Bilateral Consent

Every step of fusion requires agreement from both sides. Neither community can be merged into another against its will. Both admins initiate, both member bodies vote.

---

## v10.0 Trust Network Arc

| Sprint | Theme | Status |
|--------|-------|--------|
| **65** | Trust Graph Foundation | ✅ Shipped v9.50.0 |
| **66** | Trust Graph Visualization + Governance ADR | ✅ Shipped v9.60.0 |
| **67** | Ego-Network + Governance | ✅ Shipped v9.70.0 |
| **68** | Interaction Half-Life (Ebbinghaus decay) | ✅ Shipped v9.80.0 |
| **69** | Fission Mechanism | ✅ Shipped v9.90.0 |
| **70** | Fusion Mechanism | 🔲 This sprint |
| **71** | v10.0 Polish + karmyq.org update | 🔲 Upcoming |

---

## New Concepts

**Fusion proposal**: A bilateral merge request between two communities. Lives in `communities.fusion_proposals`.

**Parallel vote**: Each of the two communities holds a separate trust-weighted vote. Both must independently pass quorum + approval threshold. Either community's rejection kills the proposal.

**Trust carry factor (fusion)**: 0.70 — applied to raw_weight when copying trust edges into the merged community. Higher than fission's 0.40 because fusion is consensual and relationship history is being actively preserved.

**`fusion_origin` link**: A `community_link` between the merged community and each of its two parent communities, recording the lineage. Creates two links: merged↔A and merged↔B.

---

## Data Model

### New table: `communities.fusion_proposals`

```sql
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
```

### New table: `communities.fusion_votes`

```sql
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
```

### Altered: `communities.community_links`

Add `'fusion_origin'` to the `link_type` CHECK constraint:

```sql
ALTER TABLE communities.community_links DROP CONSTRAINT IF EXISTS community_links_link_type_check;
ALTER TABLE communities.community_links ADD CONSTRAINT community_links_link_type_check
  CHECK (link_type IN ('sister', 'parent_child', 'split_origin', 'fusion_origin'));
```

---

## API Endpoints

All routes mount under `/communities` in community-service.

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/:communityId/fusions` | admin of A | Create fusion proposal (target community B + merged name + rationale) |
| `POST` | `/:communityId/fusions/:fusionId/accept` | admin of B | Accept pending proposal → status becomes 'discussion' |
| `POST` | `/:communityId/fusions/:fusionId/reject` | admin of B | Reject pending proposal → status becomes 'rejected' |
| `GET`  | `/:communityId/fusions/:fusionId` | active member of A or B | Proposal detail + both community vote tallies + my_vote |
| `POST` | `/:communityId/fusions/:fusionId/start-vote` | admin of A or B | Transition discussion → voting (7-day window) |
| `POST` | `/:communityId/fusions/:fusionId/vote` | active member of A or B | Cast vote (prestige-weighted) |
| `POST` | `/:communityId/fusions/:fusionId/execute` | admin of A or B | Execute approved fusion |

### POST `/:communityId/fusions` — create proposal

Body: `{ target_community_id, merged_community_name, rationale? }`

Returns `201` with `{ proposal }`.

Errors: 409 if an active fusion proposal already exists for this community pair.

### GET `/:communityId/fusions/:fusionId` — detail

Returns:
```json
{
  "proposal": { "id", "status", "community_a_id", "community_b_id", "merged_community_name", "rationale", "voting_ends_at", "quorum_pct", "approval_pct" },
  "vote_tally_a": { "total_members", "voted_count", "approval_ratio", "quorum_ratio", "weighted_yes", "weighted_total" },
  "vote_tally_b": { "total_members", "voted_count", "approval_ratio", "quorum_ratio", "weighted_yes", "weighted_total" },
  "my_vote": "yes|no|abstain|null",
  "my_community": "a|b"
}
```

### POST `/:communityId/fusions/:fusionId/vote` — cast vote

Auto-approves if both A's and B's tallies independently meet quorum + approval.

### POST `/:communityId/fusions/:fusionId/execute` — execute fusion

Transactional execution:
1. Verify status = 'approved'
2. Create new merged community (name from proposal, attrs from community A)
3. Add all active members of A and B to merged community
4. Copy trust edges from A and B into merged (raw_weight × 0.70)
5. Copy karma records from A and B into merged community
6. Create `fusion_origin` community_links: merged↔A and merged↔B (trust_carry_factor: 0.70)
7. Update proposal: status='executed', merged_community_id=<new id>
8. Update A status = 'merged'
9. Update B status = 'merged'

**Trust edge normalization**: `trust_edges` requires `user_id_a::text < user_id_b::text`. When copying, always order the pair correctly before insert.

---

## Frontend Changes

| File | Change |
|------|--------|
| `apps/frontend/src/components/community/tabs/FusionTab.tsx` | New tab component (create) |
| `apps/frontend/src/components/FusionProposalModal.tsx` | Create proposal form for Admin A (create) |
| `apps/frontend/src/pages/communities/[id].tsx` | Add 'fusion' to ValidTab, import FusionTab |
| `apps/frontend/src/lib/api.ts` | Add fusion API methods to communityService |

### FusionTab views

**Admin A (proposer), status=pending_acceptance**: Shows "Awaiting acceptance from [Community B]."

**Admin B (acceptor), status=pending_acceptance**: Shows proposal details, Accept / Reject buttons.

**Both communities, status=discussion**: Shows proposal summary, "Start Vote" button (admin only).

**Both communities, status=voting**: Shows vote tally for own community, vote buttons (yes/no/abstain), other community's tally (read-only). Hides vote buttons after voting.

**status=approved**: Shows "Both communities approved. Execute merger." button (admin only).

**status=executed**: Shows link to merged community.

---

## User Guide & Doc Updates

Every sprint ships doc updates. Required this sprint:

1. **New user guide**: `apps/landing/src/data/docs/guides/fusion.json` — "Community Fusion" guide covering the full lifecycle: who can propose, acceptance, parallel vote, execution, what happens to members/karma/trust.

2. **Update existing user guide**: `apps/landing/src/data/docs/guides/community-evolution.json` (if it exists) — add fusion as a counterpart to fission. If it doesn't exist, create it as an overview of both fission and fusion.

3. **New ADR**: `apps/landing/src/data/docs/concepts/adr-058-fusion-mechanism.json` — ADR-058 covering fusion design decisions (bilateral consent, parallel vote, trust carry factor rationale).

4. **nav.json**: Add entries for the new guide + ADR. `nav.json` is regenerated by `scripts/generate-docs.ts` — add slugs to the hardcoded list there.

5. **Source ADR**: `docs/adr/ADR-058-fusion-mechanism.md`

---

## Critical Implementation Notes

1. **trust_edges normalized constraint**: `trust_edges` requires `user_id_a::text < user_id_b::text`. When inserting copied edges, always sort the pair: `const [a, b] = [uid1, uid2].sort()`.

2. **community_links UNIQUE constraint**: The existing UNIQUE(community_a_id, community_b_id) constraint means two fusion_origin links need different pairs — use (merged, A) and (merged, B), not (A, B).

3. **No UNIQUE constraint on fusion_proposals**: Unlike split_proposals (which uses `UNIQUE(community_id, status)`), fusion proposals involve two communities. Guard the "active proposal" check in the route with a query instead of a DB constraint.

4. **trust_carry_factor 0.70**: Applied to `raw_weight` when copying trust edges. Applies to BOTH intra-community edges (A's internal trust → merged, B's internal trust → merged). There are no cross-community edges in the data model to copy (trust is community-scoped).

5. **Fission UNIQUE constraint workaround**: `split_proposals` has `UNIQUE(community_id, status)` which only allows one proposal per status. Fusion proposals table deliberately omits this — a community could be in two separate fusion proposals (as A in one, as B in another). Guard via query logic instead.

6. **nav.json revert bug**: `scripts/generate-docs.ts` regenerates nav.json on build. Add new slugs to the hardcoded slug list in that script, or the nav entry will disappear on next build.

7. **landing page docs in .gitignore**: Always `git add -f apps/landing/src/data/docs/` when committing.

8. **`active_fusion_proposal`**: The community GET endpoint (`/communities/:id`) needs to include `active_fusion_proposal` so the frontend can show the fusion tab badge. Use the same pattern as `active_split_proposal`.

9. **Admin of A OR B can start-vote / execute**: Either admin can call these routes after the bilateral initiation. Check that the caller is admin in either community_a_id or community_b_id.
