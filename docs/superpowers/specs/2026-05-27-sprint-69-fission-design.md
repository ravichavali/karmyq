# Sprint 69: Fission Mechanism — Design Spec

**Date**: 2026-05-27
**Status**: Approved
**Version**: v9.80.0 → v9.90.0
**Sprint Branch**: `feature/sprint-69-fission`

---

## Overview

Communities following Dunbar's Number (~150 members) need a healthy way to split before reaching dysfunction. Sprint 69 implements the complete fission lifecycle: automatic size detection, an admin-initiated split proposal with trust-graph-guided member clustering, a prestige-weighted community vote, and the execution step that creates two child communities.

This is ADR-018 Phase 2 — the structural mechanics that turn the `community_links` schema (Phase 1, Sprint 15) from a voluntary peer-linking tool into the output format for a governed split process. The trust graph built across Sprints 65–68 provides the natural cleavage data: members who trust each other more belong in the same child community.

The fission flow has four stages: (1) size alert surfaced to admins when membership crosses thresholds; (2) admin creates a split proposal naming both child communities, whereupon the system auto-clusters members using a greedy bisection algorithm on trust edges; (3) admin reviews and adjusts assignments, then opens voting; (4) community votes prestige-weighted — on approval the system executes the split atomically, creating two new communities, moving members, and recording the `split_origin` link between siblings.

### Core Principle: Trust Determines the Cleavage

The split boundary is not arbitrary. The clustering algorithm reads live trust-edge weights — the same decay-adjusted weights visible in the ego-network graph — and assigns each member to the group they trust more. The admin is the override, not the primary author.

---

## Multi-Sprint Arc

| Sprint | Theme | Status |
|--------|-------|--------|
| **65** | Trust Graph Foundation | ✅ Shipped v9.50.0 |
| **66** | Trust Graph Visualization + Governance ADR | ✅ Shipped v9.60.0 |
| **67** | Ego-Network + Governance | ✅ Shipped v9.70.0 |
| **68** | Interaction Half-Life (Ebbinghaus decay) | ✅ Shipped v9.80.0 |
| **69** | Fission Mechanism | 🔲 This sprint |
| **70** | Fusion Mechanism | 🔲 Planned |
| **71** | v10.0 Polish + karmyq.org update | 🔲 Planned |

---

## New Concepts

**Split proposal** — A formal intent to split a community, created by an admin. Has a lifecycle: `discussion → voting → approved/rejected → executed`. A community can only have one active proposal at a time.

**Member assignment** — The mapping of each member to `group_a` or `group_b` (or `unassigned`). Seeded by the cluster suggestion; adjusted by the admin before voting opens.

**Cluster suggestion** — The algorithm's initial assignment for each member, computed from the trust graph. Stored separately from `assigned_to` so admin overrides are tracked.

**Trust carry-over** — After split execution, trust edges between members who land in different communities are retained at `trust_carry_factor` (default 0.40 for `split_origin` links), not discarded.

**Size alert** — A field on the community GET response (`size_alert: null | 'approaching' | 'recommend_split' | 'urgent_split'`) computed from `current_members` without a background job.

---

## Data Model

### Migration: `infrastructure/postgres/migrations/20260527-fission.sql`

