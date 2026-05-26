# Sprint 67: Ego-Network + Governance — Design Spec

**Date**: 2026-05-26
**Status**: Approved
**Version**: v9.60.0 → v9.70.0
**Sprint Branch**: `feature/sprint-67-governance`

---

## Overview

Sprint 66 shipped a trust graph visualization that returns *all* active-member edges for a community — a stepping stone that works at demo scale but will become useless noise at real scale. Sprint 67 corrects this by making the trust graph permanently ego-centric: the calling user is always the center node, and the graph shows only their direct neighbors and the edges among those neighbors. This is the correct model, and there is no "show full graph" mode.

Simultaneously, the dashboard's "Your Network" panel still uses the old binary-edge `/network` endpoint from before the trust graph existed. Sprint 67 retires that endpoint and points the dashboard at trust data instead — one unified model everywhere.

Finally, Sprint 67 implements ADR-055: trust-gated governance. Communities gain a governance configuration (eligibility threshold, quorum size, template), a nomination/ratification flow, and a full governance UI on the community page. Roles become non-permanent: a member is eligible for a governance role only while their trust score exceeds the threshold, and rotation is triggered by score drops, not by time.

### Core Principle: Current Trust, Not Past Status

Governance authority reflects where a member stands *now* in the community's trust graph — not who they were when the community was founded.

---

## Multi-Sprint Arc: v10.0 Trust Network

| Sprint | Theme | Status |
|--------|-------|--------|
| **65** | Trust Graph Foundation | ✅ Shipped v9.50.0 |
| **66** | Trust Graph Visualization + Governance ADR | ✅ Shipped v9.60.0 |
| **67** | Ego-Network + Governance Implementation | 🔲 This sprint |
| **68** | Data Half-life + Demo Cleanup | 🔲 Planned |
| **69** | Fission Mechanism | 🔲 Planned |
| **70** | Fusion Mechanism | 🔲 Planned |
| **71** | v10.0 Polish + karmyq.org update | 🔲 Planned |

**June 19th LinkedIn share target**: Sprints 65–68 complete.

---

## Data Model

### New column: `community.communities.governance_settings`

```sql
ALTER TABLE community.communities
  ADD COLUMN IF NOT EXISTS governance_settings JSONB
  NOT NULL DEFAULT '{"eligibility_threshold": 50, "quorum_size": 3, "template": "small-collective"}'::jsonb;
```

### New table: `community.governance_nominations`

```sql
CREATE TABLE IF NOT EXISTS community.governance_nominations (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id          UUID        NOT NULL REFERENCES community.communities(id) ON DELETE CASCADE,
  nominated_user_id     UUID        NOT NULL REFERENCES auth.users(id),
  nominated_for_role    VARCHAR(50) NOT NULL,
  nominator_id          UUID        NOT NULL REFERENCES auth.users(id),
  status                VARCHAR(20) NOT NULL DEFAULT 'pending',
  required_ratifications INT        NOT NULL DEFAULT 3,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at           TIMESTAMPTZ,
  CONSTRAINT valid_status CHECK (status IN ('pending', 'ratified', 'rejected', 'withdrawn'))
);
```

### New table: `community.governance_ratifications`

```sql
CREATE TABLE IF NOT EXISTS community.governance_ratifications (
  nomination_id  UUID        NOT NULL REFERENCES community.governance_nominations(id) ON DELETE CASCADE,
  ratifier_id    UUID        NOT NULL REFERENCES auth.users(id),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (nomination_id, ratifier_id)
);
```

---

## API Endpoints

### Modified: `GET /trust/graph/:communityId`

**Service**: social-graph-service (port 3010)
**Change**: Now requires authentication. Passes `callingUserId` from JWT to DB query. Returns ego-network only — calling user + direct neighbors + edges (user↔neighbor and neighbor↔neighbor).

**Response shape** (unchanged):
```json
{
  "success": true,
  "data": {
    "nodes": [{ "id": "uuid", "name": "str", "trust_score": 42, "karma": 120, "isCurrentUser": true }],
    "links": [{ "source": "uuid", "target": "uuid", "effective_weight": 8.5 }]
  }
}
```

### New: `GET /trust/graph` (no communityId — aggregate)

**Service**: social-graph-service (port 3010)  
**Purpose**: Aggregate ego-network across all communities where the calling user is an active member. Used by the dashboard "Your Network" panel.  
**Auth**: Required (JWT).

### New: `GET /communities/:id/governance`

**Service**: community-service (port 3002)  
**Auth**: Required, active member of community.

**Response**:
```json
{
  "success": true,
  "data": {
    "settings": { "eligibility_threshold": 50, "quorum_size": 3, "template": "small-collective" },
    "maturity": { "status": "constrained" | "mature", "avg_trust_score": 42.3, "threshold": 50 },
    "eligible_members": [{ "user_id": "uuid", "name": "str", "trust_score": 67, "karma": 120 }],
    "nominations": [{
      "id": "uuid", "nominated_user": { "user_id": "uuid", "name": "str" },
      "role": "admin", "nominator": { "user_id": "uuid", "name": "str" },
      "ratification_count": 2, "required_ratifications": 3,
      "status": "pending", "ratifiers": [{ "user_id": "uuid", "name": "str" }]
    }],
    "role_holders": [{ "user_id": "uuid", "name": "str", "role": "admin", "trust_score": 75 }]
  }
}
```

### New: `POST /communities/:id/governance/nominate`

