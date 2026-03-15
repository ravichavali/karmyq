# Sprint 27: Profile Unification Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Unify provider and community identities on the profile page, add a force-directed network graph, and surface social trust context on the provider detail page.

**Architecture:** Three independent layers — (1) a new `social_graph.connections` materialized table backed by a `match_completed` event handler, (2) a `GET /network` endpoint in social-graph-service that reads from it, and (3) frontend changes: two-tab profile, `ProviderProfileTab`, `NetworkGraph` (lazy-loaded), and trust path badge on provider detail page.

**Tech Stack:** PostgreSQL 15, Node.js/Express/TypeScript (social-graph-service), Next.js 14 (Pages Router), React, Tailwind CSS, `react-force-graph-2d`

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `infrastructure/postgres/migrations/20260315-social-graph-connections.sql` | Create | Schema + connections table + backfill from completed matches |
| `infrastructure/postgres/init.sql` | Modify | Add `social_graph` schema + connections table definition |
| `services/social-graph-service/src/events/subscriber.ts` | Modify | Add `social_graph.connections` upsert inside existing `match_completed` handler. **Note:** The spec lists a new `matchCompleted.ts` file, but `subscriber.ts` already registers a `match_completed` handler for cache clearing. Adding a second `eventQueue.process('match_completed', ...)` in a new file would silently compete with the existing handler (Bull assigns jobs round-robin across processors). The correct approach is to extend `subscriber.ts` in place. |
| `services/social-graph-service/src/routes/network.ts` | Create | `GET /network` — exchange + community edges, 150-node cap |
| `services/social-graph-service/src/index.ts` | Modify | Register `/network` router |
| `services/social-graph-service/CONTEXT.md` | Modify | Document new endpoint |
| `services/registry.json` | Modify | Add `GET /network` to apis.provides AND add `match_completed` to social-graph-service event subscriptions |
| `apps/frontend/src/lib/api.ts` | Modify | Add `getNetwork()` to `socialGraphService` |
| `apps/frontend/src/pages/profile.tsx` | Modify | Add tab bar, fetch providers/collectives, render Provider tab |
| `apps/frontend/src/components/ProviderProfileTab.tsx` | Create | Service profiles + collectives cards |
| `apps/frontend/src/components/NetworkGraph.tsx` | Create | Force-directed graph, IntersectionObserver lazy-load |
| `apps/frontend/src/pages/providers/[id].tsx` | Modify | TrustPathBadge + owner "Your Profile" link |
| `apps/frontend/package.json` | Modify | Add `react-force-graph-2d` dependency |
| `tests/tdd/network-endpoint-contract.test.ts` | Create | `GET /network` response shape + 150-node cap + event handler idempotency |
| `tests/tdd/profile-tabs.test.ts` | Create | Tab visibility logic + ProviderProfileTab data logic (pure-logic `.ts` — no JSX rendering; spec lists `.tsx` but tests contain no JSX) |
| `tests/tdd/network-graph.test.tsx` | Create | NetworkGraph render + lazy-load behavior |
| `apps/landing/src/data/docs/services/social-graph-service.json` | Modify | Add GET /network endpoint entry |

---

## Chunk 1: Backend — `social_graph.connections` table + event handler

### Task 1: Write migration + update init.sql

**Files:**
- Create: `infrastructure/postgres/migrations/20260315-social-graph-connections.sql`
- Modify: `infrastructure/postgres/init.sql`

- [ ] **Step 1: Create the migration file**

```sql
-- infrastructure/postgres/migrations/20260315-social-graph-connections.sql

-- Create schema if not exists
CREATE SCHEMA IF NOT EXISTS social_graph;

-- Create connections materialized table
CREATE TABLE IF NOT EXISTS social_graph.connections (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_a_id           UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_b_id           UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type                TEXT NOT NULL CHECK (type IN ('exchange', 'community')),
  first_connected_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_interaction_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT connections_normalized_pair UNIQUE (
    LEAST(user_a_id::text, user_b_id::text),
    GREATEST(user_a_id::text, user_b_id::text)
  )
);

-- Backfill from existing completed matches
INSERT INTO social_graph.connections (user_a_id, user_b_id, type, first_connected_at, last_interaction_at)
SELECT
  LEAST(requester_id::text, responder_id::text)::uuid,
  GREATEST(requester_id::text, responder_id::text)::uuid,
  'exchange',
  MIN(updated_at),
  MAX(updated_at)
FROM requests.matches
WHERE status = 'completed'
  AND requester_id IS NOT NULL
  AND responder_id IS NOT NULL
GROUP BY
  LEAST(requester_id::text, responder_id::text),
  GREATEST(requester_id::text, responder_id::text)
ON CONFLICT DO NOTHING;
```

- [ ] **Step 2: Update `infrastructure/postgres/init.sql`**

