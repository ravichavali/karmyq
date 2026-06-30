# ADR-077: Trust Path Topology is Platform-Wide; Strength is Community-Scoped

**Status**: Implemented
**Date**: 2026-06-14
**Sprint**: 98 (Trust Truth Audit)

## Context

Karmyq shows relationship "trust paths" on many surfaces (feed request cards, provider
pages, trust cards, dibs prompts). The Sprint 98 trust-truth audit asked a question the code
had never answered explicitly: **is a trust path community-scoped or platform-wide?**

Two facts forced the answer:

1. **The exchange graph cannot be cleanly community-scoped.** `computeShortestPath` builds its
   adjacency from completed `requests.matches`. But `requests.help_requests` has **no
   `community_id`** column — a request maps to communities many-to-many through
   `requests.request_communities`. So a completed match cannot be attributed to a single
   community without an arbitrary choice.

2. **A bug forced a decision.** `/paths/:targetUserId` and `/paths/batch` fell back to the
   literal string `'platform'` when no community context was supplied, then compared it to
   `auth.social_distances.community_id` (a `UUID` column). For a user with **no communities**
   (no `currentCommunityId` in the JWT) and no `X-Community-ID` header, this threw
   `invalid input syntax for type uuid: "platform"` → HTTP 500 before any path semantics ran.

## Decision

**Trust-path topology is platform-wide. Trust strength (score) and karma are community-scoped.**

- The exchange path graph (who is connected to whom via completed exchanges) is computed
  **platform-wide**. Trust earned from a real completed exchange is real regardless of which
  community it happened in, and the schema cannot attribute it to one community anyway.
- The `communityId` parameter scopes only the **path trust score** (community `trust_edges`
  weights) and intermediate-node **karma** (per-community `reputation.karma_records`), plus the
  **cache key** (`auth.social_distances`).
- Community context resolves via a single shared resolver
  (`social-graph-service/src/services/communityContext.ts`):
  `X-Community-ID` header → JWT `currentCommunityId` → **platform sentinel** (a fixed all-zeros
  UUID, `PLATFORM_COMMUNITY_ID`). The literal string `'platform'` is never sent to a UUID column.
  A present-but-malformed `X-Community-ID` is a `400` validation error, not a `500`.
- Every path/trust-card/batch response carries an explicit `scope` field: `'community'` when a
  real community UUID was supplied, `'platform'` otherwise. The frontend labels paths
  accordingly and passes the visible surface's community where one exists.
- Sprint 116's request-scoped relationship lens also computes its disclosed shortest path over this
  platform-wide completed-help topology. Request visibility remains a separate request-service
  authorization decision; a platform-wide path never makes an otherwise unreachable request visible.

## Consequences

- No path request can 500 from a missing/garbage community context.
- The same (A, B) pair yields the same exchange topology under any community context; only the
  score/karma differ. This is intentional and now documented, not accidental.
- Community-scoped graph **membership** is a separate concern (ADR-unchanged, Sprint 98 fix):
  ego/aggregate graphs filter neighbors through active `communities.members`; trust paths do not
  claim community membership of intermediate nodes.
- The reciprocal lens may label active community affiliations around either participant, but it does
  not reinterpret the platform path as belonging to one community or use community labels as edges.

## Alternatives considered

- **Community-scoped exchange topology** (the spec's "preferred"): rejected — impossible without
  a schema change (matches are many-to-many with communities), and it would erase legitimate
  cross-community trust.
- **Keep platform-wide but unlabeled**: rejected — surfaces could imply a community-local path.
  The `scope` field makes the meaning explicit.
