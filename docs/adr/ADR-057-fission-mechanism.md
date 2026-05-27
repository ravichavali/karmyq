# ADR-057: Community Fission Mechanism

**Status**: Implemented
**Date**: 2026-05-27
**Sprint**: 69

---

## Context

Communities following Dunbar's Number (~150 members) become dysfunctional as they grow. Social cohesion degrades, trust becomes diluted across too many relationships, and the mutual-aid promise weakens. ADR-018 (Sprint 15) established the `community_links` schema to record sibling relationships between communities but deferred the mechanics of how a split would actually happen.

Sprints 65–68 built the trust graph infrastructure — `trust_edges`, decay-adjusted `trust_edges_live`, and the ego-network visualization. These provide the natural "cleavage data": members who trust each other more belong in the same child community after a split.

The question this sprint answers: **how does a governed, trust-informed split actually happen?**

### Options Considered

1. **Manual admin split**: Admin simply creates two communities and manually moves members. No automation, no governance.
2. **Automatic split job**: A background job detects size thresholds and splits communities automatically without member input.
3. **Governed lifecycle with trust-graph clustering (chosen)**: A four-stage lifecycle — size alert → admin proposal → prestige-weighted member vote → atomic execution — with the trust graph suggesting initial member groupings.

---

## Decision

We implement a **four-stage governed fission lifecycle** entirely within community-service:

### Stage 1: Size Alert
`GET /communities/:id` returns a computed `size_alert` field: `null | 'approaching' | 'recommend_split' | 'urgent_split'` based on `current_members` crossing thresholds of 120/130/140. No background job — computed on every read. This surfaces the signal to admins without forcing action.

### Stage 2: Proposal + Trust-Graph Clustering
An admin creates a `split_proposal`, naming both child communities and providing a rationale. At creation time, community-service runs a **greedy bisection algorithm** (Kernighan-Lin inspired) against `social_graph.trust_edges_live`:

1. Sort members by total trust degree descending.
2. Seed: top-half → Group A, bottom-half → Group B.
3. Up to 10 passes: swap a member if their trust-to-other-group exceeds trust-to-same-group, and the swap keeps groups balanced (|A| − |B| ≤ 1).
4. Members with no trust edges (zero interactions) are distributed alternately.

The algorithm result is stored in `split_member_assignments` as `cluster_suggestion`. The admin can adjust assignments before opening the vote — overrides are tracked via the `admin_overridden` flag.

### Stage 3: Prestige-Weighted Vote
Voting uses the same prestige-weighting pattern as Sprint 67 governance: each member's vote weight equals their community-scoped trust score (sum of `raw_weight` on their edges in this community). This ensures members with deep community relationships carry more weight than newcomers.

Quorum (default 60% of members must vote) and approval (default 60% weighted yes) thresholds must both be met for the proposal to move to `approved`. Auto-approval triggers immediately when a cast vote pushes the proposal over both thresholds.

### Stage 4: Atomic Execution
The execute step runs inside a single PostgreSQL transaction:
1. Creates child community A and child community B.
2. Moves members per their assignments (`INSERT INTO communities.members`).
3. Creates a `split_origin` link in `communities.community_links` with `trust_carry_factor = 0.40` — cross-community trust edges are preserved at 40% weight.
4. Marks the parent community `status = 'split'` — it is **not deleted**. Historical karma records, help requests, and trust edges reference the parent ID.
5. Marks the proposal `status = 'executed'` with timestamps and child IDs.

### Three New Tables
- `communities.split_proposals` — proposal lifecycle
- `communities.split_votes` — per-member votes with prestige weight
- `communities.split_member_assignments` — per-member group assignment (cluster_suggestion vs assigned_to)

---

## Consequences

### Positive
- Split boundary is trust-informed, not arbitrary. The algorithm uses the same decay-adjusted trust weights that members see in the ego-network visualization.
- Full governance: no admin can unilaterally split a community without member consent.
- Parent community is preserved. Historical records remain intact and cross-referenceable.
- Trust carry-over (0.40 factor) means sibling communities retain weak cross-group connections, which may evolve into inter-community collaboration.

### Limitations
- **`UNIQUE (community_id, status)` constraint**: This constraint prevents two active proposals simultaneously, but also prevents a second proposal after execution (two `executed` rows for the same community would violate uniqueness). Demo-scope acceptable; production would need a partial unique index on `status IN ('discussion', 'voting', 'approved')` only.
- **Clustering is one-shot**: The algorithm runs only at proposal creation. It does not re-run if admin adjusts assignments. Intentional — the admin's judgment is the override.
- **No vote deadline enforcement**: The `voting_ends_at` field is stored but not enforced by a job. Votes past the deadline are still accepted. Production would need a cron job to auto-reject expired proposals.

---

## References
- ADR-018: Community Splitting Mechanics (Phase 1 — community_links schema)
- ADR-047: Community Evolution Engine
- ADR-054: Trust Graph Architecture
- ADR-055: Trust Governance Architecture
- ADR-056: Intrinsic Trust Decay
