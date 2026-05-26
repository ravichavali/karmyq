# Sprint 65: Trust Graph Foundation — Design Spec

**Date**: 2026-05-25
**Status**: Approved
**Version**: v9.40.0 → v9.50.0
**Sprint Branch**: `feature/sprint-65-trust-graph-foundation`
**Arc**: v10.0 Trust Network Arc — Sprint 1 of 7

---

## Overview

Karmyq's platform has always measured reputation (karma, trust scores) at the individual level. What it has never captured is the *relational* fabric — the strength of the actual bonds between people. The social-graph service exists but stores only thin connections: "these two interacted, at this time." It has no weights, no interaction type breakdown, no community scope, and no decay.

Sprint 65 lays the foundation of the trust graph: a persistent, weighted, decaying edge table between users, community-scoped, fed by the interaction event stream. This is the data model that Sprint 66 (visualization), Sprint 67 (governance), and Sprint 69 (fission/fusion) all depend on.

Nothing in this sprint is user-visible. The output is architectural: new schema, a capture pipeline, and a graph API endpoint that returns nodes + edges ready for the visualizer.

### Core Principle: Trust Is Relational, Not Individual

Karma measures what a person has done. Trust measures the strength of a bond between two people. These are distinct things — and conflating them is why the current pathComputation.ts uses karma as a proxy for trust strength. Sprint 65 separates them cleanly.

---

## Multi-Sprint Arc

| Sprint | Theme | Status |
|--------|-------|--------|
| Sprint 65 | Trust Graph Foundation (this sprint) | 🔲 |
| Sprint 66 | Trust Graph Visualization + Governance ADR | 🔲 |
| Sprint 67 | Governance Implementation | 🔲 |
| Sprint 68 | Data Half-life + Demo Cleanup | 🔲 |
| Sprint 69 | Fission Mechanism | 🔲 |
| Sprint 70 | Fusion Mechanism | 🔲 |
| Sprint 71 | v10.0 Polish + karmyq.org update | 🔲 |

**June 19th LinkedIn share target**: Sprints 65–68 complete (trust graph visible, governance live, demo clean).

---

## New Concepts

### Trust Edge
A bidirectional, community-scoped, weighted record of the interaction history between two users. Distinct from karma (which is per-user) and from the existing `social_graph.connections` table (which has no weight, no counts, no community scope).

**Edge weight** = sum of (interaction_count × interaction_type_weight), with 6-month half-life decay applied to the `last_interaction_at` timestamp. Consistent with the karma decay pattern in ADR-011.

### Interaction Type Hierarchy
Interactions are not equal. A completed exchange carries more weight than attending the same event:

| Type | Default Weight | Rationale |
|------|---------------|-----------|
| `match_completed` | 10.0 | Highest — actual help exchanged, real vulnerability |
| `endorsement` | 5.0 | Medium — deliberate public act of trust |
| `karma_given` | 3.0 | Light — acknowledgment, lower cost |
| `event` | 2.0 | Lightest — shared presence, no exchange |

Weights are stored in `social_graph.interaction_weights` per community (nullable = platform default), making the system modular. Communities can tune their own weight model. This is the "secret sauce" layer.

### Community-Community Edge
The fractal property of the trust graph: the same edge structure applies at the community level. When users from community A interact with users from community B, a `community_trust_edges` record accumulates. This is the foundation for fission/fusion detection (Sprint 69–70).

---

## Data Model

### New Tables

