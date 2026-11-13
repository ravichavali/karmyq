# ADR-055: Trust-Based Governance Architecture

**Status**: Implemented
**Date**: 2026-05-25
**Deciders**: Ravi Chavali
**Supersedes**: —
**Superseded by**: —
**Amended**: 2026-11-13 — Sprint 142 proportional ratification (implemented on the feature branch; deployment pending).

---

## Context

### Sprint 142 amendment — equal votes and a frozen electorate

The maintainer selected equal votes over trust-qualified or trust-weighted ratification. New nominations use
`max(3, ceil(E / 5))`, where E is the active membership excluding the nominee at creation. Capture voter IDs,
E and the threshold once. Fewer than three other members refuses creation; legacy quorum/template numbers
do not change this policy. Nomination adds no vote. Only original voters who are currently active count;
later arrivals do not join the electorate, and departures never lower the threshold. Staff reactivation can
restore an original voter's ballot; self-service rejoin is not promised (BUG-102).
If restoration reaches quorum with no uncast votes remaining, an active prior voter receives a finalization
action backed by the existing idempotent POST. GET stays read-only, and finalization adds no second ballot.

Creation locks only caller/nominee memberships with FOR NO KEY UPDATE. Voting first locks the scoped
nomination, then nominee plus every existing snapshot membership in user-ID order at the same lock strength.
At quorum it rechecks private nominee eligibility, active membership and monotonic role elevation before
granting/closing atomically. PostgreSQL 40P01 rolls back and becomes a retryable 503; no partial ballot or
grant survives. Same/lower roles are refused. GET projects live counts and matching ratifier identities,
coarse viewer eligibility and can_nominate, without exposing the full roster or personal metrics (ADR-082).

Migration `20261112-governance-quorum.sql` uses one atomic DO block under both appliers. It fences old writers
with transaction-local protocol guards, closes legacy pending nominations as withdrawn and preserves history.
Already resolved nominations remain unchanged. Binary rollback leaves governance writes closed until compatible
code returns. Tests cover preinstalled-guard replay in a rollback fixture and independent cutoff connections
in an isolated scratch database. Explicit community predicates supply isolation; superuser CI role flags are
recorded rather than crediting bypassed RLS. The new voter table is classified reset for curated fixtures.

Simulated nomination/ratification remains disabled. The maintainer accepts that persona-heavy demo communities
may not reach quorum. The implementation does not add role rotation, automatic revocation, delegation,
nomination expiry or withdrawal. The original architecture below records those broader intentions; its old
role-holder-only quorum and template-specific sizes are superseded by this amendment for new nominations.

Design: [Sprint 142 spec](../superpowers/specs/2026-11-12-sprint-142-governance-quorum-design.md).

### Original context (2026-05-25)

karmyq communities currently have static admin/moderator roles assigned at creation and never rotated. Sprint 65 added `social_graph.trust_edges` — a persistent, weighted, community-scoped record of member interactions. As trust data matures, there is an opportunity to ground governance authority in measured trust rather than legacy assignment.

The problem with static roles: a founding admin who has become inactive retains governance authority indefinitely. This creates oligarchic lock-in and undermines the platform's mutual-aid philosophy where contribution drives standing.

## Decision

Governance roles are trust-gated and non-permanent. The architecture has four components:

### 1. Founder Group
- 5–6 members initialized at community creation
- Selected by the creator; handles admin/mod/governance bootstrapping
- Founders have full governance rights until the community's trust graph matures (avg trust score ≥ `eligibility_threshold` across founders)

### 2. Role Eligibility
- Eligibility threshold: trust score ≥ `governance.eligibility_threshold` (community-configurable, default 50)
- Any eligible member can be nominated for a governance role
- Ratification: a quorum of current role-holders must approve
- A member's role becomes eligible for reassignment when their trust score drops below threshold

### 3. Trust-Gated Authority
New communities have constrained governance rights that expand as trust matures:
- **Constrained** (avg trust < threshold): invite-only membership decisions, read-only config
- **Mature** (avg trust ≥ threshold): full governance rights — config changes, moderation, role assignment

This prevents governance capture by communities that haven't built real trust yet.

### 4. Anti-Oligarchy
- Roles are non-permanent: anyone rotates out when trust drops
- No founding privilege after the community reaches maturity
- Rotation is triggered by trust score drop, not time-based decay
- Historical contribution (karma) does not protect a role — only current trust does

### Governance Templates
The `CommunityTrustQuestionnaire` questionnaire matching suggests governance templates from similar communities:
- **small-collective**: 3-member quorum, flat authority
- **council**: 5-member quorum, role specialization (admin/mod/treasurer)
- **open-delegation**: trust-weighted voting on governance decisions

## Implementation Plan

Sprint 67 implements this ADR. Schema additions to `community_settings`:
```json
{
  "governance": {
    "eligibility_threshold": 50,
    "quorum_size": 3,
    "template": "small-collective"
  }
}
```

New API endpoints (Sprint 67):
- `GET /communities/:id/governance` — current governance state
- `POST /communities/:id/governance/nominate` — nominate a member for a role
- `POST /communities/:id/governance/ratify/:nominationId` — ratify a nomination

## Consequences

**Positive**:
- Roles reflect current trust, preventing oligarchic lock-in
- New communities have sensible constraints that lift automatically as trust builds
- The trust graph (Sprint 66) makes governance state visible and legible

**Negative**:
- More complex role assignment than static admin flags
- Communities need enough trust data before governance works well — mitigated by Sprint 65 backfill

**Neutral**:
- Existing admin flags are not removed; they coexist with the trust-gated system until Sprint 71 deprecation
