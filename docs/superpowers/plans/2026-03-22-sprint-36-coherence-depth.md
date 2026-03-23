# Sprint 36: Site Coherence + Commitment Depth + Admin Power + Community Discovery

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development`
> (recommended) or `superpowers:executing-plans` to implement this plan task-by-task.

**Goal:** Achieve full site aesthetic coherence, deepen commitments with action-priority ordering and inline messaging, consolidate admin UX with connector tools, and add geography/interest community discovery.

**Architecture:** New capabilities layer onto existing infrastructure — messaging conversations already link to matches via `request_match_id`, community service already has `category` and `location` fields, and the request service just needs two new admin-action routes. Frontend receives the most changes: CommitmentsTab, communities listing, and the community admin page.

**Tech Stack:** Node.js/Express/TypeScript, Next.js 14, PostgreSQL 15, Bull queue, Socket.IO.

---

## File Map

### New files to create
| File | Responsibility |
|------|----------------|
| `apps/frontend/src/components/ExpandableConversation.tsx` | Inline collapsible chat widget for commitment cards |
| `apps/frontend/src/components/DiscoveryToggle.tsx` | Geography / Interests toggle for communities listing |
| `apps/frontend/src/components/MemberPicker.tsx` | Type-ahead member selector for admin propose-match |
| `infrastructure/postgres/migrations/014_community_tags_geo.sql` | Add `latitude`, `longitude`, `tags[]` to communities |
| `infrastructure/postgres/migrations/015_request_boost.sql` | Add `is_boosted`, `boosted_at`, `boosted_expires_at`, `boosted_by` to help_requests |
| `tests/tdd/sprint-36-commitment-depth.test.ts` | TDD tests for priority sort, boost expiry logic, tag normalization |

### Existing files to modify
| File | Change |
|------|--------|
| `apps/frontend/src/components/CommitmentsTab.tsx` | Priority ordering, section headers, integrate ExpandableConversation |
| `apps/frontend/src/pages/communities/index.tsx` | DiscoveryToggle, geography/interest fetch modes, aesthetic refresh |
| `apps/frontend/src/pages/communities/[id].tsx` | 7→5 tab restructure, aesthetic refresh, admin connector UI |
| `services/community-service/src/routes/communities.ts` | Add `?mode=geography` and `?mode=interests` query params; add PUT /tags, PUT /location |
| `services/request-service/src/routes/matches.ts` | Add POST /requests/:id/boost, DELETE /requests/:id/boost, POST /requests/:id/propose-match, PATCH /requests/:id/urgent |
| `services/feed-service/src/services/feedService.ts` | Add `+0.3` score bonus for non-expired boosted requests |
| `infrastructure/postgres/init.sql` | Add new columns inline (after existing communities + help_requests tables) |
| `services/community-service/CONTEXT.md` | Document new endpoints + schema changes |
| `services/request-service/CONTEXT.md` | Document admin action endpoints |
| `services/registry.json` | Add new endpoints to `apis.provides` |

---

## ⚠️ Critical Implementation Notes (read before Task 2)

1. **Messaging wire-up — no new schema**: `messaging.conversations.request_match_id` already exists. Call `GET /api/messaging/conversations/match/:matchId` to get/create conversation, then fetch messages normally. No schema migration needed.

2. **Tab restructure — preserve ValidTab type**: `communities/[id].tsx` defines `ValidTab` union and `VALID_TABS` array. Update both. Preserve `OLD_TAB_MAP` backward compat for URL params — add `members: 'people'`, `norms: 'people'`, `insights: 'requests'` mappings.

3. **Boost expiry — query-time**: Filter: `AND (is_boosted = FALSE OR boosted_expires_at > NOW())`. Don't build a cron. The GIN index handles this efficiently.

4. **Geolocation is async and may be denied**: Communities listing must render immediately with a skeleton/fallback, then update when location resolves. Never block render.

5. **Tag normalization**: Always `tags.map(t => t.toLowerCase().trim())` before DB insert/update.

6. **Admin propose-match = real match row**: Inserts into `requests.matches` with `status='proposed'`, `responder_id` = proposed user. Proposed user sees it in CommitmentsTab "Needs Your Response".

7. **tailwindcss-animate NOT installed**: Use CSS transitions via `style` prop or className conditionals only.

---

## Task 1: Feature Branch + DB Migrations

**Files:**
- Create: `infrastructure/postgres/migrations/014_community_tags_geo.sql`
- Create: `infrastructure/postgres/migrations/015_request_boost.sql`
- Modify: `infrastructure/postgres/init.sql`

- [ ] **Create the feature branch**

```bash
git checkout -b feature/sprint-36-coherence-depth
```

- [ ] **Write migration 014** (`infrastructure/postgres/migrations/014_community_tags_geo.sql`)

```sql
-- Sprint 36: Add geographic coordinates and interest tags to communities
-- Migration 014