```sql
-- Split proposals
CREATE TABLE IF NOT EXISTS community.split_proposals (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id        UUID NOT NULL REFERENCES community.communities(id),
  proposed_by         UUID NOT NULL REFERENCES auth.users(id),
  split_type          TEXT NOT NULL CHECK (split_type IN ('size_threshold', 'admin_initiated')),
  rationale           TEXT,
  group_a_name        TEXT NOT NULL,
  group_b_name        TEXT NOT NULL,
  status              TEXT NOT NULL DEFAULT 'discussion'
                        CHECK (status IN ('discussion', 'voting', 'approved', 'rejected', 'executed')),
  quorum_pct          INTEGER NOT NULL DEFAULT 60,   -- % of members who must vote
  approval_pct        INTEGER NOT NULL DEFAULT 60,   -- % yes votes required to approve
  discussion_ends_at  TIMESTAMPTZ,
  voting_ends_at      TIMESTAMPTZ,
  executed_at         TIMESTAMPTZ,
  child_community_a_id UUID REFERENCES community.communities(id),
  child_community_b_id UUID REFERENCES community.communities(id),
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (community_id, status)  -- at most one active proposal per community
                                  -- NOTE: this constraint needs partial index in prod;
                                  -- for demo, only one proposal total per community is fine
);

-- Member votes on a split proposal
CREATE TABLE IF NOT EXISTS community.split_votes (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id     UUID NOT NULL REFERENCES community.split_proposals(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES auth.users(id),
  vote            TEXT NOT NULL CHECK (vote IN ('yes', 'no', 'abstain')),
  prestige_weight NUMERIC(8,2) NOT NULL DEFAULT 1.0,  -- karma score at time of vote
  voted_at        TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (proposal_id, user_id)
);

-- Per-member assignment to group_a or group_b
CREATE TABLE IF NOT EXISTS community.split_member_assignments (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id       UUID NOT NULL REFERENCES community.split_proposals(id) ON DELETE CASCADE,
  user_id           UUID NOT NULL REFERENCES auth.users(id),
  assigned_to       TEXT NOT NULL DEFAULT 'unassigned'
                      CHECK (assigned_to IN ('group_a', 'group_b', 'unassigned')),
  cluster_suggestion TEXT CHECK (cluster_suggestion IN ('group_a', 'group_b', NULL)),
  admin_overridden  BOOLEAN NOT NULL DEFAULT FALSE,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (proposal_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_split_proposals_community ON community.split_proposals(community_id);
CREATE INDEX IF NOT EXISTS idx_split_votes_proposal ON community.split_votes(proposal_id);
CREATE INDEX IF NOT EXISTS idx_split_assignments_proposal ON community.split_member_assignments(proposal_id);
```

### communities.communities modification

Add `status = 'split'` as a valid value alongside `'active'` and `'archived'`. No schema change needed — status is `VARCHAR(50)` and the constraint is enforced in application code.

---

## Clustering Algorithm

Greedy trust-graph bisection (Kernighan-Lin inspired) running entirely within community-service by querying `social_graph.trust_edges_live` directly (same DB, cross-schema — already used in `governance.ts`).

**Input**: all members of the community, all trust edges between them (effective_weight from the live view).

**Algorithm**:
1. Sort members by their total trust degree (sum of edge weights) descending.
2. Assign top-half to Group A, bottom-half to Group B (initial seed).
3. Iteratively: for each member, compute `trust_to_same_group` vs `trust_to_other_group`. If `trust_to_other > trust_to_same` AND swapping keeps groups balanced (|A| - |B| ≤ 1), swap.
4. Repeat until no more swaps improve the partition (max 10 passes to bound runtime).
5. Return `{ groupA: userId[], groupB: userId[] }`.

**Complexity**: O(V² × passes) — fast for V < 150 (Dunbar limit).

**Edge case**: members with zero trust edges (no interactions) are distributed alternately to keep groups balanced.

---

## API Endpoints