Find the end of the existing schema definitions and add after the last `CREATE TABLE` block (search for `social_graph` to confirm it's not already there):

```sql
-- Social Graph Schema
CREATE SCHEMA IF NOT EXISTS social_graph;

CREATE TABLE IF NOT EXISTS social_graph.connections (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_a_id           UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_b_id           UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type                TEXT NOT NULL CHECK (type IN ('exchange', 'community')),
  first_connected_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_interaction_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT connections_normalized_pair UNIQUE (
    LEAST(user_a_id::text, user_b_id::text),
    GREATEST(user_a_id::text, user_b_id::text)
  )
);
```

- [ ] **Step 3: Commit**

```bash
git checkout -b feature/sprint-27
git add infrastructure/postgres/migrations/20260315-social-graph-connections.sql
git add infrastructure/postgres/init.sql
git commit -m "feat(db): add social_graph.connections table with backfill migration"
```

---

### Task 2: Write TDD tests for the event handler + upsert logic

**Files:**
- Create: `tests/tdd/network-endpoint-contract.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// tests/tdd/network-endpoint-contract.test.ts
/**
 * TDD: social_graph.connections upsert logic + GET /network response contract
 * Sprint 27 - Profile Unification
 */

describe('social_graph.connections upsert logic', () => {
  describe('normalized pair ordering', () => {
    it('always stores the lexicographically smaller UUID as user_a_id', () => {
      const a = '11111111-0000-0000-0000-000000000000';
      const b = '22222222-0000-0000-0000-000000000000';
      const pair = {
        user_a_id: [a, b].sort()[0],
        user_b_id: [a, b].sort()[1],
      };
      expect(pair.user_a_id).toBe(a);
      expect(pair.user_b_id).toBe(b);
    });

    it('produces the same normalized pair regardless of argument order', () => {
      const a = '11111111-0000-0000-0000-000000000000';
      const b = '22222222-0000-0000-0000-000000000000';
      const pairAB = { user_a_id: [a, b].sort()[0], user_b_id: [a, b].sort()[1] };
      const pairBA = { user_a_id: [b, a].sort()[0], user_b_id: [b, a].sort()[1] };
      expect(pairAB).toEqual(pairBA);
    });
  });

  describe('upsert idempotency', () => {
    it('second upsert for same pair updates last_interaction_at, not first_connected_at', () => {
      const firstConnected = new Date('2026-01-01T00:00:00Z');
      const lastInteraction = new Date('2026-03-15T12:00:00Z');

      // Simulate what ON CONFLICT DO UPDATE SET last_interaction_at = EXCLUDED.last_interaction_at does
      const existing = { first_connected_at: firstConnected, last_interaction_at: firstConnected };
      const after = { ...existing, last_interaction_at: lastInteraction };

      expect(after.first_connected_at).toEqual(firstConnected); // unchanged
      expect(after.last_interaction_at).toEqual(lastInteraction); // updated
    });
  });
});

describe('GET /network response contract', () => {
  describe('node shape', () => {
    it('each node has id, name, and provider_id (nullable)', () => {
      const node = { id: 'uuid-1', name: 'Alice', provider_id: null };
      expect(node).toHaveProperty('id');
      expect(node).toHaveProperty('name');
      expect(node).toHaveProperty('provider_id');
    });

    it('provider_id is null when user has no provider profile', () => {
      const node = { id: 'uuid-1', name: 'Alice', provider_id: null };
      expect(node.provider_id).toBeNull();
    });

    it('provider_id is a string UUID when user has a provider profile', () => {
      const node = { id: 'uuid-1', name: 'Bob', provider_id: 'provider-uuid-1' };
      expect(typeof node.provider_id).toBe('string');
    });
  });

  describe('edge shape', () => {
    it('each edge has source, target, and type', () => {
      const edge = { source: 'uuid-1', target: 'uuid-2', type: 'exchange' };
      expect(edge).toHaveProperty('source');
      expect(edge).toHaveProperty('target');
      expect(edge).toHaveProperty('type');
    });

    it('edge type is either exchange or community', () => {
      const validTypes = ['exchange', 'community'];
      const edge = { source: 'a', target: 'b', type: 'exchange' };
      expect(validTypes).toContain(edge.type);
    });
  });

  describe('150-node cap', () => {
    it('caps results at 150 nodes', () => {
      const allConnections = Array.from({ length: 200 }, (_, i) => ({
        connected_user_id: `uuid-${i}`,
        edge_type: 'exchange',
        last_interaction_at: new Date(),
      }));
      const capped = allConnections.slice(0, 150);
      expect(capped.length).toBe(150);
    });

    it('prefers exchange edges over community edges when capping', () => {
      const exchangeEdges = Array.from({ length: 100 }, (_, i) => ({
        connected_user_id: `exchange-${i}`,
        edge_type: 'exchange',
      }));
      const communityEdges = Array.from({ length: 100 }, (_, i) => ({
        connected_user_id: `community-${i}`,
        edge_type: 'community',
      }));
      // Exchange comes first in merge order
      const merged = [...exchangeEdges, ...communityEdges].slice(0, 150);
      const exchangeCount = merged.filter(e => e.edge_type === 'exchange').length;
      expect(exchangeCount).toBe(100); // all exchange edges kept
    });
  });

  describe('empty state', () => {
    it('returns empty nodes and edges arrays (not an error) when user has no connections', () => {
      const result = { nodes: [], edges: [] };
      expect(result.nodes).toEqual([]);
      expect(result.edges).toEqual([]);
    });
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail (or pass — pure logic tests may pass immediately)**

```bash
cd tests && npx jest tdd/network-endpoint-contract.test.ts --no-coverage
```

Expected: tests pass (these are pure logic tests with no service dependency).

- [ ] **Step 3: Commit**

```bash
git add tests/tdd/network-endpoint-contract.test.ts
git commit -m "test(tdd): network endpoint contract + upsert logic tests"
```

---

### Task 3: Update the `match_completed` event handler to upsert connections

**Files:**
- Modify: `services/social-graph-service/src/events/subscriber.ts`

Current file already handles `match_completed` to clear trust path cache. Add the upsert **inside** the same handler, after the existing `clearTrustPathCache` call.

- [ ] **Step 1: Edit `subscriber.ts`**

Replace the existing `eventQueue.process('match_completed', ...)` block with:

```typescript
eventQueue.process('match_completed', async (job) => {
  logger.info('Processing match_completed event', job.data);

  const { payload } = job.data;
  const { requester_id, responder_id } = payload;

  try {
    // 1. Clear trust path cache (existing behavior — do not remove)
    await clearTrustPathCache(requester_id, responder_id);
    logger.info('✅ Trust path cache cleared for completed match', { requester_id, responder_id });

    // 2. Upsert into social_graph.connections (Sprint 27)
    await pool.query(
      `INSERT INTO social_graph.connections
         (user_a_id, user_b_id, type, first_connected_at, last_interaction_at)
       VALUES (
         LEAST($1::text, $2::text)::uuid,
         GREATEST($1::text, $2::text)::uuid,
         'exchange',
         now(),
         now()
       )
       ON CONFLICT ON CONSTRAINT connections_normalized_pair
       DO UPDATE SET last_interaction_at = now()`,
      [requester_id, responder_id]
    );
    logger.info('✅ social_graph.connections upserted', { requester_id, responder_id });
  } catch (error) {
    logger.error('❌ Failed to process match_completed', { requester_id, responder_id, error });
    throw error;
  }
});
```

Note: `pool` is already imported in the service (check `src/config/database.ts`). Add `import { pool } from '../config/database';` at the top of `subscriber.ts` if it's not there.

- [ ] **Step 2: Verify the import is present at the top of the file**

Open `services/social-graph-service/src/events/subscriber.ts`. Confirm or add:

```typescript
import { pool } from '../config/database';
```

- [ ] **Step 3: Build to check for TypeScript errors**

```bash
cd services/social-graph-service && npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add services/social-graph-service/src/events/subscriber.ts
git commit -m "feat(social-graph): upsert social_graph.connections on match_completed"
```

---

## Chunk 2: Backend — `GET /network` endpoint

### Task 4: Create the network route

**Files:**
- Create: `services/social-graph-service/src/routes/network.ts`

- [ ] **Step 1: Create the route file**

```typescript
// services/social-graph-service/src/routes/network.ts
import express, { Response } from 'express';
import { pool } from '../config/database';
import { logger } from '../config/logger';
import { AuthenticatedRequest } from '@karmyq/shared/middleware/auth';

const router = express.Router();

const MAX_NODES = 150;

// GET /network — returns the current user's local network graph
router.get('/', async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.userId;

  if (!userId) {
    return res.status(401).json({ success: false, message: 'Authentication required' });
  }

  try {
    // 1. Exchange connections from materialized table
    const exchangeResult = await pool.query(
      `SELECT
         CASE WHEN user_a_id = $1 THEN user_b_id ELSE user_a_id END AS connected_user_id,
         'exchange' AS edge_type,
         last_interaction_at
       FROM social_graph.connections
       WHERE (user_a_id = $1 OR user_b_id = $1)
         AND type = 'exchange'
       ORDER BY last_interaction_at DESC`,
      [userId]
    );

    // 2. Community co-members (live query — membership not purged by cleanup)
    const communityResult = await pool.query(
      `SELECT DISTINCT m2.user_id AS connected_user_id,
         'community' AS edge_type,
         m2.joined_at AS last_interaction_at
       FROM communities.members m1
       JOIN communities.members m2
         ON m1.community_id = m2.community_id
        AND m2.user_id != $1
       WHERE m1.user_id = $1`,
      [userId]
    );

    // 3. Merge: exchange first, then community; deduplicate (exchange wins); cap at MAX_NODES
    const seen = new Set<string>();
    const merged: Array<{ connected_user_id: string; edge_type: string }> = [];

    for (const row of exchangeResult.rows) {
      if (!seen.has(row.connected_user_id)) {
        seen.add(row.connected_user_id);
        merged.push(row);
      }
    }
    for (const row of communityResult.rows) {
      if (!seen.has(row.connected_user_id)) {
        seen.add(row.connected_user_id);
        merged.push(row);
      }
    }
    const capped = merged.slice(0, MAX_NODES);

    if (capped.length === 0) {
      return res.json({ success: true, data: { nodes: [], edges: [] } });
    }

    // 4. Fetch display names + provider IDs for connected users
    const connectedIds = capped.map(r => r.connected_user_id);
    const userResult = await pool.query(
      `SELECT u.id, u.name, pp.id AS provider_id
       FROM auth.users u
       LEFT JOIN requests.provider_profiles pp ON pp.user_id = u.id
       WHERE u.id = ANY($1)`,
      [connectedIds]
    );

    const userMap = new Map<string, { id: string; name: string; provider_id: string | null }>();
    for (const row of userResult.rows) {
      userMap.set(row.id, { id: row.id, name: row.name, provider_id: row.provider_id ?? null });
    }

    // 5. Build nodes + edges
    // Include the current user as center node
    const currentUserResult = await pool.query(
      `SELECT id, name FROM auth.users WHERE id = $1`,
      [userId]
    );
    const currentUser = currentUserResult.rows[0];

    const nodes = [
      { id: userId, name: currentUser?.name ?? 'You', provider_id: null },
      ...capped
        .map(r => userMap.get(r.connected_user_id))
        .filter((u): u is { id: string; name: string; provider_id: string | null } => !!u),
    ];

    const edges = capped.map(r => ({
      source: userId,
      target: r.connected_user_id,
      type: r.edge_type,
    }));

    return res.json({ success: true, data: { nodes, edges } });
  } catch (error) {
    logger.error('GET /network failed', { userId, error });
    return res.status(500).json({ success: false, message: 'Failed to fetch network' });
  }
});