ALTER TABLE communities.communities
  ADD COLUMN IF NOT EXISTS latitude NUMERIC(10, 7),
  ADD COLUMN IF NOT EXISTS longitude NUMERIC(10, 7),
  ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}';

CREATE INDEX IF NOT EXISTS idx_communities_location_geo
  ON communities.communities (latitude, longitude)
  WHERE latitude IS NOT NULL AND longitude IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_communities_tags
  ON communities.communities USING GIN (tags);
```

- [ ] **Write migration 015** (`infrastructure/postgres/migrations/015_request_boost.sql`)

```sql
-- Sprint 36: Admin boost capability for help_requests
-- Migration 015

ALTER TABLE requests.help_requests
  ADD COLUMN IF NOT EXISTS is_boosted BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS boosted_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS boosted_expires_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS boosted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_requests_is_boosted
  ON requests.help_requests (is_boosted, boosted_expires_at)
  WHERE is_boosted = TRUE;
```

- [ ] **Add columns to `init.sql`** inline after the relevant table CREATE statements (community.communities and requests.help_requests blocks)

- [ ] **Verify SQL syntax**

```bash
cd infrastructure/postgres && cat migrations/014_community_tags_geo.sql && cat migrations/015_request_boost.sql
```

---

## Task 2: TDD Tests (Write First)

**Files:**
- Create: `tests/tdd/sprint-36-commitment-depth.test.ts`

- [ ] **Write tests for all new logic before implementation**

```typescript
// tests/tdd/sprint-36-commitment-depth.test.ts

import { sortByActionPriority } from '../../apps/frontend/src/utils/commitmentSort'
import { normalizeTags } from '../../services/community-service/src/utils/tags'
import { isBoostActive } from '../../services/request-service/src/utils/boost'

describe('sortByActionPriority', () => {
  it('sorts proposed before matched before completed', () => {
    const matches = [
      { id: '3', status: 'completed', updated_at: '2026-01-03' },
      { id: '1', status: 'proposed', updated_at: '2026-01-01' },
      { id: '2', status: 'matched', updated_at: '2026-01-02' },
    ]
    const sorted = sortByActionPriority(matches)
    expect(sorted.map(m => m.id)).toEqual(['1', '2', '3'])
  })

  it('within same status tier, sorts by updated_at DESC', () => {
    const matches = [
      { id: 'A', status: 'matched', updated_at: '2026-01-01' },
      { id: 'B', status: 'matched', updated_at: '2026-01-03' },
    ]
    const sorted = sortByActionPriority(matches)
    expect(sorted[0].id).toBe('B')
  })
})

describe('normalizeTags', () => {
  it('lowercases and trims tags', () => {
    expect(normalizeTags(['  Gardening ', 'TECH'])).toEqual(['gardening', 'tech'])
  })
  it('filters empty strings', () => {
    expect(normalizeTags(['', 'food', '  '])).toEqual(['food'])
  })
})

