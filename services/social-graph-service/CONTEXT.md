# Social Graph Service Context

> **Quick Start**: `cd services/social-graph-service && npm run dev`
> **Port**: 3010 | **Health**: http://localhost:3010/health

## Purpose

Manages invitation tracking, social graph computation, and trust path visualization. Enables users to see how they're connected through invitation chains and prioritize help requests from their extended network.

## Core Principles

**"Trust flows through relationships"** - The service makes social connections visible and uses invitation paths as a primary trust signal for feed ranking and request matching.

## Database Schema

### Tables Owned by This Service

```sql
-- Invitation tracking
auth.user_invitations
auth.inviter_stats

-- Precomputed paths (cache)
auth.social_distances

-- User table extensions
auth.users.invited_by
auth.users.invitation_accepted_at
auth.users.show_connection_path
auth.users.show_who_invited_me
auth.users.show_who_i_invited

-- Sprint 65: Trust graph (weighted, community-scoped edges)
social_graph.trust_edges (
  id, user_id_a, user_id_b,         -- normalized: user_id_a < user_id_b
  community_id,                      -- community scope
  match_completed_count,             -- per-type interaction counts
  endorsement_count,
  karma_given_count,
  event_count,
  raw_weight,                        -- peak weight (never decayed; grows with interactions)
  stability,                         -- Sprint 68: multiplier for effective half-life (starts 1.0, grows 20%/interaction)
  last_interaction_at,               -- used for Ebbinghaus decay computation
  created_at, updated_at
)

-- Sprint 68: Live view — computes current_weight via Ebbinghaus decay at query time
-- Formula: raw_weight × e^(-days_since_interaction / (stability × half_life))
-- NEVER INSERT or UPDATE this view — it is read-only.
social_graph.trust_edges_live (
  ... all trust_edges columns ...,
  current_weight                     -- computed column: effective weight right now
)

-- Sprint 68: Per-community decay tuning
social_graph.trust_decay_config (
  id, community_id,                  -- NULL community_id = global default
  base_half_life_days,               -- default: 30 days
  stability_growth_rate,             -- default: 0.20 (20% per interaction)
  disappearance_threshold,           -- default: 0.5 (edge swept when current_weight falls below)
  created_at, updated_at
)

social_graph.interaction_weights (
  id, community_id,                  -- NULL community_id = platform default
  interaction_type,                  -- match_completed | endorsement | karma_given | event
  weight                             -- platform defaults: 10, 5, 3, 2
)

social_graph.community_trust_edges (
  id, community_id_a, community_id_b,  -- normalized pair
  cross_interaction_count,
  weight,
  last_interaction_at
)
```

See [migration 009_social_graph.sql](../../infrastructure/postgres/migrations/009_social_graph.sql) and [migration 20260525-trust-graph-foundation.sql](../../infrastructure/postgres/migrations/20260525-trust-graph-foundation.sql) for complete schema.

### Tables Read by This Service

- `auth.users` - User information for path display
- `communities.members` - Community membership for RLS
- `reputation.karma_records` - Karma scores for trust path calculation
- `requests.matches` + `requests.help_requests` - completed-help topology for reciprocal relationship
  context (Sprint 116; platform-wide under ADR-077)

Sprint 116 adds no table, column, view, or migration. `relationshipContextDb.ts` reads the existing
completed-match, active-membership, trust-edge-live, and decay-config sources above.

## Architecture

### Invitation Flow

```
1. User generates invitation code
   ↓
2. Code shared via link/email/SMS/QR
   ↓
3. New user accepts code during signup
   ↓
4. Invitation recorded in graph
   ↓
5. Paths recomputed (lazy, on-demand)
```

### Path Computation Strategy

```
Cache Hit (< 7 days old):
  - Return from auth.social_distances
  - ~50ms response time

Cache Miss:
  - Run BFS algorithm
  - Max depth: 3 degrees
  - Cache result for 7 days
  - ~500ms response time (first time)
```

## API Endpoints

### POST /internal/relationship-context

Service-to-service only. Request-service supplies two participant UUIDs that it derived from an
authorized request, match, or provider offer. Requires `X-Internal-Secret`, fails closed with 503 when
`INTERNAL_SECRET` is not configured, and is mounted before member JWT auth. Returns the strict
provider-free `RelationshipContextProjection` (identity, platform path, bounded one-hop networks,
qualitative links, factual summary). It never accepts request/provider metadata or arbitrary public
member lookup. All deployed Nginx variants return 404 for the corresponding public
`/api/social[-graph]/internal/` prefix; only direct service-network traffic can reach the secret check.

### POST /invitations/generate

Generate a new invitation code for current user.

**Request** (authenticated):
```json
{
  // No body required - uses current user from JWT
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "code": "KARMYQ-MIKE-2024-A7B3",
    "url": "http://localhost:3000/invite/KARMYQ-MIKE-2024-A7B3",
    "created_at": "2025-12-27T10:30:00Z",
    "expires_at": null
  }
}
```

