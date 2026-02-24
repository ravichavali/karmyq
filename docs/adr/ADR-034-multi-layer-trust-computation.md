# ADR-034: Multi-Layer Trust Path Computation

**Date**: 2026-02-24
**Status**: Implemented
**Deciders**: Development Team
**Related**: ADR-019 (Referral Chain Trust), ADR-020 (Trust-First Design), ADR-021 (Trust Path Filtering)

## Context

When a user sees a request in the feed, we want to show them how they're connected to the requester. The challenge: not all users have completed exchanges yet. New members, recently joined communities, and sparse graphs mean that a pure exchange-based trust path would return no connection for many feed items — making the feature useless for users who need it most.

Additionally, "trust" on Karmyq is multi-dimensional:
- **Exchange trust**: You've actually worked together (or through intermediaries who have)
- **Community trust**: You've both been accepted into the same space
- **Invitation trust**: Someone vouched for both of you through the referral chain

These represent genuinely different signals, not just fallbacks for data sparsity.

## Decision

Compute trust paths in three layers with ordered fallback. Return the **strongest available connection type**:

### Layer 1: Exchange Graph (Primary)

- Build a platform-wide bidirectional graph from completed exchanges (`requests.matches` with `status = 'completed'`)
- Run BFS from source user, max depth 4
- Trust score = sum of karma of all intermediate nodes
- Connection type: `exchange`

### Layer 2: Community Membership (Fallback)

- Check whether both users are active members of at least one shared community
- Path runs through the community admin (or creator) as anchor
- If one user IS the admin: 1° connection; otherwise 2° through admin
- Trust score: 0 (no karma signal available)
- Connection type: `community_member`

### Layer 3: Invitation Chain (Last Resort)

- Build a bidirectional graph from accepted invitations (`auth.user_invitations` where `invitation_accepted_at IS NOT NULL`)
- Run BFS, max depth 3
- Trust score: 0
- Connection type: `invitation_chain`

If no path is found across all three layers, return null (no badge shown).

### Caching

All computed paths are stored in `auth.social_distances` with a 7-day TTL:
- Cache key: `(user_a_id, user_b_id, community_id)`
- Cache stores: `degrees_of_separation`, `shortest_path` (full node array), `path_trust_score`, `connection_type`
- Cache is **immediately invalidated** when a new exchange completes between the two users — the direct edge now exists and any cached indirect path is stale

## Consequences

### Positive

- **Coverage**: Nearly every feed item has a connection badge, not just for power users with many exchanges
- **Honest Signals**: Different badge colors/types communicate the strength of the connection honestly — a community membership badge doesn't pretend to be an exchange connection
- **Progressive**: New users see invitation chain badges, which strengthen to community badges, which strengthen to exchange badges as they become more active
- **Performance**: 7-day caching means the expensive BFS only runs once per user pair per week

### Negative

- **Complexity**: Three code paths to maintain; each has its own graph query and BFS implementation
- **Community path is approximate**: Using the admin as anchor may not reflect the actual social closeness between two members
- **Invitation layer can be misleading**: Invitation chains can extend far from meaningful social proximity

### Neutral

- The exchange graph is platform-wide, not community-scoped. A connection established in one community is recognized across all communities.

## Implementation

**Key files:**
- `services/social-graph-service/src/services/pathComputation.ts` — `computeTrustPath()` orchestrates the three layers; individual functions: `computeShortestPath()`, `computeCommunityPath()`, `computeInvitationPath()`
- `services/social-graph-service/src/routes/paths.ts` — `GET /paths/:targetUserId` and `POST /paths/batch`
- `apps/frontend/src/components/TrustPathBadge.tsx` — renders compact inline badge from path data
- `apps/frontend/src/hooks/useTrustPath.ts` — fetches path for a given `targetUserId`

**Database:**
- `auth.social_distances` — path cache with 7-day expiry and `connection_type` column
- `auth.user_invitations` — invitation lineage used by Layer 3

## Alternatives Considered

### Exchange-Only
Simple, but leaves most feed items without a badge. Rejected because the feature would appear broken for new users.

### Single Unified Graph (All Edge Types)
Combine exchanges + invitations + community membership into one graph and run a single BFS. Rejected because it would conflate different trust signal strengths — a direct exchange and a distant invitation chain would be treated identically.

### Location-Based Proximity
Use geographic distance as a proxy for trust. Rejected — geographic proximity does not imply trust, and excludes remote/digital help.