export default router;
```

- [ ] **Step 2: Register the route in `index.ts`**

In `services/social-graph-service/src/index.ts`, add the import and route registration after the existing `pathRoutes` line:

```typescript
import networkRoutes from './routes/network';
```

And in the routes section:

```typescript
app.use('/network', rateLimiters.readLight, networkRoutes);
```

- [ ] **Step 3: Build to check for TypeScript errors**

```bash
cd services/social-graph-service && npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add services/social-graph-service/src/routes/network.ts
git add services/social-graph-service/src/index.ts
git commit -m "feat(social-graph): add GET /network endpoint"
```

---

### Task 5: Update service docs

**Files:**
- Modify: `services/social-graph-service/CONTEXT.md`
- Modify: `services/registry.json`
- Modify: `apps/landing/src/data/docs/services/social-graph-service.json`

- [ ] **Step 1: Update `CONTEXT.md`**

Find the "API Endpoints" section in `services/social-graph-service/CONTEXT.md` and add:

```
### GET /network
Returns the current user's local network graph (exchange + community connections).
Auth: Required (JWT).
Response: `{ success: true, data: { nodes: [{ id, name, provider_id }], edges: [{ source, target, type }] } }`
Capped at 150 nodes. Exchange edges take priority over community edges.
```

- [ ] **Step 2: Update `services/registry.json`**

Find the social-graph-service entry in `services/registry.json`.

In its `apis.provides` array, add:
```json
{ "method": "GET", "path": "/network", "description": "Returns authenticated user's local network graph (exchange + community connections, 150-node cap)" }
```

Also find the `events` section for social-graph-service and add `match_completed` to its `subscribes` array (alongside any existing subscriptions):
```json
"match_completed"
```

- [ ] **Step 3: Update the landing page service JSON**

Open `apps/landing/src/data/docs/services/social-graph-service.json`. In the `endpoints` array, add:

```json
{
  "method": "GET",
  "path": "/network",
  "description": "Returns authenticated user's local network graph (exchange + community connections, capped at 150 nodes)."
}
```

- [ ] **Step 4: Commit**

```bash
git add services/social-graph-service/CONTEXT.md
git add services/registry.json
git add apps/landing/src/data/docs/services/social-graph-service.json
git commit -m "docs: document GET /network in service docs and registry"
```

---

## Chunk 3: Frontend — api.ts + profile tabs + ProviderProfileTab

### Task 6: Add `getNetwork()` to api.ts + write profile tab tests

**Files:**
- Modify: `apps/frontend/src/lib/api.ts`
- Create: `tests/tdd/profile-tabs.test.ts`

- [ ] **Step 1: Add `getNetwork()` to `socialGraphService` in `api.ts`**

Open `apps/frontend/src/lib/api.ts`. Find the `socialGraphService` object (around line 720). Add after the last existing method:

```typescript
  // Get current user's local network graph
  getNetwork: () =>
    socialGraphApi.get('/network'),
