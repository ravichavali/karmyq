# Sprint 27: Profile Unification Design

**Date**: 2026-03-15
**Status**: Approved
**Sprint arc**: Provider/Service Economy — Sprint 27 of 3 (Profile → Trust → Rate Cards)

---

## Context

Sprint 26 shipped provider collectives and discovery. Users can now find providers and collectives, but the product experience is fragmented:

- The user profile (`/profile`) has no awareness of provider identity
- The provider detail page (`/providers/[id]`) is disconnected from the user's community profile
- There is no way to see your local network — who you've helped, who you share communities with — in a meaningful visual form

Sprint 27 closes these gaps by unifying the profile surface into a coherent identity page and adding a network graph that makes relationship strength visible.

---

## Goals

1. Users who are also providers see both identities in one place (two-tab profile)
2. The provider detail page surfaces social trust context for the viewer (trust path badge)
3. Users can see their local network — people they've exchanged help with or share communities with — as a force-directed graph
4. No regression to existing profile behavior for non-provider users

---

## Scope

### In Sprint 27
- `social_graph.connections` materialized table + migration + backfill
- `match_completed` event handler in social-graph-service (upserts connections)
- `GET /network` endpoint in social-graph-service (reads from connections table)
- `socialGraphService.getNetwork()` in `api.ts`
- Two-tab profile page (Community tab = current content, Provider tab = conditional)
- `ProviderProfileTab` component
- `NetworkGraph` component (force-directed, lazy-loaded)
- Trust path badge on `/providers/[id]`
- "Your Profile" link on `/providers/[id]` when owner

### Out of Sprint 27 (deferred)
- Public `/users/[id]` profile pages
- Provider trust score wiring (Sprint 28)
- Rate cards / pricing (Sprint 29)
- Public `/users/[id]` profile pages

---

## Architecture

### Backend: `social_graph.connections` table

**New table** (persists connections independently of request data — survives cleanup service purges):

```sql
CREATE TABLE IF NOT EXISTS social_graph.connections (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_a_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_b_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type          TEXT NOT NULL CHECK (type IN ('exchange', 'community')),
  first_connected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_interaction_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT connections_normalized_pair UNIQUE (
    LEAST(user_a_id::text, user_b_id::text),
    GREATEST(user_a_id::text, user_b_id::text)
  )
);
```

**Migration file**: `infrastructure/postgres/migrations/YYYYMMDD-social-graph-connections.sql`
- Creates the `social_graph` schema if not exists
- Creates the table above
- Backfills from existing completed matches:
  ```sql
  INSERT INTO social_graph.connections (user_a_id, user_b_id, type, first_connected_at, last_interaction_at)
  SELECT DISTINCT
    LEAST(requester_id::text, responder_id::text)::uuid,
    GREATEST(requester_id::text, responder_id::text)::uuid,
    'exchange',
    MIN(updated_at),
    MAX(updated_at)
  FROM requests.matches
  WHERE status = 'completed'
  GROUP BY LEAST(requester_id::text, responder_id::text), GREATEST(requester_id::text, responder_id::text)
  ON CONFLICT DO NOTHING;
  ```
- `init.sql` must also be updated with the schema + table definition

**Event handler** (social-graph-service subscribes to `match_completed`):
- **New file**: `services/social-graph-service/src/events/matchCompleted.ts`
- Listens on the `karmyq-events` Bull queue for `match_completed` events
- Payload contains `requester_id` + `responder_id`
- Upserts into `social_graph.connections` with `type = 'exchange'`, updating `last_interaction_at`
- Registered in `services/social-graph-service/src/index.ts` alongside existing queue setup
- `services/registry.json`: add `match_completed` to social-graph-service's event subscriptions

---

### Backend: `GET /network`

**Service**: social-graph-service
**New file**: `services/social-graph-service/src/routes/network.ts`
**Registration**: `services/social-graph-service/src/index.ts`

**Auth**: Required (JWT)

**Logic**:
1. Query exchange connections from the materialized table:
   ```sql
   SELECT
     CASE WHEN user_a_id = $1 THEN user_b_id ELSE user_a_id END AS connected_user_id,
     'exchange' AS edge_type,
     last_interaction_at
   FROM social_graph.connections
   WHERE (user_a_id = $1 OR user_b_id = $1)
     AND type = 'exchange'
   ```