All fission routes live under `/communities/:communityId/splits`.

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/communities/:id` | member | **Modified**: adds `size_alert`, `active_split_proposal` to response |
| `POST` | `/communities/:id/splits` | admin | Create a split proposal; runs clustering; seeds member assignments |
| `GET` | `/communities/:id/splits/:splitId` | member | Get proposal detail + member assignments + vote counts |
| `PUT` | `/communities/:id/splits/:splitId/assignments` | admin | Bulk-update member assignments (body: `[{userId, assignedTo}]`) |
| `POST` | `/communities/:id/splits/:splitId/start-vote` | admin | Transition `discussion → voting`; sets `voting_ends_at` |
| `POST` | `/communities/:id/splits/:splitId/vote` | member | Cast a vote (`yes` / `no` / `abstain`); records karma as prestige_weight |
| `POST` | `/communities/:id/splits/:splitId/execute` | admin | Execute approved split; atomic: create communities, move members, create link |

**Execute logic (atomic transaction):**
1. Validate: `status = 'approved'` (vote met quorum + threshold).
2. Auto-assign any `unassigned` members to whichever group is smaller.
3. `INSERT INTO community.communities` for group_a and group_b (copy settings from parent).
4. `INSERT INTO community.members` for each assigned member in their target community.
5. `INSERT INTO community.community_links` with `link_type='split_origin'`, `trust_carry_factor=0.40`.
6. `UPDATE community.split_proposals SET status='executed', executed_at=NOW(), child_community_a_id=..., child_community_b_id=...`.
7. `UPDATE community.communities SET status='split' WHERE id=communityId`.

Note: trust edges between cross-group members are NOT explicitly copied at execution time. The `split_origin` community_link with `trust_carry_factor=0.40` encodes the carry-over policy; feed and cross-community logic can apply it at query time (Sprint 70 scope).

---

## Frontend Changes

| File | Change |
|------|--------|
| `apps/frontend/src/components/CommunityHeader.tsx` | Add `SizeAlertBanner` component — renders when `size_alert` is non-null |
| `apps/frontend/src/pages/communities/index.tsx` | Add `FissionTab` to community tab list (visible to all members when proposal active; admin-only otherwise) |
| `apps/frontend/src/components/community/tabs/FissionTab.tsx` | **New** — admin proposal creation form + member assignment review; member voting panel |
| `apps/frontend/src/components/FissionProposalModal.tsx` | **New** — admin modal: group names, rationale, review cluster suggestion before submitting |
| `apps/frontend/src/components/FissionAssignmentView.tsx` | **New** — admin table of members with current assignment + cluster suggestion; toggle buttons to move members between groups |

**FissionTab state machine (rendered views):**
- `no_proposal` + admin → "Propose Split" button (shown only if `size_alert` is non-null or admin manually initiates)
- `discussion` + admin → assignment review table + "Open Voting" button
- `voting` + member → vote buttons (yes / no / abstain); progress bar (quorum, approval %)
- `approved` + admin → "Execute Split" button
- `executed` → read-only: links to the two child communities

---

## User Guide & Doc Updates

Every doc update is mandatory this sprint.

| Artifact | Action |
|----------|--------|
| `apps/landing/src/data/docs/guides/community-fission.json` | **New** user guide: "Splitting a Community" — why to split, how to propose, how to vote, what happens after |
| `apps/landing/src/data/docs/concepts/adr-057-fission-mechanism.json` | **New** ADR-057 landing page entry |
| `docs/adr/ADR-057-fission-mechanism.md` | **New** full ADR documenting algorithm choice and lifecycle decisions |
| `docs/adr/ADR-018-community-splitting-mechanics.md` | Update Phase 2 status to `Implemented`, add link to ADR-057 |
| `apps/landing/src/data/nav.json` | Add entries for fission guide + ADR-057 |
| `scripts/generate-docs.ts` | Add `community-fission` and `adr-057-fission-mechanism` to hardcoded slug list |
| `services/community-service/CONTEXT.md` | Document new splits endpoints + three new DB tables |
| `services/registry.json` | Add 7 new splits endpoints under community-service |

---

## Critical Implementation Notes

1. **`trust_edges_live` is read-only.** It is a VIEW. The clustering algorithm reads from it; never write to it. All trust_edge writes go to `trust_edges`.

2. **JWT field is `communities`, not `communityMemberships`.** The admin check in splits.ts must use `user.communities ?? []` and check `m.role === 'admin'`.

3. **Parent community is NOT deleted.** On execute, set `status='split'`. Karma records, requests, and historical data reference the parent community ID. Members are added to child communities but the parent row persists.

4. **`UNIQUE (community_id, status)` constraint caveat.** The schema uses this to prevent two active proposals, but it also prevents a second proposal after one is executed (both would be `executed` status). For Sprint 69 demo scope this is fine. A partial index on non-terminal statuses is the production fix (Sprint 70+).

5. **Clustering runs at proposal creation time.** The result is stored in `split_member_assignments`. It does not re-run when the admin adjusts assignments. This is intentional — the algorithm is a seed, not an oracle.

6. **Landing page docs are in `.gitignore`.** Always `git add -f apps/landing/src/data/docs/` when staging.

7. **nav.json silently reverts.** `scripts/generate-docs.ts` regenerates nav.json on every build. Always add new slugs to the hardcoded slug list in that file, not just nav.json directly.

8. **TDD tests go in `services/community-service/tests/tdd/`.** Not the root `tests/tdd/`.

9. **ADR-057 is next.** Do not use 056 — confirm the highest existing ADR before writing.

10. **Unassigned members at execute time** are auto-assigned to whichever group is smaller. This is the tie-breaker, not the clustering algorithm.