```

- [ ] **Step 2: Write failing tests for tab visibility logic**

```typescript
// tests/tdd/profile-tabs.test.ts
/**
 * TDD: Profile page tab bar logic + ProviderProfileTab rendering
 * Sprint 27 - Profile Unification
 */

// Tab visibility logic (extracted for testability)
type ProfileTab = 'community' | 'provider';

function resolveProfileTab(
  queryTab: string | undefined,
  hasProviderProfiles: boolean
): ProfileTab {
  if (queryTab === 'provider' && hasProviderProfiles) return 'provider';
  return 'community';
}

function shouldShowProviderTab(providers: unknown[]): boolean {
  return providers.length > 0;
}

describe('Profile tab visibility', () => {
  it('defaults to community tab when no query param', () => {
    expect(resolveProfileTab(undefined, true)).toBe('community');
  });

  it('defaults to community tab when provider tab requested but user has no providers', () => {
    expect(resolveProfileTab('provider', false)).toBe('community');
  });

  it('shows provider tab when ?tab=provider and user has provider profiles', () => {
    expect(resolveProfileTab('provider', true)).toBe('provider');
  });

  it('defaults to community for any other tab value', () => {
    expect(resolveProfileTab('unknown', true)).toBe('community');
  });

  it('provider tab is visible when myProviders is non-empty', () => {
    expect(shouldShowProviderTab([{ id: 'p1' }])).toBe(true);
  });

  it('provider tab is NOT visible when myProviders is empty', () => {
    expect(shouldShowProviderTab([])).toBe(false);
  });
});