2. Query community co-members (live — membership data is not purged by cleanup):
   ```sql
   SELECT DISTINCT m2.user_id AS connected_user_id,
     'community' AS edge_type,
     m2.joined_at AS last_interaction_at
   FROM communities.members m1
   JOIN communities.members m2
     ON m1.community_id = m2.community_id
     AND m2.user_id != $1
   WHERE m1.user_id = $1
   ```
3. Merge results, deduplicate (exchange takes precedence over community for the same user pair), cap at 150 nodes (exchange edges first, then community by `last_interaction_at` DESC)
4. Fetch display names and provider IDs for all connected user IDs:
   ```sql
   SELECT u.id, u.name, pp.id AS provider_id
   FROM auth.users u
   LEFT JOIN requests.provider_profiles pp ON pp.user_id = u.id
   WHERE u.id = ANY($1)
   ```
   (`$1` is an array of user IDs; `= ANY($1)` returns one row per matched user)
5. Build `nodes[]` + `edges[]`. Edge type: `'exchange'` or `'community'`

**Response shape**:
```json
{
  "success": true,
  "data": {
    "nodes": [
      { "id": "uuid", "name": "Jane Smith", "provider_id": "uuid-or-null" }
    ],
    "edges": [
      { "source": "current-user-uuid", "target": "uuid", "type": "exchange" }
    ]
  }
}
```

**Error handling**:
- 401 if unauthenticated
- 500 with standard error shape on DB failure
- Empty `{ nodes: [], edges: [] }` if user has no connections (not an error)

---

### Frontend: `profile.tsx` refactor

**File**: `apps/frontend/src/pages/profile.tsx`

**Changes**:
- Import `providerService` and `collectiveService` from `api.ts` (both already exist; `profile.tsx` does not currently import them)
- Add `activeTab: 'community' | 'provider'` state — initialized from `router.query.tab` on mount if present (`'community'` or `'provider'`; defaults to `'community'` for any other value or absence)
- Fetch `getMyProviders()` + `getMyCollectives()` on mount (parallel to existing calls)
- Render tab bar above content:
  - "Community" tab: always shown
  - "Provider" tab: only shown when `myProviders.length > 0`
- Community tab: **current content unchanged**
- Provider tab: renders `<ProviderProfileTab providers={myProviders} collectives={myCollectives} />`

---

### Frontend: `ProviderProfileTab` component

**New file**: `apps/frontend/src/components/ProviderProfileTab.tsx`

**Props**: `{ providers: ProviderProfile[], collectives: Collective[] }`