describe('isBoostActive', () => {
  it('returns false when is_boosted is false', () => {
    expect(isBoostActive({ is_boosted: false, boosted_expires_at: null })).toBe(false)
  })
  it('returns false when boost has expired', () => {
    expect(isBoostActive({ is_boosted: true, boosted_expires_at: '2020-01-01' })).toBe(false)
  })
  it('returns true when boost is active and not expired', () => {
    const future = new Date(Date.now() + 3600000).toISOString()
    expect(isBoostActive({ is_boosted: true, boosted_expires_at: future })).toBe(true)
  })
})
```

- [ ] **Create the utility files the tests import** (stubs that return wrong values — tests should fail at first)

```bash
# Create stub files:
# apps/frontend/src/utils/commitmentSort.ts
# services/community-service/src/utils/tags.ts
# services/request-service/src/utils/boost.ts
```

- [ ] **Run TDD tests — expect failures**

```bash
npm run test:tdd -- --testPathPattern=sprint-36
```

---

## Task 3: Commitment Priority Ordering

**Files:**
- Create: `apps/frontend/src/utils/commitmentSort.ts`
- Modify: `apps/frontend/src/components/CommitmentsTab.tsx`

- [ ] **Implement `commitmentSort.ts`**

```typescript
// apps/frontend/src/utils/commitmentSort.ts

const STATUS_PRIORITY: Record<string, number> = {
  proposed: 0,
  matched: 1,
  completed: 2,
}

export function sortByActionPriority<T extends { status: string; updated_at: string }>(
  matches: T[]
): T[] {
  return [...matches].sort((a, b) => {
    const priorityDiff = (STATUS_PRIORITY[a.status] ?? 99) - (STATUS_PRIORITY[b.status] ?? 99)
    if (priorityDiff !== 0) return priorityDiff
    return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
  })
}
```

- [ ] **Update CommitmentsTab to use priority sort + section headers**

Replace flat list rendering with three grouped sections:
1. "Needs Your Response" — `status === 'proposed'`
2. "In Progress" — `status === 'matched'`
3. "Completed" — `status === 'completed'`

Each section has a collapsible header. Apply `sortByActionPriority` to each of the helping/requested arrays before rendering.

- [ ] **Add visual step indicator** — Replace `<StatusBadge>` with a three-dot step indicator: `● → ○ → ○` (filled dot = current step)

- [ ] **Add Accept / Decline buttons** on cards where `status === 'proposed'` (requester's perspective: see who offered; responder's perspective: see the pending ask)

- [ ] **Run TDD test for sort logic**

```bash
npm run test:tdd -- --testPathPattern=sprint-36
```

---

## Task 4: Inline Expandable Conversation Widget

**Files:**
- Create: `apps/frontend/src/components/ExpandableConversation.tsx`
- Modify: `apps/frontend/src/components/CommitmentsTab.tsx`

- [ ] **Create `ExpandableConversation.tsx`**

```typescript
// apps/frontend/src/components/ExpandableConversation.tsx
// Props: matchId: string, otherUserName: string, currentUserId: string
//
// Behavior:
// - Default state: collapsed. Shows chat icon + unread count badge.
// - On click: expands inline panel (max-height: 320px, overflow-y: auto)
// - On expand: fetch conversation via GET /api/messaging/conversations/match/:matchId
//   → if 404 or null, show "Start the conversation" placeholder
//   → if found, fetch messages via GET /api/messaging/conversations/:convId/messages
// - Real-time: join Socket.IO room for conversation on expand, leave on collapse
// - Send: input field at bottom, POST /api/messaging/conversations/:convId/messages
// - Unread badge: count messages where sender_id !== currentUserId and seen = false
//   (approximate: count total messages if no seen tracking, or re-fetch on collapse)
//
// Key UX: clicking outside does NOT collapse (user may be typing).
// Only the chevron toggle button collapses.
```

- [ ] **Integrate into CommitmentsTab** — Render `<ExpandableConversation>` inside each commitment card (for matched + proposed status only, not completed). Position below the status indicator, above the footer actions.

- [ ] **Verify the messaging API calls work** by checking the correct `/api/messaging/...` prefix resolves through nginx

```bash
grep "messaging" infrastructure/nginx/nginx.conf
```

---

## Task 5: Community Backend — Geography + Interests

**Files:**
- Create: `services/community-service/src/utils/tags.ts`
- Modify: `services/community-service/src/routes/communities.ts`

- [ ] **Create `tags.ts` utility**

```typescript
// services/community-service/src/utils/tags.ts
export function normalizeTags(tags: string[]): string[] {
  return tags
    .map(t => t.toLowerCase().trim())
    .filter(t => t.length > 0)
}
```

- [ ] **Add geography query mode to `GET /communities`**

```typescript
// In communities route GET handler:
const { mode, lat, lng, tags } = req.query