describe('ProviderProfileTab rendering logic', () => {
  it('produces one card entry per provider profile', () => {
    const providers = [
      { id: 'p1', display_name: 'Alice', service_type: 'tutor', bio: '', is_available: true },
      { id: 'p2', display_name: 'Alice', service_type: 'ride', bio: '', is_available: false },
    ];
    expect(providers.length).toBe(2);
  });

  it('produces one card entry per collective', () => {
    const collectives = [
      { id: 'c1', name: 'PDX Tutors', member_count: 5 },
    ];
    expect(collectives.length).toBe(1);
  });

  it('provider card link points to /providers/[id]', () => {
    const providerId = 'p1';
    const link = `/providers/${providerId}`;
    expect(link).toBe('/providers/p1');
  });

  it('collective card link points to /providers/collectives/[id]', () => {
    const collectiveId = 'c1';
    const link = `/providers/collectives/${collectiveId}`;
    expect(link).toBe('/providers/collectives/c1');
  });
});
```

- [ ] **Step 3: Run tests to confirm they pass (pure logic)**

```bash
cd tests && npx jest tdd/profile-tabs.test.ts --no-coverage
```

Expected: All pass.

- [ ] **Step 4: Commit**

```bash
git add apps/frontend/src/lib/api.ts
git add tests/tdd/profile-tabs.test.ts
git commit -m "feat(frontend): add getNetwork() to api.ts + profile tab logic tests"
```

---

### Task 7: Create `ProviderProfileTab` component

**Files:**
- Create: `apps/frontend/src/components/ProviderProfileTab.tsx`

- [ ] **Step 1: Create the component**

```tsx
// apps/frontend/src/components/ProviderProfileTab.tsx
import Link from 'next/link'

const SERVICE_TYPE_LABELS: Record<string, string> = {
  ride: 'Rides',
  tradesperson: 'Home Repair',
  tutor: 'Tutoring',
  other: 'Other',
}

interface ProviderProfile {
  id: string
  display_name: string
  service_type: string
  bio?: string
  is_available?: boolean
}

interface Collective {
  id: string
  name: string
  member_count?: number
}

interface Props {
  providers: ProviderProfile[]
  collectives: Collective[]
}