**Implementation**: [src/routes/invitations.ts:11](src/routes/invitations.ts#L11)

**Key Features**:
- Invitation codes follow format: `KARMYQ-{NAME}-{YEAR}-{RANDOM}`
- Uses database function `auth.generate_invitation_code()`
- Automatically updates `inviter_stats.total_invitations_sent`

---

### POST /invitations/accept

Accept an invitation code during user signup.

**Request** (authenticated):
```json
{
  "invitation_code": "KARMYQ-MIKE-2024-A7B3"
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "inviter_id": "uuid-123",
    "community_id": "uuid-456",
    "accepted_at": "2025-12-27T10:35:00Z"
  }
}
```

**Implementation**: [src/routes/invitations.ts:91](src/routes/invitations.ts#L91)

**Side Effects**:
1. Updates `user_invitations.invitation_accepted_at`
2. Sets `users.invited_by` for the new user
3. Triggers `update_inviter_stats_on_acceptance()` (increments `total_invitations_accepted`)

---

### GET /invitations

Get invitation history for current user.

**Response**:
```json
{
  "success": true,
  "data": {
    "sent": [
      {
        "id": "uuid-789",
        "invitation_code": "KARMYQ-MIKE-2024-A7B3",
        "invited_at": "2025-12-20T00:00:00Z",
        "accepted_at": "2025-12-21T00:00:00Z",
        "invitee": {
          "id": "uuid-abc",
          "name": "Sarah Rodriguez",
          "karma": 92
        }
      }
    ],
    "received": {
      "id": "uuid-def",
      "invitation_code": "KARMYQ-JOHN-2024-X1Y2",
      "invited_at": "2025-11-15T00:00:00Z",
      "accepted_at": "2025-11-15T00:00:00Z",
      "inviter": {
        "id": "uuid-ghi",
        "name": "Mike Chen"
      }
    }
  }
}
```

**Implementation**: [src/routes/invitations.ts:170](src/routes/invitations.ts#L170)

---

### GET /invitations/stats

Get inviter statistics for current user (gamification metrics).

**Response**:
```json
{
  "success": true,
  "data": {
    "total_invitations_sent": 8,
    "total_invitations_accepted": 7,
    "acceptance_rate": 87.5,
    "avg_invitee_karma": 78.5,
    "avg_invitee_trust_score": 82.3,
    "total_invitee_exchanges": 45,
    "total_network_size": 87,
    "bridge_score": 3,
    "inviter_tier": "gold",
    "tier_updated_at": "2025-12-20T00:00:00Z"
  }
}
```

**Implementation**: [src/routes/invitations.ts:237](src/routes/invitations.ts#L237)

**Inviter Tiers**:
- **Bronze**: Default
- **Silver**: 3+ accepted, 60+ avg karma, 50%+ acceptance
- **Gold**: 5+ accepted, 70+ avg karma, 60%+ acceptance
- **Platinum**: 10+ accepted, 80+ avg karma, 70%+ acceptance

---

### GET /paths/:targetUserId

Get shortest path between current user and target user.

**Parameters**:
- `targetUserId` (URL param): UUID of target user

**Response** (path found):
```json
{
  "success": true,
  "data": {
    "degrees_of_separation": 2,
    "path": [
      { "id": "user-123", "name": "You" },
      { "id": "user-456", "name": "Mike Chen", "karma": 87, "invited_at": "2024-11-15" },
      { "id": "user-789", "name": "Sarah Rodriguez" }
    ],
    "trust_score": 87,
    "cached": true,
    "computed_at": "2025-12-27T10:00:00Z"
  }
}
```

**Response** (no path):
```json
{
  "success": true,
  "data": {
    "degrees_of_separation": null,
    "path": null,
    "message": "No connection found (4+ degrees or unconnected)"
  }
}
```

**Implementation**: [src/routes/paths.ts:12](src/routes/paths.ts#L12)

**Algorithm**: Bidirectional BFS (see [src/services/pathComputation.ts](src/services/pathComputation.ts))

**Performance**:
- Cache hit: ~50ms
- Cache miss: ~500ms (first computation)
- Cache TTL: 7 days

---

### POST /paths/batch

Get paths for multiple target users (optimized for feed ranking).

**Request**:
```json
{
  "target_user_ids": ["uuid-1", "uuid-2", "uuid-3", ...]
}
```

**Response**:
```json
{
  "success": true,
  "data": [
    {
      "target_user_id": "uuid-1",
      "degrees_of_separation": 1,
      "trust_score": 92,
      "cached": true
    },
    {
      "target_user_id": "uuid-2",
      "degrees_of_separation": 2,
      "trust_score": 179,
      "cached": false
    }
  ]
}
```

**Implementation**: [src/routes/paths.ts:95](src/routes/paths.ts#L95)

**Limits**:
- Max 50 users per request
- Automatically caches newly computed paths

**Use Case**: Feed Service calls this endpoint to get social proximity scores for all requesters in the feed, then ranks requests accordingly.

---

> **Canonical metric (Sprint 79 / ADR-063):** every node `trust_score` across
> the graph endpoints is the *decayed* sum — `SUM(current_weight)` from
> `social_graph.trust_edges_live` — in `getTrustGraph`, `getTrustGraphAggregate`,
> and `getFullCommunityGraph`. The earlier raw-weight node aggregate on the
> ego/aggregate endpoints was retired so node and edge values agree.

> **Removed (Sprint 83):** `getTrustGraphAggregateForCenter` and the `GET
> /trust/graph?center=` expansion path were deleted as orphaned code — Sprint 79
> dropped click-to-recenter, leaving this path unreachable. `GET /trust/graph` now
> always returns the calling user's own aggregate ego-network.

### GET /trust/graph

Aggregate ego-network across all of the calling user's communities (Sprint 67). Returns calling user + direct neighbors + edges among them, de-duplicated and summed across communities.

**Auth required**: Bearer JWT.

**Response**: `{ nodes: TrustNode[], links: TrustLink[] }` — nodes include `trust_score`, `karma`, `isCurrentUser`; links include `effective_weight`.

**Primary consumer**: `apps/frontend/src/components/NetworkGraph.tsx` (dashboard Your Network panel)

---

### GET /trust/graph/:communityId

Ego-network for the calling user in a specific community — calling user + direct neighbors + edges among them (Sprint 67 rewrite). Returns the calling user's ego-centric neighborhood, never the full community graph.

**Auth required**: Bearer JWT. Caller must be an active member of the community.

**Response**:
```json
{
  "success": true,
  "data": {
    "nodes": [{ "id": "uuid", "name": "Alice", "trust_score": 42.5, "karma": 120, "isCurrentUser": false }],
    "links": [{ "source": "uuid-a", "target": "uuid-b", "effective_weight": 10.0 }]
  }
}
```

**Primary consumer**: `apps/frontend/src/components/community/tabs/TrustGraphTab.tsx` (My Network sub-tab)

---

### GET /trust/graph/:communityId/full

Full community trust graph (Sprint 74) — up to 149 **neutrally selected** non-caller active members, UNION the calling user (always included), plus every edge between that member set. Sprint 115 (ADR-083): selection is by normalized name + ID (`ORDER BY LOWER(BTRIM(u.name)), user_id LIMIT 149`), **never** by trust score — so the member set carries no ranking. The response adds structural completeness metadata so an incomplete graph can say so. Unlike `/trust/graph/:communityId` (which returns only the caller's ego-network), this returns the whole community topology, capped at 150 nodes. Reads decay-adjusted weights from the `trust_edges_live` VIEW.

Implemented by `getFullCommunityGraph(communityId, callingUserId)` in `src/database/trustEdgeDb.ts`. Registered **before** `/trust/graph/:communityId` so Express doesn't match `full` as a communityId.

**Auth required**: Bearer JWT. Caller must be an active member of the community.

**Response** (Sprint 112 ADR-082 safe projection — no node `trust_score`/`karma`, no edge weights; Sprint 115 adds `meta`):
```json
{
  "success": true,
  "data": {
    "nodes": [{ "id": "uuid", "name": "Alice", "isCurrentUser": true }],
    "links": [{ "source": "uuid-a", "target": "uuid-b", "relationship_state": "warm" }],
    "meta": { "totalActiveMembers": 151, "truncated": true }
  }
}
```

`meta.totalActiveMembers` is the community's full active-member count (independent of the 150 cap); `truncated` is `totalActiveMembers > nodes.length`. The frontend uses this to render "Showing N of M active members. This view is incomplete." and to suppress whole-community structural interpretation when the view is partial.

**Primary consumer**: `apps/frontend/src/components/community/tabs/TrustGraphTab.tsx` (This Community sub-tab — the `CommunityRingGraph` single-ring renderer)

---

### GET /trust/neighborhood/:userId

Sprint 111 (ADR-081) — privacy-scoped recursive ego-neighborhood backing the full-page `/network` explorer. Walks `trust_edges_live` outward from `:userId` and returns each reachable person with their shortest BFS depth.

**Query params**: `depth` = `1|2|3` (default `1`); optional `communityId` (UUID).

**Auth required**: Bearer JWT (mounted at `/trust`).

**Visibility (resolved BEFORE any traversal — `resolveNeighborhoodScope` in `routes/trustGraph.ts`)**:
- With `communityId`: the caller **and** the center user must both be active members of that community.
- Without `communityId`: the caller and center must share **at least one** active community; the traversal is scoped to that shared set.
- A center the caller can't see returns **404** (`NEIGHBORHOOD_NOT_FOUND`) — indistinguishable from a non-existent user, so it can't be used to probe account existence.

**Traversal (`getTrustNeighborhood` in `src/database/trustEdgeDb.ts`)**: a recursive CTE seeds the center at depth 0 and walks either endpoint of `trust_edges_live`, constrained to `community_id = ANY(allowed)` and **active** membership in each traversed edge's community, stopping at `depth`. Each user collapses to its minimum (shortest) depth. Capped at **80 nodes** (fetched as `maxNodes+1`, ordered closest-first, to detect truncation); links are returned only between retained nodes. `trust_edges_live` is a VIEW — read-only.

**Validation errors** (ADR-074 shape): `INVALID_USER_ID` / `INVALID_DEPTH` / `INVALID_COMMUNITY_ID` → 400.

**Response**:
```json
{
  "success": true,
  "data": {
    "nodes": [
      { "id": "center", "name": "Me", "trust_score": 0, "karma": 0, "isCurrentUser": true, "degrees_of_separation": 0 },
      { "id": "peer-1", "name": "Alice", "trust_score": 2.5, "karma": 4, "isCurrentUser": false, "degrees_of_separation": 1 }
    ],
    "links": [{ "source": "center", "target": "peer-1", "raw_weight": 3, "effective_weight": 2.5 }],
    "meta": { "depth": 2, "truncated": false }
  }
}
```

Only the authenticated caller's own node is marked `isCurrentUser`, and (Sprint 111 privacy) only that node carries real `trust_score`/`karma` — every other node's are **zeroed at the data boundary** via `redactNodeMetrics` in `trustEdgeDb.ts`. This applies to **all** graph reads (`getTrustGraph`, `getFullCommunityGraph`, `getTrustGraphAggregate`, `getTrustNeighborhood`), so a member's reputation numbers never leave the API for anyone else — names and edges (structure) are still returned. The frontend additionally hides them in the UI, but the API is the real boundary.

**Primary consumer**: `apps/frontend/src/pages/network.tsx` (ego baseline + progressive expansion).

---

### GET /trust/edge

Return a single trust edge for a user pair in a community.

**Query params**: `userA`, `userB`, `communityId`

**Response**: Edge object with `effective_weight`, or `{ success: true, data: null }` if no edge exists (not 404).

---

### GET /trust/communities (Sprint 79 — inter-community depth)

Inter-community depth graph for the calling user. Nodes are the caller's active
communities plus any community reachable by an inter-community edge (organic
trust or fission lineage): `{ id, name, member_count, status, is_member }`. Links
come in two types:

- `organic` — undirected ties from `social_graph.community_trust_edges` (accrued
  as members exchange help across communities); `weight` = interaction strength.
- `fission` — directed parent→child lineage from executed
  `communities.split_proposals`; `weight` = 1.

Scoped to the caller's communities + one hop of reach, so a user only sees
communities adjacent to ones they belong to (no global enumeration). Implemented
by `getCommunityDepthGraph(callingUserId)` in `src/database/trustEdgeDb.ts`.

**Auth required**: Bearer JWT.

**Primary consumer**: `apps/frontend/src/components/graphs/CommunityDepthGraph.tsx` (dashboard "Your Trust Network" → Communities).

---

### GET /network

Get the current user's local network graph from the materialized connections table.

**Response**:
```json
{
  "success": true,
  "data": {
    "nodes": [
      {
        "id": "uuid-123",
        "name": "Mike Chen",
        "provider_id": null
      },
      {
        "id": "uuid-789",
        "name": "Sarah Rodriguez",
        "provider_id": "uuid-provider-456"
      }
    ],
    "edges": [
      {
        "source": "uuid-123",
        "target": "uuid-789",
        "type": "exchange"
      },
      {
        "source": "current-user-id",
        "target": "uuid-123",
        "type": "community"
      }
    ]
  }
}
```

**Implementation**: [src/routes/network.ts](src/routes/network.ts)

**Data Source**: Reads from `social_graph.connections` materialized table built by the network materialization process.

**Node Fields**:
- `id` - User UUID
- `name` - User display name
- `provider_id` - Optional provider UUID (null if user is not a provider)

**Edge Fields**:
- `source` - Source user UUID
- `target` - Target user UUID
- `type` - Connection type: `"exchange"` (mutual help exchange) or `"community"` (co-members)

---

## Key Features

### 1. Invitation Code Generation

Codes follow format: `KARMYQ-{NAME}-{YEAR}-{RANDOM}`

**Example**: `KARMYQ-MIKE-2024-A7B3`

- `KARMYQ`: Prefix
- `MIKE`: Inviter's name (sanitized, alphanumeric only)
- `2024`: Year
- `A7B3`: Random 4-character suffix

**Database Function**:
```sql
SELECT auth.generate_invitation_code('Mike Chen', 2024);
-- Returns: KARMYQ-MIKECHEN-2024-A7B3
```

**Collision Prevention**: Loop until unique code is generated.

---

### 2. Bidirectional BFS Path Computation

**Algorithm**: `computeShortestPath(sourceUserId, targetUserId, communityId)`

**Steps**:
1. Build adjacency list from `auth.user_invitations`
2. Treat graph as bidirectional (trust flows both ways)
3. BFS from source to target
4. Max depth: 3 degrees
5. Return `null` if no path found

**Optimization**: Bidirectional search reduces search space from O(b^d) to O(2 * b^(d/2))

**Example Output**:
```typescript
{
  degrees: 2,
  userIds: ['user-a', 'user-b', 'user-c'],
  path: [
    { id: 'user-a', name: 'You' },
    { id: 'user-b', name: 'Mike', karma: 87, invited_at: '2024-11-15' },
    { id: 'user-c', name: 'Sarah' }
  ],
  trustScore: 87 // Sum of intermediate karma (87 for Mike)
}
```

**Implementation**: [src/services/pathComputation.ts:23](src/services/pathComputation.ts#L23)

---

### 3. Path Caching

**Cache Table**: `auth.social_distances`

**TTL**: 7 days

**Invalidation**:
- Automatic (expires_at timestamp)
- No manual invalidation (yet)

**Cache Hit Rate Target**: >95% (most paths precomputed)

**Query**:
```sql
SELECT degrees_of_separation, shortest_path, path_trust_score
FROM auth.social_distances
WHERE user_a_id = $1 AND user_b_id = $2 AND community_id = $3
  AND expires_at > NOW()
```

---

### 4. Privacy Controls

Users can control social graph visibility via `auth.users` columns:

```sql
show_connection_path BOOLEAN DEFAULT true;      -- Others can see path to me
show_who_invited_me BOOLEAN DEFAULT true;       -- Show "Invited by X" on profile
show_who_i_invited BOOLEAN DEFAULT false;       -- Hide my invitees from public
```

**Default Posture**: Transparent (all visible)

**Rationale**: Transparency builds trust, which is the core value proposition.

---

## Integration with Other Services

### Feed Service

**Use Case**: Rank feed requests by social proximity

**Integration**:
```javascript
// Feed Service calls:
POST /paths/batch
{
  "target_user_ids": ["requester-1", "requester-2", ...]
}

// Social Graph Service returns:
[
  { "target_user_id": "requester-1", "degrees_of_separation": 1, "trust_score": 92 },
  { "target_user_id": "requester-2", "degrees_of_separation": 3, "trust_score": 234 }
]

// Feed Service uses this for ranking:
score += (degrees === 1 ? 30 : degrees === 2 ? 20 : degrees === 3 ? 10 : 0)
```

**Benefit**: Requests from 1° connections rank 30 points higher.

---

### Request Service

**Use Case**: Show "Connected through X" badge on request cards

**Integration**:
```javascript
// Request Service enriches requests with social context
const path = await fetch(`/paths/${requesterId}`);

// Returns:
{
  "degrees_of_separation": 2,
  "path": [
    { "name": "You" },
    { "name": "Mike Chen", "relation": "invited you" },
    { "name": "Sarah Rodriguez", "relation": "invited by Mike" }
  ]
}
```

**Display**: Show connection path directly on request card.

---

### Auth Service

**Use Case**: Accept invitation code during signup

**Flow**:
1. User signs up with invitation code
2. Auth Service calls `POST /invitations/accept`
3. Social Graph Service links inviter → invitee
4. User's `invited_by` field is set

---

## Events Published

None currently. Future consideration:

- `invitation.sent` - When code is generated
- `invitation.accepted` - When code is used
- `path.computed` - When new path is calculated

---

## Events Consumed

### match_completed

When a match is marked complete in the Request Service.

**Listener**: [src/events/subscriber.ts](src/events/subscriber.ts) — the handler body is the exported
`handleMatchCompleted(payload)` (Sprint 100), so the reconciliation is integration-testable without
Redis/Bull.

**Actions** (in order):
1. Clear trust path cache (`auth.social_distances`) for the two users
2. Upsert `social_graph.connections` exchange edge
3. **Reconcile per-community trust edges (Sprint 100 / ADR-078):** derive the request's communities
   from `requests.request_communities` (via the payload's `request_id`) and upsert a
   `social_graph.trust_edges` weighted edge for **each** — via `reconcileMatchCompletedCommunities()`
   → `processMatchCompleted()`. **This no longer depends on the payload carrying `community_id`** (the
   request-service publisher never set it, so the old `if (payload.community_id)` guard meant a
   community trust edge essentially never formed — the live audit found 0 trust edges for two
   communities whose pulses counted 9 completed exchanges each). A request cross-posted to several
   communities now correctly forms an edge in all of them.
4. Within `processMatchCompleted`, if users have different primary communities, increment
   `social_graph.community_trust_edges` (Sprint 65)

Historical gaps are repaired by the one-time idempotent backfill
`scripts/backfill-community-connections.sql` (not a migration).

---

## Performance Targets

| Metric | Target | Max Acceptable |
|--------|--------|----------------|
| Path computation (cached) | <50ms | <100ms |
| Path computation (uncached) | <500ms | <1s |
| Batch path computation (50 users) | <2s | <5s |
| Invitation code generation | <100ms | <200ms |

---

## Common Tasks

### Generate Invitation Code

```bash
curl -X POST http://localhost:3010/invitations/generate \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json"
```

### Accept Invitation

```bash
curl -X POST http://localhost:3010/invitations/accept \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"invitation_code": "KARMYQ-MIKE-2024-A7B3"}'
```

### Get Path Between Users

```bash
curl http://localhost:3010/paths/{targetUserId} \
  -H "Authorization: Bearer $TOKEN"
```

### Get Batch Paths (Feed Ranking)

```bash
curl -X POST http://localhost:3010/paths/batch \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"target_user_ids": ["uuid-1", "uuid-2", "uuid-3"]}'
```

### View Service Logs

```bash
docker logs karmyq-social-graph-service -f
```

---

## Environment Variables

```bash
# Server
PORT=3010
NODE_ENV=development

# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=karmyq_db
DB_USER=karmyq_user
DB_PASSWORD=your_password_here

# Auth
JWT_SECRET=dev_jwt_secret_change_in_production

# Frontend
FRONTEND_URL=http://localhost:3000

# Logging
LOG_LEVEL=info
```

---

## Testing

### Unit Tests

**Status**: Not yet implemented

**Planned Coverage**:
- BFS algorithm correctness
- Path selection logic (shortest path, tie-breaking by trust score)
- Privacy controls (hide path when `show_connection_path = false`)
- Invitation code generation (uniqueness, format validation)

### Integration Tests

**Status**: Not yet implemented

**Planned Coverage**:
- End-to-end path computation
- Cache hit/miss scenarios
- Batch path computation
- Invitation acceptance flow

### Manual Testing

```bash
# 1. Generate invitation code
curl -X POST http://localhost:3010/invitations/generate \
  -H "Authorization: Bearer $USER_A_TOKEN"

# 2. Accept invitation (as different user)
curl -X POST http://localhost:3010/invitations/accept \
  -H "Authorization: Bearer $USER_B_TOKEN" \
  -d '{"invitation_code": "KARMYQ-ALICE-2024-A7B3"}'

# 3. Compute path
curl http://localhost:3010/paths/$USER_B_ID \
  -H "Authorization: Bearer $USER_A_TOKEN"
```

---

## Trust Decay Model (Sprint 68)

The trust decay model uses **intrinsic Ebbinghaus decay** computed live by a PostgreSQL view. No background job modifies trust weights — time and the view formula do all the work.

- `raw_weight`: Peak accumulated weight. Only grows when a new interaction is recorded. Never decayed.
- `stability`: Starts at 1.0. Grows by 20% per interaction: `stability = stability × 1.20`. A higher stability value produces a longer effective half-life.
- `current_weight`: Computed by `trust_edges_live` at query time: `raw_weight × e^(-days / (stability × half_life))`
- `trust_decay_config`: Per-community tuning table. A global row (`community_id = NULL`) acts as the platform default.

All `getTrustGraph*` functions query `trust_edges_live`, never `trust_edges` directly.

The daily trust edge sweep job (`trustEdgeSweepJob.ts`) removes edges where `current_weight < disappearance_threshold`.

See [ADR-056](../../docs/adr/ADR-056-intrinsic-trust-decay.md) for full decision record.

---

## Recent Changes

### Sprint 98: Trust Truth Audit (2026-06-14, ADR-077)
- **NEW**: `src/services/communityContext.ts` — `resolveCommunityContext(header, jwtCurrentCommunityId)` + `PLATFORM_COMMUNITY_ID` sentinel + `isUuid`. Single resolver used by `/paths/:id`, `/paths/batch`, `/trust-card/:id`. Fixes BUG-098-002: the routes no longer pass the literal string `'platform'` into the UUID `auth.social_distances.community_id` column (which 500'd for users with no `currentCommunityId`); a malformed `X-Community-ID` is now a 400, missing context falls back to the platform sentinel. Each response carries `scope: 'community' | 'platform'`.
- **SEMANTICS (ADR-077)**: exchange-path topology is platform-wide (schema can't attribute a match to one community — `help_requests` has no `community_id`); `communityId` scopes only score/karma/cache key.
- **FIX (BUG-098-003)**: `getTrustGraph` (ego) and `getTrustGraphAggregate` now filter neighbors through an `active_neighbors` CTE (`JOIN communities.members ... status='active'`) and constrain links to the resolved node set, so departed members no longer appear under "your network in this community". `getFullCommunityGraph` already filtered active members.
- **LEGACY (BUG-098-006)**: `GET /network` marked legacy in source (frontend `getNetwork()` wrapper removed); use `/trust/graph*`. Orphaned `type='exchange'` connections cleaned by migration `20260614-trust-truth-repair.sql`.

### Sprint 90: Visible Decay Model (2026-06-07, ADR-070)
- **NEW**: `classifyDecayTier(currentWeight, threshold)` in `@karmyq/shared` (`src/trust/decayTier.ts`) — the SINGLE source of the band math (`strong` r≥3, `warm` 2–3, `fading` 1.3–2, `nearly_forgotten` 1–1.3, `swept` r<1). Consumed by the routes + tests; never inline the bands.
- **CHANGED**: `GET /trust/graph/:communityId` + `/trust/graph/:communityId/full` — each edge now also carries `currentWeight` (= live `effective_weight`), `disappearanceThreshold` (resolved via `getDecayConfig`), and `decayTier`. Enriched in `trustGraph.ts` via the pure `enrichLinksWithDecay(links, threshold)` (exported, unit-tested).
- **NEW**: `GET /trust/me/memory?communityId=` — `{ activeCount, fading[], nearlyForgotten[] }` from `trust_edges_live`; backs the profile Memory section. Members-only (DB member check).
- **NEW**: `GET /trust/relationships/fading?communityId=` — nearly-forgotten bonds for the re-warming nudge.
- **NEW**: pure helpers `buildMemoryResponse(rows, threshold)` + `enrichLinksWithDecay` exported from `src/routes/trustGraph.ts` (tested in `tests/tdd/sprint-90-decay-tier.test.ts`). Reads only — `trust_edges_live` is a VIEW.

### Sprint 68: Interaction Half-Life (2026-05-26)
- **NEW**: `stability FLOAT NOT NULL DEFAULT 1.0` column on `social_graph.trust_edges`
- **NEW**: `social_graph.trust_decay_config` table — per-community Ebbinghaus decay parameters
- **NEW**: `social_graph.trust_edges_live` VIEW — computes `current_weight` at query time
- **CHANGED**: `upsertTrustEdge` — now also grows `stability` on each interaction
- **CHANGED**: All `getTrustGraph*` functions — query `trust_edges_live`; return `raw_weight` + `effective_weight` per link
- **NEW**: `GET /trust/decay-config` — global decay config
- **NEW**: `GET /trust/decay-config/:communityId` — community-specific decay config (falls back to global)
- **NEW**: `PUT /trust/decay-config/:communityId` — admin-only: update community decay parameters
- **NEW**: `src/database/trustDecayConfigDb.ts` — decay config read/upsert helpers
- **NEW**: `src/routes/trustDecayConfig.ts` — decay config router
- **NEW**: Migration: `infrastructure/postgres/migrations/20260526-interaction-halflife.sql`

### Sprint 67: Ego-Network Rewrite + Aggregate Endpoint (2026-05-26)
- **CHANGED**: `GET /trust/graph/:communityId` — now returns ego-network (calling user + direct neighbors only), not full community graph. Response shape changed from `{ nodes, edges }` to `{ nodes, links }`.
- **NEW**: `GET /trust/graph` — aggregate ego-network across all of calling user's communities. Used by dashboard Your Network panel.
- **CHANGED**: `src/database/trustEdgeDb.ts` — `getTrustGraph` now accepts `callingUserId`; added `getTrustGraphAggregate`. New `TrustNode` (with `isCurrentUser`) and `TrustLink` interfaces.
- **CHANGED**: `src/components/NetworkGraph.tsx` — now calls `getTrustGraphAggregate` instead of deprecated `/network` endpoint.

### Sprint 65: Trust Graph Foundation (2026-05-25)
- **NEW**: `social_graph.trust_edges` — weighted, community-scoped, bidirectional user-user edges
- **NEW**: `social_graph.interaction_weights` — modular per-type weights (match_completed=10, endorsement=5, karma_given=3, event=2), overridable per community
- **NEW**: `social_graph.community_trust_edges` — community-to-community bonds (fractal level 2)
- **NEW**: `GET /trust/graph/:communityId` — graph data for Sprint 66 visualizer
- **NEW**: `GET /trust/edge` — single edge lookup
- **CHANGED**: `src/events/subscriber.ts` — now also calls `processMatchCompleted` to upsert trust edges on `match_completed`
- **CHANGED**: `src/services/pathComputation.ts` — trust score now derived from edge `effective_weight` (sum of path edge weights) instead of intermediate node karma
- **NEW**: `docs/adr/ADR-054-trust-graph-architecture.md`
- **BACKFILL**: Migration populates trust_edges from existing `requests.matches` for demo server

### Sprint 56: Logger migration (2026-05-17)
- **CHANGED**: `src/config/logger.ts` — now uses `createLogger('social-graph-service')` from `@karmyq/shared`; local 21-line winston setup removed
- **FIXED**: 12 call sites across `subscriber.ts`, `index.ts`, `invitations.ts`, `network.ts`, `paths.ts`, `trustCard.ts` updated from `logger.error('msg', { error })` to `logger.error('msg', error instanceof Error ? error : undefined)` to match shared logger signature

### Sprint 44: Structured Logging (2026-04-04)
- **NEW**: Added `createLogger` + `requestLoggingMiddleware` from `@karmyq/shared/utils/logger` to `src/index.ts`
- Route handler errors now emit `{ service: 'social-graph-service', endpoint, error.message }` structured objects via `(req as any).logger?.error()`
- `src/routes/trustCard.ts` uses module-level `logger` from `./config/logger` for catch blocks

### Sprint 38: Trust Card Endpoint (2026-03-24)
- **NEW**: Added `GET /trust-card/:targetUserId` endpoint returning trust tier, path, and invitation chain for a target user
- **Logic**: Computes primary path via `computeTrustPath` (exchange → community → invitation), then separately computes invitation path for side-by-side display
- **Karma**: Fetches target user's total karma from reputation-service via `REPUTATION_API_URL` env var
- **Trust tiers**: Emerging (0–29 karma), Trusted (30–99), Pillar (100+)
- **File**: `src/routes/trustCard.ts`

### Sprint 27: Network Graph Materialization
- **NEW**: Added `GET /network` endpoint returning materialized connection graph (nodes + edges)
- **NEW**: Subscribed to `match_completed` event to upsert exchange connections into `social_graph.connections`
- **Schema**: Added `social_graph.connections` table with `CREATE UNIQUE INDEX` for expression-based uniqueness
- **Date**: 2026-03-16

---

## Known Issues & TODOs

### Current Limitations

- No invitation code expiration
- No rate limiting on invitation generation
- No detection of "invitation farms" (fake accounts)
- Cache invalidation is time-based only (no manual purge)

### Future Enhancements

- [ ] Invitation code expiration (30-day default)
- [ ] Single-use vs. multi-use invitation codes
- [ ] Detect and flag suspicious invitation patterns
- [ ] Precompute paths for active users (background job)
- [ ] Network visualization API (graph view)
- [ ] "Introduce me" feature (request introduction through mutual connection)
- [ ] Trust endorsements (let users vouch for connections)

---

## Related Documentation

- **Design Document**: [docs/features/SOCIAL_GRAPH_TRUST_PATHS.md](../../docs/features/SOCIAL_GRAPH_TRUST_PATHS.md)
- **Migration**: [infrastructure/postgres/migrations/009_social_graph.sql](../../infrastructure/postgres/migrations/009_social_graph.sql)
- **Feed Integration**: [services/request-service/CONTEXT.md](../request-service/CONTEXT.md) (`/requests/feed`)

---

## Sprint 112 — Privacy-safe relationship contracts (ADR-082, 2026-06-24)

Person graph/path/card/memory contracts now carry identity + structure + a qualitative
`relationship_state` only — never another member's exact reputation or raw edge weight. Internal
weights and numeric path strength are unchanged (feed ranking + decay classification still use them);
projection happens at the response boundary in `src/services/disclosureProjection.ts`.

- `GET /trust/graph`, `/trust/graph/:communityId[/full]`, `/trust/neighborhood/:userId` →
  `SafeBelongingNode` (no `trust_score`/`karma`, incl. caller's node) + `SafeBelongingLink`
  (`relationship_state`, no `raw_weight`/`effective_weight`).
- `GET /paths/:targetUserId`, `POST /paths/batch` → drop outward `trust_score` (degrees + topology +
  scope only; internal `path_trust_score` caching kept). Path intermediate-node karma removed at
  source (`pathComputation.ts`).
- `GET /trust-card/:targetUserId` → identity + path + degrees + path_type + scope; no karma / tier.
- `GET /trust/me/memory`, `/trust/relationships/fading` → keep peer identity + decay tier + dates +
  counts; drop exact `currentWeight`.
- `GET /trust/edge` → **retired** `410 TRUST_EDGE_ENDPOINT_RETIRED` (internal `getTrustEdge()` kept).
- `GET /trust/decay-config/:communityId` → active-member gated; `PUT` stays admin-only.
- `GET /invitations` drops invitee karma; `GET /invitations/stats` drops `avg_invitee_karma` +
  `avg_invitee_trust_score` (counts/acceptance/network/tier kept).

## Sprint 116 — Reciprocal relationship projection (2026-06-30, ADR-084)

`src/services/relationshipContextService.ts` builds a deterministic, reciprocal dual-ego projection
from platform-wide completed-help topology. It preserves a path up to six degrees, prioritizes mutual
and path-adjacent one-hop nodes under an eight-per-side default cap, fills by stable UUID order, and
reports truncation. Reversing the two anchors swaps orientation without changing the disclosed path,
shared-node, or unordered-link sets.

`src/database/relationshipContextDb.ts` reads active identities and active community affiliations,
uses completed `requests.matches` as topology truth, and aggregates community trust rows only long
enough to derive `relationship_state` and `bond_depth`. Exact counts, weights, timestamps, karma, and
reputation never leave the projection. The projection deliberately contains no request reachability
or provider role; request-service owns those after authorizing a concrete request/offer context.

The projection is exposed only through `POST /internal/relationship-context`; no public member-search
or arbitrary-target route is introduced.

Request-service is the only intended consumer. It owns public request/offer authorization, verifies
the returned anchor IDs, and treats timeout/unavailability as a non-blocking 503 for the context panel.

**Status**: ✅ MVP Complete (v9.1.0)
**Version**: 9.1.0
**Last Updated**: 2026-06-30 (Sprint 116 reciprocal projection complete)