if (mode === 'geography' && lat && lng) {
  // Sort by distance using Pythagorean approximation (fine for city-scale)
  // ORDER BY ((latitude - $lat)^2 + (longitude - $lng)^2) ASC
  // Only include communities where latitude IS NOT NULL
  query = `
    SELECT *,
      ROUND(SQRT(POWER(latitude - $1, 2) + POWER(longitude - $2, 2)) * 111, 1) AS distance_km
    FROM communities.communities
    WHERE status = 'active' AND latitude IS NOT NULL AND longitude IS NOT NULL
    ORDER BY POWER(latitude - $1, 2) + POWER(longitude - $2, 2) ASC
  `
  params = [parseFloat(lat as string), parseFloat(lng as string)]
} else if (mode === 'interests' && tags) {
  const tagArray = (tags as string).split(',').map(t => t.trim()).filter(Boolean)
  query = `
    SELECT * FROM communities.communities
    WHERE status = 'active' AND tags && $1
    ORDER BY name ASC
  `
  params = [tagArray]
} else {
  // default: alphabetical
}
```

- [ ] **Add `PUT /communities/:id/tags`** — admin only, validates and normalizes tags, updates communities.communities

- [ ] **Add `PUT /communities/:id/location`** — admin only. Accepts `{ lat: number, lng: number }`. Updates `latitude`, `longitude`. (Lat/lng supplied directly by frontend from browser geolocation or map picker — do not call geocoding service internally.)

- [ ] **Verify query handles NULL gracefully** — communities without coordinates still appear in default mode

---

## Task 6: Request Service — Admin Actions

**Files:**
- Create: `services/request-service/src/utils/boost.ts`
- Modify: `services/request-service/src/routes/matches.ts` (or create `services/request-service/src/routes/adminActions.ts`)

- [ ] **Create `boost.ts` utility**

```typescript
// services/request-service/src/utils/boost.ts
export function isBoostActive(req: { is_boosted: boolean; boosted_expires_at: string | null }): boolean {
  if (!req.is_boosted) return false
  if (!req.boosted_expires_at) return false
  return new Date(req.boosted_expires_at) > new Date()
}
```

- [ ] **Implement `POST /requests/:id/boost`**

```typescript
// Auth check: caller must be admin of a community this request belongs to
// Set is_boosted = TRUE, boosted_at = NOW(), boosted_expires_at = NOW() + INTERVAL '48 hours', boosted_by = user.userId
// Return updated request
```

- [ ] **Implement `DELETE /requests/:id/boost`**

```typescript
// Auth check: same admin check
// Set is_boosted = FALSE, boosted_at = NULL, boosted_expires_at = NULL, boosted_by = NULL
```

- [ ] **Implement `POST /requests/:id/propose-match`**

```typescript
// Body: { user_id: string }
// Auth check: caller must be admin of a community this request belongs to
// Insert into requests.matches: { request_id, responder_id: user_id, status: 'proposed' }
// Publish 'match_proposed_by_admin' event
// Return { success: true, data: { matchId } }
```

- [ ] **Implement `PATCH /requests/:id/urgent`**

```typescript
// Body: { urgent: boolean }
// Auth check: admin of community
// Toggle urgency: urgent=true → 'urgent', urgent=false → 'medium'
```

- [ ] **Run unit tests**

```bash
npm run test:unit
```

---

## Task 7: Feed Service — Boost Scoring

**Files:**
- Modify: `services/feed-service/src/services/feedService.ts`

- [ ] **Find the curated feed scoring function** in `feedService.ts`

```bash
grep -n "score\|boost\|urgency\|priority" services/feed-service/src/services/feedService.ts | head -20
```

- [ ] **Add boost score bonus**

```typescript
// In the score calculation, after existing factors:
const boostBonus = isBoostActive(request) ? 0.3 : 0
score = Math.min(1.0, baseScore + boostBonus)
```

- [ ] **Import and use the `isBoostActive` utility** (copy or share from request-service utils — keep it a pure function so it's importable anywhere)

- [ ] **Verify feed curated query includes boost fields** in the SELECT (must include `is_boosted` and `boosted_expires_at`)

---

## Task 8: Community Page Aesthetic + Tab Restructure

**Files:**
- Modify: `apps/frontend/src/pages/communities/[id].tsx`

- [ ] **Update `ValidTab` type and `VALID_TABS` array**

```typescript
type ValidTab = 'overview' | 'people' | 'requests' | 'providers' | 'settings'
const VALID_TABS: ValidTab[] = ['overview', 'people', 'requests', 'providers', 'settings']