```sql
-- Weighted trust edges between users (community-scoped)
CREATE TABLE social_graph.trust_edges (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id_a             UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_id_b             UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  community_id          UUID NOT NULL REFERENCES communities.communities(id) ON DELETE CASCADE,
  -- Interaction type counts (raw, not decayed)
  match_completed_count INT NOT NULL DEFAULT 0,
  endorsement_count     INT NOT NULL DEFAULT 0,
  karma_given_count     INT NOT NULL DEFAULT 0,
  event_count           INT NOT NULL DEFAULT 0,
  -- Computed weight (recalculated on each interaction, pre-decay)
  raw_weight            FLOAT NOT NULL DEFAULT 0,
  last_interaction_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Normalized pair: user_id_a < user_id_b (prevents duplicate A↔B / B↔A)
  CONSTRAINT trust_edges_normalized CHECK (user_id_a::text < user_id_b::text),
  UNIQUE(user_id_a, user_id_b, community_id)
);

CREATE INDEX trust_edges_user_a_community ON social_graph.trust_edges(user_id_a, community_id);
CREATE INDEX trust_edges_user_b_community ON social_graph.trust_edges(user_id_b, community_id);
CREATE INDEX trust_edges_community ON social_graph.trust_edges(community_id);
CREATE INDEX trust_edges_weight ON social_graph.trust_edges(raw_weight DESC);

-- Interaction weight configuration (per-community overrides; NULL community_id = platform default)
CREATE TABLE social_graph.interaction_weights (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id     UUID REFERENCES communities.communities(id) ON DELETE CASCADE,
  interaction_type TEXT NOT NULL CHECK (interaction_type IN ('match_completed','endorsement','karma_given','event')),
  weight           FLOAT NOT NULL DEFAULT 1.0,
  UNIQUE(community_id, interaction_type)
);

-- Community-to-community trust edges (fractal level 2)
CREATE TABLE social_graph.community_trust_edges (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id_a          UUID NOT NULL REFERENCES communities.communities(id) ON DELETE CASCADE,
  community_id_b          UUID NOT NULL REFERENCES communities.communities(id) ON DELETE CASCADE,
  cross_interaction_count INT NOT NULL DEFAULT 0,
  weight                  FLOAT NOT NULL DEFAULT 0,
  last_interaction_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT community_trust_normalized CHECK (community_id_a::text < community_id_b::text),
  UNIQUE(community_id_a, community_id_b)
);
```

### Seed Data (platform default weights)
```sql
INSERT INTO social_graph.interaction_weights (community_id, interaction_type, weight) VALUES
  (NULL, 'match_completed', 10.0),
  (NULL, 'endorsement',      5.0),
  (NULL, 'karma_given',      3.0),
  (NULL, 'event',            2.0)
ON CONFLICT DO NOTHING;
```

### Existing Tables: No Changes
- `social_graph.connections` — leave as-is (thin connection existence check, still used by existing UI)
- `auth.social_distances` — leave as-is (path cache, still used by pathComputation.ts)
- All reputation-service tables — untouched

---

## API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/social-graph/trust/graph/:communityId` | Bearer | Return nodes + edges for community trust graph. Used by Sprint 66 visualizer. |
| GET | `/social-graph/trust/edge?userA=X&userB=Y&communityId=Z` | Bearer | Return the trust edge between two specific users (effective weight with decay applied). |

### GET `/trust/graph/:communityId` response shape
```json
{
  "success": true,
  "data": {
    "nodes": [
      { "id": "uuid", "name": "string", "trust_score": 72, "karma": 340 }
    ],
    "edges": [
      {
        "source": "uuid-a",
        "target": "uuid-b",
        "raw_weight": 23.5,
        "effective_weight": 18.2,
        "match_completed_count": 2,
        "last_interaction_at": "ISO string"
      }
    ]
  }
}
```

`effective_weight` = `raw_weight` × half-life decay factor from `last_interaction_at`.

---

## Service Changes

### social-graph-service
- New: `src/database/trustEdgeDb.ts` — CRUD for `social_graph.trust_edges` + `community_trust_edges`
- New: `src/services/trustEdgeService.ts` — `upsertTrustEdge()`, `computeEffectiveWeight()`, `getTrustGraph()`
- New: `src/events/subscriber.ts` — Bull queue subscriber for `match_completed` → calls `upsertTrustEdge`
- New: `src/routes/trustGraph.ts` — `GET /trust/graph/:communityId` and `GET /trust/edge`
- Modified: `src/services/pathComputation.ts` — update `computeShortestPath` to use `trust_edges.raw_weight` as edge cost instead of karma proxy

### Infrastructure
- New migration: `infrastructure/postgres/migrations/YYYYMMDD-trust-graph-foundation.sql`
- Update: `infrastructure/postgres/init.sql` — add new tables

---

## Testing Strategy

This sprint sets a new standard for test quality in the v10.0 arc. The pattern of shallow TDDs and stubs ends here.

### What "robust" means in practice

- **No stubs for logic under test.** If the function calls the DB, the test hits the DB. If the function calls the queue, the test fires the queue. Mocks only for services that are genuinely external (third-party APIs).
- **Assert specific values, not just truthy.** `expect(weight).toBe(10.0)` not `expect(weight).toBeTruthy()`. `expect(edge.match_completed_count).toBe(3)` not `expect(edge).toBeDefined()`.
- **Test the mathematical invariants.** The decay formula has a 6-month half-life. At exactly 6 months, `effective_weight` must be exactly half of `raw_weight`. At 12 months, a quarter. Test this precisely.
- **Test boundary conditions.** Empty community (zero nodes, zero edges). Single member. Two members who have never interacted (no edge). The normalized pair constraint (b < a submitted, a < b stored).
- **Test idempotency.** Calling `upsertTrustEdge` twice with the same inputs should increment count to 2, not create two rows. This is a DB constraint — prove it in a test.
- **Test the full event pipeline.** A `match_completed` event on the queue must result in a `trust_edges` row. Not a unit test of the handler function — an integration test that fires the event and queries the DB.