export default function ProviderProfileTab({ providers, collectives }: Props) {
  if (providers.length === 0 && collectives.length === 0) {
    return (
      <p className="text-sm text-text-muted text-center py-8">
        No provider profiles yet.
      </p>
    )
  }

  return (
    <div className="space-y-8">
      {/* Service Profiles */}
      {providers.length > 0 && (
        <section>
          <h2 className="text-base font-semibold text-text mb-3">Your Service Profiles</h2>
          <div className="space-y-3">
            {providers.map(p => (
              <div
                key={p.id}
                className="bg-surface-raised rounded-xl border border-border p-4 flex items-start justify-between gap-4"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-medium text-text">{p.display_name}</span>
                    <span className="text-xs bg-primary-light text-primary rounded-full px-2 py-0.5">
                      {SERVICE_TYPE_LABELS[p.service_type] ?? p.service_type}
                    </span>
                    {p.is_available && (
                      <span className="flex items-center gap-1 text-xs text-karmyq-green-600">
                        <span className="w-1.5 h-1.5 rounded-full bg-karmyq-green-500 inline-block" />
                        Available
                      </span>
                    )}
                  </div>
                  {p.bio && (
                    <p className="text-xs text-text-muted line-clamp-2">{p.bio}</p>
                  )}
                </div>
                <Link
                  href={`/providers/${p.id}`}
                  className="text-xs text-primary hover:underline whitespace-nowrap"
                >
                  View profile →
                </Link>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Collectives */}
      {collectives.length > 0 && (
        <section>
          <h2 className="text-base font-semibold text-text mb-3">Your Collectives</h2>
          <div className="space-y-3">
            {collectives.map(c => (
              <div
                key={c.id}
                className="bg-surface-raised rounded-xl border border-border p-4 flex items-center justify-between gap-4"
              >
                <div>
                  <p className="text-sm font-medium text-text">{c.name}</p>
                  {c.member_count != null && (
                    <p className="text-xs text-text-muted">{c.member_count} member{c.member_count !== 1 ? 's' : ''}</p>
                  )}
                </div>
                <Link
                  href={`/providers/collectives/${c.id}`}
                  className="text-xs text-primary hover:underline whitespace-nowrap"
                >
                  Manage →
                </Link>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/frontend/src/components/ProviderProfileTab.tsx
git commit -m "feat(frontend): add ProviderProfileTab component"
```

---

### Task 8: Update `profile.tsx` with two-tab support

**Files:**
- Modify: `apps/frontend/src/pages/profile.tsx`

- [ ] **Step 1: Add imports at the top of `profile.tsx`**

After the existing import block, add:

```typescript
import ProviderProfileTab from '@/components/ProviderProfileTab'
import { providerService, collectiveService } from '@/lib/api'
```

- [ ] **Step 2: Add tab state + provider/collective state**

In the state declarations section (after the existing `useState` calls), add:

```typescript
// Provider tab state
const [activeTab, setActiveTab] = useState<'community' | 'provider'>('community')
const [myProviders, setMyProviders] = useState<any[]>([])
const [myCollectives, setMyCollectives] = useState<any[]>([])
```

- [ ] **Step 3: Initialize `activeTab` from query param once router is ready**

Add a separate `useEffect` that watches `router.isReady` (not the mount effect). In Next.js Pages Router, `router.query` is empty on the first render and only populates after the client-side router hydrates. Reading it on mount will always see `undefined`.

```typescript
// Initialize tab from ?tab=provider query param — guarded by router.isReady
useEffect(() => {
  if (!router.isReady) return
  if (router.query.tab === 'provider') {
    setActiveTab('provider')
  }
}, [router.isReady])
```

- [ ] **Step 4: Fetch providers + collectives in the data loading effect**

Find the main data-loading `useEffect` (the one that calls the API). Add parallel fetches alongside the existing calls:

```typescript
  // Fetch provider presence (parallel to existing calls)
  providerService.getMyProviders().then(r => setMyProviders(r.data ?? [])).catch(() => {})
  collectiveService.getMyCollectives().then(r => setMyCollectives(r.data ?? [])).catch(() => {})
```

- [ ] **Step 5: Add the tab bar and conditional tab rendering**

In the JSX, find the top of the profile content area (just before the first section renders). Add the tab bar:

```tsx
{/* Tab bar — only shown when user has provider profiles */}
{myProviders.length > 0 && (
  <div className="flex gap-1 border-b border-border mb-6">
    {(['community', 'provider'] as const).map(tab => (
      <button
        key={tab}
        onClick={() => setActiveTab(tab)}
        className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
          activeTab === tab
            ? 'border-primary text-primary'
            : 'border-transparent text-text-muted hover:text-text'
        }`}
      >
        {tab === 'community' ? 'Community' : 'Provider'}
      </button>
    ))}
  </div>
)}

{/* Provider tab */}
{activeTab === 'provider' && myProviders.length > 0 && (
  <ProviderProfileTab providers={myProviders} collectives={myCollectives} />
)}

{/* Community tab content — wrap existing content */}
{activeTab === 'community' && (
  // existing profile content goes here — no changes to content itself
  <> {/* ... existing JSX ... */} </>
)}
```

**Important:** Wrap the existing profile content (the parts that were rendering unconditionally) inside `{activeTab === 'community' && (...)}`. Do not move or delete any existing content — just wrap it.

- [ ] **Step 6: Build check**

```bash
cd apps/frontend && npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 7: Commit**

```bash
git add apps/frontend/src/pages/profile.tsx
git commit -m "feat(frontend): add two-tab profile page with Provider tab"
```

---

## Chunk 4: Frontend — NetworkGraph + providers/[id] additions

### Task 9: Add `react-force-graph-2d` dependency

**Files:**
- Modify: `apps/frontend/package.json`

- [ ] **Step 1: Install the dependency**

```bash
cd apps/frontend && npm install react-force-graph-2d
```

- [ ] **Step 2: Verify installation**

```bash
cd apps/frontend && node -e "require('react-force-graph-2d'); console.log('ok')"
```

Expected: `ok`

- [ ] **Step 3: Commit**

```bash
git add apps/frontend/package.json apps/frontend/package-lock.json
git commit -m "feat(frontend): add react-force-graph-2d dependency"
```

---

### Task 10: Write TDD tests for NetworkGraph lazy-load behavior

**Files:**
- Create: `tests/tdd/network-graph.test.tsx`

- [ ] **Step 1: Write the tests**

```typescript
// tests/tdd/network-graph.test.tsx
/**
 * TDD: NetworkGraph component lazy-load behavior and render logic
 * Sprint 27 - Profile Unification
 *
 * Note: react-force-graph-2d uses canvas which is not available in jsdom.
 * These tests cover the data layer and lazy-load gate, not the canvas rendering.
 */

describe('NetworkGraph data logic', () => {
  describe('empty state detection', () => {
    it('shows empty state when nodes array is empty', () => {
      const data = { nodes: [], edges: [] };
      const isEmpty = data.nodes.length === 0;
      expect(isEmpty).toBe(true);
    });

    it('does NOT show empty state when there are nodes', () => {
      const data = {
        nodes: [{ id: 'u1', name: 'Alice', provider_id: null }],
        edges: [{ source: 'me', target: 'u1', type: 'exchange' }],
      };
      const isEmpty = data.nodes.length === 0;
      expect(isEmpty).toBe(false);
    });
  });

  describe('node click routing', () => {
    it('navigates to /providers/[provider_id] when node has provider_id', () => {
      const node = { id: 'user-1', name: 'Bob', provider_id: 'provider-1' };
      const destination = node.provider_id ? `/providers/${node.provider_id}` : null;
      expect(destination).toBe('/providers/provider-1');
    });

    it('returns null destination when node has no provider_id', () => {
      const node = { id: 'user-2', name: 'Alice', provider_id: null };
      const destination = node.provider_id ? `/providers/${node.provider_id}` : null;
      expect(destination).toBeNull();
    });
  });

  describe('edge color mapping', () => {
    it('maps exchange edges to green', () => {
      const colorMap: Record<string, string> = { exchange: '#10b981', community: '#6366f1' };
      expect(colorMap['exchange']).toBe('#10b981');
    });

    it('maps community edges to indigo', () => {
      const colorMap: Record<string, string> = { exchange: '#10b981', community: '#6366f1' };
      expect(colorMap['community']).toBe('#6366f1');
    });
  });

  describe('lazy-load gate', () => {
    it('tracks whether the component has become visible', () => {
      let hasBeenVisible = false;
      // Simulate IntersectionObserver callback firing
      const onIntersect = (isIntersecting: boolean) => {
        if (isIntersecting) hasBeenVisible = true;
      };
      onIntersect(false);
      expect(hasBeenVisible).toBe(false);
      onIntersect(true);
      expect(hasBeenVisible).toBe(true);
    });

    it('does not re-fetch after first visible (fetch-once behavior)', () => {
      let fetchCount = 0;
      let hasLoaded = false;

      const maybeLoad = (isIntersecting: boolean) => {
        if (isIntersecting && !hasLoaded) {
          fetchCount++;
          hasLoaded = true;
        }
      };

      maybeLoad(true);
      maybeLoad(true); // simulate re-intersection
      expect(fetchCount).toBe(1);
    });
  });
});
```

- [ ] **Step 2: Run tests to confirm they pass**

```bash
cd tests && npx jest tdd/network-graph.test.tsx --no-coverage
```

Expected: All pass.

- [ ] **Step 3: Commit**

```bash
git add tests/tdd/network-graph.test.tsx
git commit -m "test(tdd): NetworkGraph data logic and lazy-load tests"
```

---

### Task 11: Create `NetworkGraph` component

**Files:**
- Create: `apps/frontend/src/components/NetworkGraph.tsx`

- [ ] **Step 1: Create the component**

```tsx
// apps/frontend/src/components/NetworkGraph.tsx
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/router'
import { socialGraphService } from '@/lib/api'

interface NetworkNode {
  id: string
  name: string
  provider_id: string | null
}

interface NetworkEdge {
  source: string
  target: string
  type: 'exchange' | 'community'
}

interface NetworkData {
  nodes: NetworkNode[]
  edges: NetworkEdge[]
}

const EDGE_COLORS: Record<string, string> = {
  exchange: '#10b981',
  community: '#6366f1',
}

interface Props {
  currentUserId: string
}

export default function NetworkGraph({ currentUserId }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [data, setData] = useState<NetworkData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const hasLoaded = useRef(false)

  // Lazy-load: only fetch when scrolled into view
  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !hasLoaded.current) {
          hasLoaded.current = true
          loadNetwork()
        }
      },
      { threshold: 0.1 }
    )

    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  async function loadNetwork() {
    setLoading(true)
    setError(null)
    try {
      const response = await socialGraphService.getNetwork()
      setData(response.data)
    } catch (err: any) {
      setError('Failed to load network')
    } finally {
      setLoading(false)
    }
  }

  const isEmpty = data && data.nodes.length <= 1 // only center node = no connections

  return (
    <div ref={containerRef} className="bg-surface-raised rounded-xl border border-border p-5">
      <h2 className="text-base font-semibold text-text mb-1">Your Network</h2>
      <div className="flex items-center gap-4 mb-4 text-xs text-text-muted">
        <span className="flex items-center gap-1">
          <span className="w-3 h-0.5 bg-[#10b981] inline-block rounded" /> Exchanges
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-0.5 bg-[#6366f1] inline-block rounded" /> Communities
        </span>
      </div>

      {loading && (
        <div className="flex items-center justify-center h-48 text-text-muted text-sm">
          Loading network…
        </div>
      )}

      {error && (
        <div className="flex items-center justify-center h-48 text-red-500 text-sm">
          {error}
        </div>
      )}

      {!loading && !error && isEmpty && (
        <div className="flex items-center justify-center h-48 text-text-muted text-sm text-center px-4">
          No connections yet — complete a help exchange to build your network.
        </div>
      )}

      {!loading && !error && data && !isEmpty && (
        <NetworkGraphCanvas
          data={data}
          currentUserId={currentUserId}
        />
      )}
    </div>
  )
}

// Separated canvas component to allow dynamic import if needed
function NetworkGraphCanvas({
  data,
  currentUserId,
}: {
  data: NetworkData
  currentUserId: string
}) {
  const router = useRouter()

  function handleNodeClick(node: NetworkNode) {
    if (node.provider_id) router.push(`/providers/${node.provider_id}`)
  }

  // Dynamic import of react-force-graph-2d (SSR-safe)
  const [ForceGraph, setForceGraph] = useState<any>(null)

  useEffect(() => {
    import('react-force-graph-2d').then(mod => setForceGraph(() => mod.default))
  }, [])

  if (!ForceGraph) return null

  const graphData = {
    nodes: data.nodes.map(n => ({
      ...n,
      color: n.id === currentUserId ? '#f59e0b' : '#64748b',
    })),
    links: data.edges.map(e => ({
      source: e.source,
      target: e.target,
      color: EDGE_COLORS[e.type] ?? '#94a3b8',
    })),
  }

  return (
    <ForceGraph
      graphData={graphData}
      width={560}
      height={320}
      nodeLabel="name"
      nodeColor={(n: any) => n.color}
      linkColor={(l: any) => l.color}
      onNodeClick={(node: any) => handleNodeClick(node)}
    />
  )
}
```

- [ ] **Step 2: Add `NetworkGraph` to `profile.tsx` Community tab**

In `profile.tsx`, import the component:

```typescript
import NetworkGraph from '@/components/NetworkGraph'
```

Then, inside the Community tab content, after the invitation chain section, add:

```tsx
{/* Network graph — lazy-loaded on scroll */}
{user && <NetworkGraph currentUserId={user.id} />}
```

- [ ] **Step 3: Build check**

```bash
cd apps/frontend && npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add apps/frontend/src/components/NetworkGraph.tsx
git add apps/frontend/src/pages/profile.tsx
git commit -m "feat(frontend): add NetworkGraph component with IntersectionObserver lazy-load"
```

---

### Task 12: Add TrustPathBadge + owner link to `providers/[id].tsx`

**Files:**
- Modify: `apps/frontend/src/pages/providers/[id].tsx`

- [ ] **Step 1: Add imports**

At the top of `apps/frontend/src/pages/providers/[id].tsx`, add:

```typescript
import TrustPathBadge from '@/components/TrustPathBadge'
import { useTrustPath } from '@/hooks/useTrustPath'
import Link from 'next/link'
```

- [ ] **Step 2: Add `useTrustPath` hook call**

Inside the `ProviderDetailPage` component, after the `isOwner` constant, add:

```typescript
const { trustPath } = useTrustPath(
  provider?.user_id ?? null,
  { enabled: !!currentUser && !isOwner }
)
```

- [ ] **Step 3: Add "Your Profile" link for owner**

In the JSX, at the very top of the content area (before the header card), add:

```tsx
{isOwner && (
  <div className="mb-2">
    <Link href="/profile?tab=provider" className="text-sm text-primary hover:underline">
      ← Your Profile
    </Link>
  </div>
)}
```

- [ ] **Step 4: Add TrustPathBadge below the provider name/bio block**

Inside the header card, after `{provider.bio && <p ...>}`, add:

```tsx
{!isOwner && trustPath && (
  <div className="mt-3">
    <TrustPathBadge trustPath={trustPath} compact />
  </div>
)}
```

- [ ] **Step 5: Build check**

```bash
cd apps/frontend && npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 6: Commit**

```bash
git add apps/frontend/src/pages/providers/[id].tsx
git commit -m "feat(frontend): add TrustPathBadge and owner link to provider detail page"
```

---

## Chunk 5: Apply migration + verification

### Task 13: Apply migration to karmyq.com and verify

- [ ] **Step 1: Push the branch**

```bash
git push -u origin feature/sprint-27
```

- [ ] **Step 2: Apply the migration to the demo server**

```bash
ssh ubuntu@karmyq.com
docker exec karmyq-postgres psql -U karmyq_prod -d karmyq_prod \
  -f /dev/stdin < ~/karmyq/infrastructure/postgres/migrations/20260315-social-graph-connections.sql
```

- [ ] **Step 3: Verify the table exists and has backfilled rows**

```bash
docker exec karmyq-postgres psql -U karmyq_prod -d karmyq_prod -c "
SELECT COUNT(*) AS backfilled_connections FROM social_graph.connections;
"
```

Expected: count ≥ 0 (may be 0 if no completed matches exist in demo data — that's fine).

- [ ] **Step 4: Run the full test suite**

```bash
npm test
npm run test:tdd
```

Expected: All unit + regression tests pass. All TDD tests pass.

- [ ] **Step 5: Run feedback check**

```bash
npm run feedback:check
```

Expected: Passes.

- [ ] **Step 6: Merge to master and deploy**

```bash
git checkout master
git merge feature/sprint-27
git push origin master
```

GitHub Actions will build, deploy to karmyq.com, and run health checks automatically.

---

## Stop Criteria Checklist

Before closing Sprint 27, verify all of these on karmyq.com:

- [ ] `social_graph.connections` table exists (verified in Task 13)
- [ ] New completed matches upsert a connection row (run sim or manual match completion, check via psql)
- [ ] Provider users see two tabs on `/profile`; non-provider users unaffected
- [ ] Provider tab lists all service profiles and collectives with correct links
- [ ] Network graph section appears on Community tab, loads on scroll
- [ ] Provider detail page shows trust path badge for non-owner viewer
- [ ] Provider detail page shows "← Your Profile" link for owner
- [ ] All TDD tests pass: `npm run test:tdd`
- [ ] No regressions: `npm test`
- [ ] `GET /network` documented in landing page service docs
