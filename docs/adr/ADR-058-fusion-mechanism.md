# ADR-058: Fusion Mechanism

**Status**: Implemented
**Date**: 2026-05-27
**Deciders**: Ravi Chavali

## Context

Fission (ADR-057) allows a community to split into two. Fusion is the symmetric inverse — two communities voluntarily merge into one. Both mechanisms complete the community lifecycle toolkit in the v10.0 Trust Network arc.

## Decision

Fusion is bilateral and consensual at every step:

1. **Proposal**: Admin A initiates, naming the merged community and providing a rationale.
2. **Acceptance**: Admin B accepts or rejects the proposal.
3. **Discussion**: Both admins can discuss before opening the vote.
4. **Parallel vote**: Each community votes independently; both must pass 60% quorum + 60% approval (trust-weighted).
5. **Execution**: Either admin executes. A new merged community is created with all members, trust, and karma from both originals.

On execution:
- All active members are added to the merged community.
- Trust edges from both originals are copied with 0.70 carry factor (maintains normalization constraint: `user_id_a < user_id_b`).
- Karma records from both communities are copied into the merged community.
- Original communities receive `status='merged'`.
- Two `fusion_origin` community_links are created: (merged↔A) and (merged↔B).

## Trust Carry Factor (0.70)

Fission uses 0.40 — low, because the split severs relationships. Fusion uses 0.70 — higher, because the merge is consensual and the member base is actively choosing to come together. Trust history should be preserved with high fidelity.

## Database Schema

Two new tables in the `communities` schema:

- `fusion_proposals` — lifecycle record for each proposal (status: `pending_acceptance → discussion → voting → approved → executed | rejected`)
- `fusion_votes` — per-member, per-community votes with prestige weighting

The `community_links.link_type` CHECK constraint is extended to include `'fusion_origin'`.

## Rationale

- Bilateral consent ensures no community is absorbed against its will.
- Parallel votes preserve each community's democratic sovereignty.
- New merged community (rather than absorption) is symmetric with fission and avoids privileging one community's identity over the other.
- Trust and karma inheritance reduces the activation energy for fusion, making it a viable governance tool rather than a last resort.
- Auto-approval (status advances to `approved` when both tallies pass) eliminates the need for a polling background job.