**Service**: community-service  
**Auth**: Required, active member.  
**Body**: `{ "nominated_user_id": "uuid", "role": "admin" | "moderator" }`  
**Validation**: nominated_user_id must have trust_score >= eligibility_threshold in this community. One pending nomination per user per role.

### New: `POST /communities/:id/governance/ratify/:nominationId`

**Service**: community-service  
**Auth**: Required, must hold a governance role in this community (admin or moderator).  
**Auto-ratify trigger**: When `ratification_count >= required_ratifications`, set nomination status to `ratified`, update `community.members.role` for the nominated user, set `resolved_at = NOW()`.

---

## Frontend Changes

### Modified: `apps/frontend/src/pages/dashboard.tsx`

Replace `GET /network` call with `GET /api/social/trust/graph` (aggregate, no communityId). Pass trust-format data to `NetworkGraph.tsx`.

### Modified: `apps/frontend/src/components/NetworkGraph.tsx`

Update to accept trust-format nodes/links. The data shape change: nodes gain `trust_score`, links have `effective_weight` (was binary). Adapt visual encoding if needed.

### New: `apps/frontend/src/components/GovernanceTab.tsx`

Fetches `GET /api/community/communities/:id/governance`. Renders:
- **Maturity banner**: Constrained / Mature badge + avg trust score vs threshold
- **Eligible members**: list with trust scores; "Nominate" button opens inline form (role selector: Admin / Moderator + Submit)
- **Active nominations**: each nomination shows nominated member, role, ratification progress bar (N of M), ratifiers, and a "Ratify" button visible to current role-holders
- **Current governance roles**: who holds admin/moderator role with their trust score

### Modified: `apps/frontend/src/pages/communities/[id].tsx`

Add `'governance'` to `ValidTab` union type and `VALID_TABS` array. Add `<GovernanceTab>` under the governance tab case. Tab visible to all `isMember`.

### Modified: `apps/frontend/src/lib/api.ts`

- Add `getGovernanceState(communityId)` → `GET /api/community/communities/:id/governance`
- Add `nominateForRole(communityId, nominatedUserId, role)` → `POST /api/community/communities/:id/governance/nominate`
- Add `ratifyNomination(communityId, nominationId)` → `POST /api/community/communities/:id/governance/ratify/:nominationId`
- Add `getTrustGraphAggregate()` → `GET /api/social/trust/graph` (no communityId)
- Update `getTrustGraph(communityId)` — no breaking change in signature; backend now ego-filters

---

## User Guide & Doc Updates

Every sprint ships landing page updates. Sprint 67 requires:

1. **Update trust-graph user guide** (`docs/guides/trust-graph.md` → regenerated to landing): add section explaining ego-network model — "Your graph shows the people you've directly interacted with, not the entire community." Remove any implication of a full-community view.

2. **New governance concept page**: `apps/landing/src/data/docs/concepts/governance.json` — explain trust-gated governance, the nomination/ratification flow, and why roles are non-permanent.

3. **Update ADR-055 status**: `apps/landing/src/data/docs/concepts/adr-055-trust-governance-architecture.json` — change `"status": "accepted"` to `"status": "implemented"`.

4. **Update social-graph-service service docs**: `apps/landing/src/data/docs/services/social-graph-service.json` — add ego-network and aggregate endpoints.

5. **nav.json**: Add `governance` concept entry under "Concepts". Verify trust-graph guide entry still present (nav.json revert bug — see Critical Notes #6).

---

## Critical Implementation Notes

1. **Ego-network requires callingUserId from JWT.** `GET /trust/graph/:communityId` must `verifyToken` and pass `req.user.userId` to `getTrustGraph`. If the route currently skips auth, add `verifyToken` middleware.

2. **Cross-schema SQL is fine.** community-service queries `social_graph.trust_edges` directly — same PostgreSQL instance. No cross-service HTTP call needed for trust score lookups.

3. **Auto-ratify is synchronous in the ratify handler.** When `ratification_count >= required_ratifications`: update `community.members SET role = $role WHERE user_id = $nominated AND community_id = $communityId`, then `UPDATE governance_nominations SET status = 'ratified', resolved_at = NOW()` — both in the same transaction.

4. **`'governance'` must be added to BOTH `ValidTab` type AND `VALID_TABS` array** in `[id].tsx`. Missing either breaks URL tab routing.

5. **Governance tab visibility**: show to all `isMember`. Governance is transparent by design — everyone can see who is eligible, who is nominated, and who ratified.

6. **nav.json revert bug**: `generate-docs.ts` regenerates nav.json on every build. Add any new slug (`governance`) to the hardcoded list in `scripts/generate-docs.ts` before committing, otherwise the next build wipes it.

7. **Landing docs in .gitignore**: Always `git add -f apps/landing/src/data/docs/`.

8. **JWT field is `communities`** not `communityMemberships`. In governance middleware: `const memberships = user.communities ?? []`.

9. **Aggregate trust graph endpoint path**: `GET /api/social/trust/graph` (no communityId). In community-service, this is a separate route `GET /trust/graph` (param-less) — must be declared before `GET /trust/graph/:communityId` to avoid `:communityId` matching an empty string.

10. **No "show full graph" mode** — the ego-network is permanent. Do not add a toggle or a "view all" button anywhere.

11. **Nomination idempotency**: reject duplicate pending nominations (same community + same nominated_user_id + same role + status=pending). Return 409 if already pending.

12. **TDD tests go in** `services/social-graph-service/tests/tdd/` for ego-network, `services/community-service/tests/tdd/` for governance endpoints.
