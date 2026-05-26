# ADR-055: Trust-Based Governance Architecture

**Status**: Accepted
**Date**: 2026-05-25
**Deciders**: Ravi Chavali
**Supersedes**: —
**Superseded by**: —

---

## Context

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