### Test tiers for this sprint

| Tier | File location | What it covers |
|------|--------------|----------------|
| Unit | `services/social-graph-service/tests/unit/` | Weight computation, pair normalization, decay formula |
| TDD (integration) | `services/social-graph-service/tests/tdd/` | DB upsert behavior, API responses, event pipeline |
| Regression (after passing) | `services/social-graph-service/tests/regression/` | Promote TDD tests once passing |

### Minimum test cases (non-negotiable)

**Weight computation (unit):**
- Normalized pair: `upsertTrustEdge(b, a)` stores row with `user_id_a = min(a,b)`
- Weight for brand-new match: `raw_weight = 10.0` (platform default for `match_completed`)
- Weight after 2 matches: `raw_weight = 20.0`
- Weight with community override (e.g., `match_completed = 15.0`): `raw_weight = 15.0`
- Decay at age 0: `effective_weight === raw_weight`
- Decay at 6 months: `effective_weight === raw_weight * 0.5` (within float tolerance)
- Decay at 12 months: `effective_weight === raw_weight * 0.25`

**DB upsert behavior (TDD/integration, real DB):**
- First upsert: creates row, `match_completed_count = 1`
- Second upsert (same pair, same community): same row, `match_completed_count = 2`
- Reversed pair submitted: same row as forward pair (normalization works end-to-end)
- Different community: creates separate row (not merged with same-user different-community edge)
- Constraint violation test: attempt to insert `user_id_a > user_id_b` directly — must fail

**Event pipeline (TDD/integration, real queue + DB):**
- Fire `match_completed` event on `karmyq-events` queue → verify `trust_edges` row created
- Fire twice → verify `match_completed_count = 2`
- Cross-community match → verify `community_trust_edges` row created

**API endpoint (TDD/integration):**
- `GET /trust/graph/:communityId` without auth → 401
- `GET /trust/graph/:communityId` with non-member token → 403
- `GET /trust/graph/:communityId` with valid member → 200, nodes array includes all community members, edges array has `effective_weight` field
- `GET /trust/edge?userA=X&userB=Y&communityId=Z` for non-existent pair → `{ success: true, data: null }`
- `GET /trust/edge` for existing pair → `effective_weight < raw_weight` (decay applied, assuming non-zero age)

**pathComputation regression:**
- Existing trust path endpoint still returns a path for a known connected pair
- `trustScore` in path response is now edge-weight-based (non-zero when edges exist)

---

## User Guide & Doc Updates

No user-visible feature in Sprint 65. Documentation updates:
- ADR-054 created (docs/adr/ + landing page JSON)
- social-graph-service CONTEXT.md updated
- services/registry.json updated (new events subscriber, new endpoints)

---

## Critical Implementation Notes

1. **Normalized pair constraint**: Always store edges with `user_id_a < user_id_b` (string comparison on UUID). The upsert function must normalize before writing. Violation = duplicate edges.

2. **`effective_weight` is computed at read time, not stored**: `raw_weight` is the sum of (count × type_weight). The 6-month half-life decay is applied when returning API responses. Do NOT store a decayed weight — it would go stale.

3. **Community-community edge updates**: When `match_completed` fires and requester/responder are members of *different* communities, update `community_trust_edges` for both communities. Query both users' primary community memberships to determine which community-pair edge to increment.

4. **Backfill existing data**: The migration script must backfill `trust_edges` from existing `requests.matches` (status = 'completed'). Without this, the graph starts empty and the Sprint 66 visualization shows nothing on demo server.

5. **Do NOT replace `social_graph.connections`** this sprint. The existing thin connection table is still used by other code. Add `trust_edges` alongside it. Deprecation is Sprint 71 scope.

6. **Weight system is modular by design**: `interaction_weights` table with `community_id = NULL` = platform defaults. Community-specific overrides go in rows with a specific `community_id`. The service reads community override first, falls back to NULL default. This is the extensibility hook for future tuning.

7. **nav.json revert bug**: After editing nav.json, always grep-verify the edit took before committing. Known issue from Sprint 64.