**Renders**:
- Section: "Your Service Profiles" — one card per provider profile with type badge, bio excerpt, availability indicator, and link → `/providers/[id]`
- Section: "Your Collectives" — one card per collective with name, member count, and link → `/providers/collectives/[id]`
- Empty state if both sections are empty (shouldn't happen given tab visibility condition, but defensive)

**Data**: Collectives fetched in `profile.tsx` alongside providers using existing `getMyCollectives()`

---

### Frontend: `NetworkGraph` component

**New file**: `apps/frontend/src/components/NetworkGraph.tsx`
**New dependency**: `react-force-graph-2d`

**Lazy-loading**: The component is NOT rendered on profile mount. It renders only when the user scrolls the "Your Network" section into view, using an `IntersectionObserver` ref. `GET /network` is called only when the component first becomes visible.

**Interaction**:
- Nodes: current user rendered as center node (distinct color); connections rendered around it
- Edge color: exchange edges (`#10b981` green) vs community edges (`#6366f1` indigo)
- Node click: if the clicked user has a provider profile (determined from node metadata), navigate to `/providers/[id]`; otherwise show an inline trust path tooltip using `TrustPathBadge`
- Empty state: "No connections yet — complete a help exchange to build your network"

**Data source**: `socialGraphService.getNetwork()` — new method in `api.ts`

---

### Frontend: `api.ts` addition

**File**: `apps/frontend/src/lib/api.ts`

**Addition to `socialGraphService`**:
```typescript
getNetwork: () => api.get('/social-graph/network')
```

---

### Frontend: `providers/[id].tsx` additions

**File**: `apps/frontend/src/pages/providers/[id].tsx`

**Change 1**: Add `TrustPathBadge` component (already built and used on dashboard) to show the viewer's connection to this provider. Rendered below the provider name/bio block. Uses existing `useTrustPath(provider.user_id, { enabled: !!currentUser && !isOwner })` hook — disabled for unauthenticated users and suppressed for the owner (showing a trust path to yourself is meaningless).

**Change 2**: When `isOwner === true`, show a "← Your Profile" link at the top of the page linking to `/profile?tab=provider`.

---

## Data Flow

```
profile.tsx mounts
  ├─ existing calls fire (communities, karma, trust, settings, skills)
  ├─ getMyProviders() fires in parallel
  └─ getMyCollectives() fires in parallel
       └─ if myProviders.length > 0 → Provider tab shown
            └─ both providers[] and collectives[] passed as props to ProviderProfileTab

User on Community tab
  └─ scrolls to "Your Network" section
       └─ IntersectionObserver triggers → NetworkGraph mounts
            └─ GET /network called → force graph renders

User clicks a node
  ├─ has provider_id → navigate to /providers/[provider_id]
  └─ no provider_id → show TrustPathBadge inline tooltip
```

---

## Testing Plan

### TDD tests (`tests/tdd/`)
| Test | Assertion |
|------|-----------|
| `NetworkGraph` with mock data | Renders correct number of nodes; renders empty state when data is empty |
| `NetworkGraph` lazy-load | Does NOT call `getNetwork` until IntersectionObserver fires |
| Profile tab bar — provider user | Provider tab visible when `myProviders.length > 0` |
| Profile tab bar — non-provider user | Provider tab NOT visible when `myProviders` is empty |
| `ProviderProfileTab` | Renders all provider cards; renders all collective cards; each has a correct link |
| `GET /network` contract | Returns `{ nodes, edges }` shape; exchange edges typed correctly; respects 150-node cap |
| `match_completed` event handler | Upserts row into `social_graph.connections` on event; idempotent (ON CONFLICT updates `last_interaction_at`) |
| Cleanup resilience | Deleting a row from `requests.matches` does NOT remove the corresponding `social_graph.connections` row |

### Regression
- Existing profile.tsx Community tab content renders identically to current behavior
- No new errors on `/providers/[id]` for unauthenticated users (TrustPathBadge disabled when no auth)

---

## Files Changed

| File | Change |
|------|--------|
| `infrastructure/postgres/migrations/YYYYMMDD-social-graph-connections.sql` | **New** — create social_graph schema + connections table + backfill |
| `infrastructure/postgres/init.sql` | Add social_graph schema + connections table definition |
| `services/social-graph-service/src/events/matchCompleted.ts` | **New** — match_completed event handler |
| `services/social-graph-service/src/routes/network.ts` | **New** — GET /network route |
| `services/social-graph-service/src/index.ts` | Register network router + matchCompleted event handler |
| `services/registry.json` | Add match_completed to social-graph-service subscriptions |
| `services/social-graph-service/CONTEXT.md` | Document new endpoint |
| `services/registry.json` | Add GET /network to social-graph-service apis.provides |
| `apps/frontend/src/pages/profile.tsx` | Add tab bar, provider tab, NetworkGraph |
| `apps/frontend/src/components/ProviderProfileTab.tsx` | **New** |
| `apps/frontend/src/components/NetworkGraph.tsx` | **New** |
| `apps/frontend/src/lib/api.ts` | Add `getNetwork()` to socialGraphService |
| `apps/frontend/src/pages/providers/[id].tsx` | Add TrustPathBadge + owner link |
| `apps/frontend/package.json` | Add `react-force-graph-2d` dependency |
| `tests/tdd/profile-tabs.test.tsx` | **New** — tab bar + ProviderProfileTab tests |
| `tests/tdd/network-graph.test.tsx` | **New** — NetworkGraph component tests |
| `tests/tdd/network-endpoint-contract.test.ts` | **New** — GET /network contract tests |
| `apps/landing/src/data/docs/services/social-graph-service.json` | Add GET /network endpoint entry |
| `apps/landing/src/data/docs/nav.json` | No new page — but verify GET /network appears under social-graph-service in the nav |

---

## Success Criteria

- [ ] `social_graph.connections` table created and backfilled from existing completed matches
- [ ] Completing a new match upserts a row into `social_graph.connections`
- [ ] Deleting a match record does NOT remove the corresponding connection (cleanup-safe)
- [ ] Provider users see two tabs on `/profile`; non-provider users see no change
- [ ] Provider tab lists all service profiles and collectives with working links
- [ ] Network graph loads only on scroll, renders nodes for exchange + community connections
- [ ] Provider detail page shows trust path badge for viewer
- [ ] Provider detail page shows "Your Profile" link for owner
- [ ] All TDD tests pass
- [ ] No regression to existing profile behavior
- [ ] `GET /network` documented in landing page service docs
