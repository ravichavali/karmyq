# ADR-078: Community Connection Reconciliation from `request_communities`

**Date**: 2026-06-15
**Status**: Accepted
**Deciders**: Ravi Chavali (maintainer), Claude (Sprint 100)
**Related**: [ADR-068 Community Page Information Architecture (pulse)](ADR-068-community-page-information-architecture.md), [ADR-077 Trust Path Topology](ADR-077-trust-path-platform-topology.md), Sprint 100 audit `docs/bugs/sprint-100-pulse-truth-actionability.md`

## Context

The community pulse counts completed exchanges ("N neighbours helped each other this week"), and the
"How we're connected" surface draws relationships from `social_graph.trust_edges`. These two should
agree: an exchange the pulse counts should be visible as a connection between the two neighbours.

They did not agree. On the live demo, two communities whose pulses each counted **9 completed
exchanges** had **0** per-community `social_graph.trust_edges` rows for those exchanges (776 trust
edges existed globally, none for these communities). A handful of `social_graph.connections` rows
were also missing.

Root cause: when a match completes, request-service publishes a `match_completed` event. The
publisher ([`matches.ts`](../../services/request-service/src/routes/matches.ts)) includes
`request_id`, `requester_id`, `responder_id` — but **not** `community_id`. The social-graph
subscriber created a per-community trust edge only inside an `if (payload.community_id)` guard, so
the edge was essentially never created. The exchange was counted, but no connection formed.

A request can also be **cross-posted to several communities** (`requests.request_communities` is a
join table), so even a single `community_id` on the payload would be wrong — it could only ever name
one of them.

## Decision

**The set of communities a completed exchange belongs to is derived from
`requests.request_communities`, at completion time — never from the event payload.**

- The subscriber's match-completed handler calls `reconcileMatchCompletedCommunities({ requestId,
  requesterId, responderId })`, which looks up every `community_id` in `request_communities` for the
  request and upserts a per-community trust edge for each (via the existing `processMatchCompleted`).
- The `social_graph.connections` upsert remains unconditional (the relationship exists regardless of
  community).
- The handler logic is extracted into an exported `handleMatchCompleted(payload)` so the
  reconciliation is integration-testable without Redis/Bull.
- Historical gaps are repaired by an **idempotent backfill script**
  (`scripts/backfill-community-connections.sql`), not a migration: for every completed match, ensure
  the connection + a per-community trust edge for each of the request's communities. The script
  prints BEFORE/AFTER counts and is safe to re-run (`ON CONFLICT DO NOTHING`).
- `social_graph.trust_edges_live` is a **VIEW** — all writes go through the trust-edge service/store,
  never the view.

## Consequences

### Positive Consequences

- Every counted exchange is reachable: the pulse number and "How we're connected" agree.
- Cross-posted requests correctly form edges in **all** their communities, not just one.
- The fix is at the source (event path + a one-time backfill), not a client-side patch.
- `handleMatchCompleted` is now unit/integration-testable.

### Negative Consequences

- Each completed match now does one extra `request_communities` lookup plus one trust-edge upsert per
  community (was: at most one, almost always zero). Volume is small (matches are low-frequency).
- The backfill touches every historical completed match once; it is idempotent but should be run with
  before/after counts recorded.

### Neutral Consequences

- The payload `community_id` field is now ignored for reconciliation. It is left in the
  `MatchCompletedPayload` type as optional/legacy; the publisher need not start sending it.

## Alternatives Considered

### Alternative 1: Add `community_id` to the `match_completed` payload

- Description: Have request-service include the community on the event.
- Cons: A request can belong to multiple communities, so a single field is wrong; couples the
  publisher to social-graph concerns; does nothing for the historical backlog.
- Rejected: the request's communities are already authoritative in `request_communities`.

### Alternative 2: Recompute trust edges lazily when "How we're connected" is read

- Description: Derive edges on read instead of on completion.
- Cons: Pushes graph computation into a hot read path; trust edges are also consumed by clustering
  (fission) and path computation, which expect materialized rows.
- Rejected: write-time reconciliation keeps reads cheap and the graph consistent for all consumers.

## Implementation Notes

- Files affected:
  - `services/social-graph-service/src/events/subscriber.ts` — `handleMatchCompleted` + derives
    communities from the request.
  - `services/social-graph-service/src/services/trustEdgeService.ts` —
    `reconcileMatchCompletedCommunities`.
  - `scripts/backfill-community-connections.sql` — one-time idempotent repair (not a migration).
- Tests: `services/social-graph-service/tests/tdd/sprint-100-connection-reconcile.test.ts`.
- Rollback: revert the subscriber/service change; the backfilled rows are valid edges and can stay.

## References

- Sprint 100 audit log: `docs/bugs/sprint-100-pulse-truth-actionability.md`
- `requests.request_communities`, `social_graph.trust_edges`, `social_graph.connections`