// Extend OLD_TAB_MAP for backward compat:
const OLD_TAB_MAP: Record<string, ValidTab> = {
  // existing...
  members: 'people',
  norms: 'people',
  insights: 'requests',
}
```

- [ ] **People tab**: Merge member list + norms. Use a sub-toggle ("Members | Norms") within the tab. The member list keeps the active/pending filter. Norms render as an accordion below.

- [ ] **Requests tab**: Merge the existing requests list with insights stats (summary cards at top). Add admin action dropdown per request row (Boost / Urgent / Propose Match). Render "⚡ Boosted" badge on boosted requests.

- [ ] **MemberPicker modal** — Triggered by "Propose a Match". Shows type-ahead input against community members list. On select → confirm dialog → calls `POST /requests/:id/propose-match`.

- [ ] **Settings tab**: Co-locate trust config (currently in its own section) and community config (max_members, access_type, etc.) under clearly labeled sections within one tab.

- [ ] **Aesthetic refresh**: Replace all inline `style` color overrides with CSS variable references (`var(--color-primary)`, `var(--color-surface)`, `var(--color-border)`). Add skeleton loaders for async sections (members load, requests load, trust metrics load). Replace generic button styles with the card-pattern button styles from RequestWizard.

- [ ] **Verify tab navigation still works via URL param** (`?tab=members` redirects to `?tab=people`)

---

## Task 9: Communities Listing — Discovery Toggle + Aesthetic Refresh

**Files:**
- Create: `apps/frontend/src/components/DiscoveryToggle.tsx`
- Modify: `apps/frontend/src/pages/communities/index.tsx`

- [ ] **Create `DiscoveryToggle.tsx`**

```typescript
// Props: mode: 'geography' | 'interests', onChange: (mode) => void
// Two-button toggle. Persist mode to localStorage key 'community_discovery_mode'
// Geography button: 📍 Near Me
// Interests button: 🏷️ By Interest
// Style: pill buttons, selected state uses --color-primary background
```

- [ ] **Tag filter chips** (interests mode): Fetch unique tags across communities with `GET /communities/tags` (add this simple endpoint to community service). Render as selectable chips. Multi-select supported. Re-fetch community list on chip selection change.

- [ ] **Geography flow**:

```typescript
// On mount when mode === 'geography':
// 1. Show skeleton immediately
// 2. navigator.geolocation.getCurrentPosition(
//      (pos) => fetchCommunities({ mode: 'geography', lat: pos.coords.latitude, lng: pos.coords.longitude }),
//      () => fetchCommunities({}) // fallback: alphabetical + show notice
//    )
// 3. Show distance_km label on each card when available
```

- [ ] **Aesthetic refresh**: Match community cards to BrowseFeed card pattern. Add skeleton loader (same pattern as CommitmentsTab). Use semantic color variables.

- [ ] **Add `GET /communities/tags`** to community service — simple `SELECT DISTINCT UNNEST(tags) FROM communities.communities WHERE tags != '{}'` query. Returns `string[]`.

---

## Task 10: User Guides + Landing Page Docs

**Files:**
- Create: `apps/landing/src/data/docs/guides/managing-commitments.json`
- Create: `apps/landing/src/data/docs/guides/finding-communities.json`
- Modify: `apps/landing/src/data/docs/guides/admin-community.json`
- Create: `apps/landing/src/data/docs/concepts/community-discovery.json`
- Modify: `apps/landing/src/data/docs/nav.json` (via `generate-docs.ts` — never edit nav.json directly)

> **Reminder**: Landing page files are gitignored but tracked. Use `git add -f apps/landing/src/data/docs/...` to stage.

- [ ] **Create `managing-commitments.json`** — Cover: action-priority ordering (why proposed always shows first), step indicator meaning, the expandable conversation widget (click to expand, stays in place), how to accept/decline a proposed match.

- [ ] **Create `finding-communities.json`** — Cover: geography default (how distance is calculated, what to do if geolocation is denied), switching to interest mode, how admins add tags to communities.

- [ ] **Update `admin-community.json`** — Update tab names and structure (People = Members + Norms; Requests = Requests + Insights + Admin actions). Document boost (48h, visible badge), propose match (creates a real commitment for the proposed member), urgent tagging.

- [ ] **Create `community-discovery.json`** (concept) — Explain the philosophy: geography-first reflects mutual aid's local nature; interest mode allows cross-geography connection for specific needs. Cover how tags work and how communities should describe themselves.

- [ ] **Update `generate-docs.ts`** to include new pages in nav, then re-generate nav.json**

```bash
# Check how generate-docs.ts works first
head -50 apps/landing/src/generate-docs.ts 2>/dev/null || ls apps/landing/src/
```

- [ ] **Force-add landing page files**

```bash
git add -f apps/landing/src/data/docs/guides/managing-commitments.json
git add -f apps/landing/src/data/docs/guides/finding-communities.json
git add -f apps/landing/src/data/docs/guides/admin-community.json
git add -f apps/landing/src/data/docs/concepts/community-discovery.json
git add -f apps/landing/src/data/docs/nav.json
```

---

## Task 11: CONTEXT.md + Registry + Feedback Loop

**Files:**
- Modify: `services/community-service/CONTEXT.md`
- Modify: `services/request-service/CONTEXT.md`
- Modify: `services/feed-service/CONTEXT.md`
- Modify: `services/registry.json`

- [ ] **Update community-service CONTEXT.md** — Add new endpoints (GET with mode params, PUT /tags, PUT /location, GET /tags). Add new columns to schema section (`latitude`, `longitude`, `tags`). Update "Recent Changes" with Sprint 36 date.

- [ ] **Update request-service CONTEXT.md** — Add admin action endpoints (boost, propose-match, urgent). Add new columns (`is_boosted`, `boosted_at`, `boosted_expires_at`, `boosted_by`).

- [ ] **Update feed-service CONTEXT.md** — Note boost scoring bonus in feed algorithm section.

- [ ] **Update `services/registry.json`** — Add new API entries under community-service and request-service `apis.provides` arrays.

- [ ] **Run feedback loop check**

```bash
npm run feedback:check
```

---

## Task 12: Final Verification

**Files:** none (verification only)

- [ ] **Run TDD tests — all should pass now**

```bash
npm run test:tdd -- --testPathPattern=sprint-36
```

- [ ] **Run full test suite**

```bash
npm test
```

- [ ] **TypeScript check**

```bash
cd apps/frontend && npx tsc --noEmit
cd services/community-service && npx tsc --noEmit
cd services/request-service && npx tsc --noEmit
cd services/feed-service && npx tsc --noEmit
```

- [ ] **Feedback loop passes**

```bash
npm run feedback:check
```

- [ ] **Visual spot-check** (if running locally): Open communities listing → confirm toggle renders → confirm geography mode requests geolocation → confirm interest mode shows chips. Open dashboard → open CommitmentsTab → confirm Needs Your Response section appears first → confirm chat icon on a matched commitment expands inline.

- [ ] **Commit all work**

```bash
git add -A
git commit -m "feat(ux): Sprint 36 — Commitment depth + admin power + community discovery v9.11.0"
```

---

## Task 13: Merge + Deploy

> Use the `/deploy` skill for this task.

- [ ] **Merge to master**

```bash
git checkout master
git merge feature/sprint-36-coherence-depth
git push origin master
```

- [ ] **Monitor GitHub Actions** — watch the workflow at https://github.com/ravichavali/karmyq/actions

- [ ] **Apply DB migrations manually post-deploy** (deploy.sh does NOT auto-run migrations)

```bash
ssh ubuntu@karmyq.com
cd ~/karmyq
psql $DATABASE_URL -f infrastructure/postgres/migrations/014_community_tags_geo.sql
psql $DATABASE_URL -f infrastructure/postgres/migrations/015_request_boost.sql
```

- [ ] **Verify health**

```bash
npm run health:check
```

- [ ] **Stale container check** — if `docker-compose up` fails with a conflict, run `docker rm -f <container-name>` then redeploy
