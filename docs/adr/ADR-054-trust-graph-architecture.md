# ADR-054: Trust Graph Architecture

**Status**: Implemented
**Date**: 2026-05-25
**Deciders**: Ravi Chavali

---

## Context

The platform previously used karma as a proxy for trust in path computation. Karma measures what a user has done globally; it does not capture the bond between two specific people. The `social_graph.connections` table tracked whether two users had exchanged, but carried no weight, count, or community scope.

Sprint 65 adds a dedicated trust edge layer as the data foundation for the v10.0 trust network arc (Sprints 65–71). The arc includes trust visualization (66), trust-gated governance (67), data half-life cleanup (68), community fission (69), and fusion (70).

---

## Decision

### Trust ≠ Karma

Karma is a unidirectional reputation score: you receive it when someone marks your help as complete. Trust is a bidirectional, community-scoped bond between two people that grows through repeated successful interactions. These are distinct concepts that deserve distinct data structures.

### `social_graph.trust_edges`

A new table captures interaction history between pairs of users, community-scoped:

```
trust_edges (
  user_id_a, user_id_b        -- normalized: user_id_a < user_id_b (UUID string sort)
  community_id                 -- community scope
  match_completed_count        -- helpfulness interactions
  endorsement_count            -- explicit endorsements
  karma_given_count            -- karma given to this person
  event_count                  -- co-attended events
  raw_weight                   -- computed sum: counts × type weights
  last_interaction_at          -- used for decay
)
```

**Normalization invariant**: `user_id_a < user_id_b` is enforced at write time by `upsertTrustEdge` and at the DB level via `CHECK (user_id_a::text < user_id_b::text)`. This prevents duplicate rows for the same pair.

### Interaction Type Hierarchy

Not all interactions carry the same weight. The platform defaults are:

| Type | Weight | Rationale |
|------|--------|-----------|
| `match_completed` | 10 | Highest — real help given and received |
| `endorsement` | 5 | Explicit trust signal |
| `karma_given` | 3 | Appreciation, not necessarily help |
| `event` | 2 | Co-presence, weakest signal |

These are stored in `social_graph.interaction_weights` and can be overridden per community. The fallback chain is: community-specific weight → platform default (NULL community_id) → 1.0 hardcoded.

### `effective_weight` Computed at Read Time

Raw weight is stored (`raw_weight = Σ count × type_weight`). Decay is applied only at API response time:

```
effective_weight = raw_weight × 0.5^(age_ms / HALF_LIFE_MS)
```

where `HALF_LIFE_MS = 6 months`. At exactly 6 months, effective weight is 50% of raw weight. At 12 months, 25%. This is consistent with the reputation decay mechanism in ADR-011.

### Fractal Property

The same edge structure exists at two levels:
- **User↔User**: `social_graph.trust_edges`
- **Community↔Community**: `social_graph.community_trust_edges`

When a match completes and the two users have different primary communities, a community-community edge is also incremented. This allows Sprint 69 (fission) and Sprint 70 (fusion) to detect communities with strong or weak cross-community bonds.

### Relationship to `social_graph.connections`

`social_graph.connections` is preserved as-is. It will be deprecated in Sprint 71. `trust_edges` runs alongside it. Existing code that queries `connections` continues to work.

---

## Consequences

**Positive**:
- Path trust scores are now derived from actual edge weights, not karma sums
- Community-scoped data supports community-level trust visualization (Sprint 66)
- Modular weight config enables per-community tuning without schema changes
- 6-month half-life decay keeps the graph fresh and relevant
- Backfill from `requests.matches` ensures Sprint 66 visualizer has data on first deploy

**Negative**:
- Two parallel graph tables (`connections` + `trust_edges`) until Sprint 71 cleanup
- `computeShortestPath` fetches trust edge weights after BFS (extra queries per path edge)

**Neutral**:
- `effective_weight` not stored — computed on read. Queries always return current decay values without batch recomputation jobs.

---

## Implementation Notes

- `upsertTrustEdge` uses `ON CONFLICT DO UPDATE` — idempotent, no duplicate rows
- Community-community edge normalization mirrors user-user: `community_id_a < community_id_b`
- The subscriber fires on `match_completed` events from the `karmyq-events` Bull queue
- Backfill joins `requests.request_communities` to get community scope for historical matches

---

## Related

- ADR-011: Reputation Decay System (same 6-month half-life constant)
- ADR-004: Microservices + Event-Driven (Bull queue subscriber pattern)
- Sprint 66: Trust Graph Visualization (primary consumer of `GET /trust/graph/:communityId`)
- Sprint 67: Governance Implementation (trust scores gate role eligibility)
- Sprint 69: Community Fission (uses `community_trust_edges`)
- Sprint 70: Community Fusion (uses `community_trust_edges`)
