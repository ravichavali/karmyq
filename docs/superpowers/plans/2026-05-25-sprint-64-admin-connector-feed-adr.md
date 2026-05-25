# Sprint 64: Admin-as-Connector + Feed ADR Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Surface the existing admin boost/propose features to members via a "Community Pick" badge, fix mod permissions in the backend, write ADR-053, and update landing docs.

**Architecture:** Backend endpoints for boost and propose-match already exist and work. This sprint wires the boost signal to the member-facing BrowseFeed, extends permissions to mods, and documents feed philosophy.

**Tech Stack:** Node.js/Express/TypeScript, Next.js 14, PostgreSQL 15, Bull queue.

---

## File Map

### New files to create
| File | Responsibility |
|------|---------------|
| `docs/adr/ADR-053-feed-design-philosophy.md` | Architecture Decision Record for feed design |
| `apps/landing/src/data/docs/concepts/adr-053-feed-design-philosophy.json` | Landing site concept page for ADR-053 |
| `apps/frontend/tests/tdd/sprint-64-admin-connector.test.tsx` | TDD tests for badge + mod fix |

### Existing files to modify
| File | Change |
|------|--------|
| `apps/frontend/src/components/BrowseFeed.tsx` | Add "Community Pick" badge for boosted requests |
| `services/request-service/src/routes/adminActions.ts` | Extend `isAdminOfRequestCommunity` to include mods |
| `apps/landing/src/data/docs/guides/admin-community.json` | Add boost and propose-match documentation |
| `apps/landing/src/data/docs/nav.json` | Add ADR-053 entry under Architecture Decisions |
| `services/request-service/CONTEXT.md` | Document mod support change |

---

## ⚠️ Critical Implementation Notes (read before Task 2)

1. **`isBoostActive` import path**: `@/utils/boost` — follow `BrowseTab.tsx` pattern.
2. **Badge label is "Community Pick" not "Boosted"**: Member-facing framing. Use `bg-amber-100 text-amber-700`.
3. **Rename `isAdminOfRequestCommunity` → `isAdminOrModOfRequestCommunity`**: 4 call sites in `adminActions.ts`, all in the same file.
4. **Moderator role string is `'moderator'`**: Check community member roles for consistency.
5. **Landing docs in `.gitignore`**: Always `git add -f apps/landing/src/data/docs/` when committing.
6. **ADR number is 053**: Confirm `docs/adr/ADR-053-*.md` doesn't exist before creating.
7. **No DB migration needed**: Boost columns already shipped.
8. **TDD tests go in `apps/frontend/tests/tdd/`**: Not root `tests/tdd/`.

---

## Task 1: Feature Branch

**Files:**
- No file changes

- [ ] **Create and checkout the sprint branch**

```bash
git checkout -b feature/sprint-64-admin-connector-adr
```

- [ ] **Verify you're on the new branch**

```bash
git branch --show-current
# Expected: feature/sprint-64-admin-connector-adr
```

---

## Task 2: "Community Pick" Badge in BrowseFeed

**Files:**
- Modify: `apps/frontend/src/components/BrowseFeed.tsx`

- [ ] **Add `isBoostActive` import** after the existing imports at the top of BrowseFeed.tsx:

```typescript
import { isBoostActive } from '@/utils/boost'
```

- [ ] **Add the badge in the request card render**, alongside the urgency badge. Find the urgency badge render block (around `request.urgency` check) and add before or after it:

```tsx
{isBoostActive(request) && (
  <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium">
    ⚡ Community Pick
  </span>
)}
```

The `request` object from `getCuratedRequests()` already includes `is_boosted` and `boosted_expires_at` — no API change needed.

- [ ] **Verify the badge renders** by checking that TypeScript accepts `request.is_boosted` without type errors. The curated request type should already have these fields — if not, add them to the inline type or interface in BrowseFeed.tsx.

- [ ] **Type check**

```bash
cd apps/frontend && npx tsc --noEmit 2>&1 | grep -i "BrowseFeed\|boost" | head -20
```

---

## Task 3: Mod Support in adminActions.ts

**Files:**
- Modify: `services/request-service/src/routes/adminActions.ts`

- [ ] **Rename `isAdminOfRequestCommunity` → `isAdminOrModOfRequestCommunity`** and update the filter to include moderators:

Change the function definition from:
```typescript
async function isAdminOfRequestCommunity(requestId: string, user: any): Promise<boolean> {
  const memberships: Array<{ id: string; role: string }> = user.communities ?? [];
  const adminCommunityIds = memberships
    .filter((m) => m.role === 'admin')
    .map((m) => m.id);
```

To:
```typescript
async function isAdminOrModOfRequestCommunity(requestId: string, user: any): Promise<boolean> {
  const memberships: Array<{ id: string; role: string }> = user.communities ?? [];
  const adminCommunityIds = memberships
    .filter((m) => m.role === 'admin' || m.role === 'moderator')
    .map((m) => m.id);
```

- [ ] **Update all 4 call sites** in the file — search for `isAdminOfRequestCommunity` and replace each with `isAdminOrModOfRequestCommunity`:
  - Line ~41 (boost endpoint)
  - Line ~80 (remove boost endpoint)
  - Line ~124 (propose-match endpoint)
  - Line ~202 (urgent toggle endpoint)

- [ ] **Type check**

```bash
cd services/request-service && npx tsc --noEmit 2>&1 | grep -i "adminActions\|isAdmin" | head -10
```

---

## Task 4: ADR-053 — Feed Design Philosophy

**Files:**
- Create: `docs/adr/ADR-053-feed-design-philosophy.md`

- [ ] **Confirm ADR-053 doesn't exist**

```bash
ls docs/adr/ | grep "053"
# Expected: no output
```

- [ ] **Create `docs/adr/ADR-053-feed-design-philosophy.md`**:

```markdown
# ADR-053: Feed Design Philosophy

**Status**: Accepted
**Date**: 2026-05-25
**Deciders**: Karmyq core team

---

## Context

Karmyq has two types of feeds: the community Browse feed (where members find open requests) and the dashboard Active tab (where members track their commitments). Both need design principles grounded in the platform's purpose — not borrowed from social media.

Early design discussions revealed a risk: feed UIs are tempting to build as infinite scrollers with engagement mechanics because that's the dominant mental model from consumer social products. This ADR establishes the principles that prevent that drift.

---

## Decision

Karmyq feeds are designed as **work surfaces, not scroll surfaces**. Every design decision flows from this principle.

### 1. Purpose Determines Mechanics

The Browse feed exists to generate one action: someone offering help on an open request. Nothing else. Design choices must serve that action directly.

- No likes, reactions, or comments on feed items
- No follower counts or social graph metrics visible in the feed
- No trending or popular sections — these optimize for engagement, not help
- No infinite scroll by default — the feed ends when the actionable items end

### 2. Priority Order

Feed items are ranked in this order:
1. Requests the user has been proposed for (admin-matched) — most specific, act now
2. Requests the user has an active offer on — track these
3. Community requests matching the user's skills and availability
4. All other open community requests

Algorithmic ranking (trust-weighted scoring, urgency, recency, skill match) operates within tier 3. Tiers 1 and 2 are absolute — they are never displaced by algorithmic ranking.

### 3. Trust-Weighted Surfacing

Within the community request tier, requests are ranked by:
- **Trust distance**: requests from people 1–2 hops away in the trust graph surface higher
- **Skill match**: requests matching the viewer's listed skills
- **Urgency**: critical > high > medium > low
- **Recency**: newer requests preferred when other factors are equal
- **Admin boost**: a `+0.3` bonus applied after normalization for requests explicitly boosted by a community admin

Trust distance is computed from the social graph service. It biases the feed toward requests within the user's trusted network — but never hides requests from outside it.

### 4. Admin Boost Is the Only Curation Signal

Community admins and moderators can boost a request for 48 hours. This is the only human curation mechanism. Boosted requests display a "Community Pick" badge in member feeds.

There is no algorithmic trending. There is no editor's picks. There is no engagement-weighted popularity. The only signal that a request is "featured" is an explicit, time-limited decision by a community admin or mod.

### 5. The Feed Is Not a Social Graph

Karmyq has a trust graph and a social graph service. These are inputs to feed ranking, not outputs of it. The feed does not display:

- Mutual connections ("3 people you know helped this request")
- Social proof ("12 people viewed this")
- Follow/unfollow mechanics
- Notification-driven engagement loops

Trust is surfaced through matching quality, not social pressure.

### 6. Empty States Are Not Failures

When a user has no actionable items in their feed, the empty state should:
- Confirm the platform is working (no hidden requests)
- Suggest next actions (update skills, join more communities, post a request)
- Not manufacture urgency or fake activity

An empty feed means the user has no open obligations, which is a good state.

---

## Consequences

**Positive:**
- Feed UIs are easier to reason about — no engagement metrics to track or optimize
- Members trust the feed because it shows what's real, not what's algorithmically amplified
- Admin boost creates accountability — boosts are explicit, time-limited, and visible
- Platform stays focused on help completion, not engagement metrics

**Negative:**
- No viral mechanics — the platform grows through trust and word of mouth, not algorithmic reach
- Feed may feel "sparse" to users accustomed to social media density — this is by design

**Neutral:**
- Future feed features (e.g., member availability signals, provider-mode filtering) should be evaluated against these principles before implementation
```

---

## Task 5: Landing Docs — admin-community guide + ADR-053

**Files:**
- Modify: `apps/landing/src/data/docs/guides/admin-community.json`
- Create: `apps/landing/src/data/docs/concepts/adr-053-feed-design-philosophy.json`
- Modify: `apps/landing/src/data/docs/nav.json`

- [ ] **Update `admin-community.json`** — append a new section to the `content` field documenting boost and propose-match. Find the existing content string and add to it:

```
## Admin-as-Connector Tools

Beyond managing membership, admins and moderators have two tools for actively connecting people:

### Boosting a Request

When a request needs extra attention, admins and mods can boost it for 48 hours. Boosted requests:
- Appear with a ⚡ **Community Pick** badge in member feeds
- Receive a scoring bonus in feed ranking
- Return to normal ranking when the boost expires

To boost: go to your community's Browse tab → find the request → Actions → ⚡ Boost (48h).
To remove: same path → Actions → Remove Boost.

### Proposing a Match

Admins and mods can suggest a specific helper for any open request. The proposed helper sees the request in their Active tab under "Awaiting Acceptance" with a "Suggested by your community admin" label.

To propose: Browse tab → open request → Actions → Propose a Match → pick a member → Confirm.

The proposed helper can accept or decline. If they decline, the request returns to open status.
```

- [ ] **Create `apps/landing/src/data/docs/concepts/adr-053-feed-design-philosophy.json`**:

```json
{
  "slug": "adr-053-feed-design-philosophy",
  "number": "053",
  "title": "ADR-053: Feed Design Philosophy",
  "status": "accepted",
  "description": "**Status**: Accepted",
  "content": "# ADR-053: Feed Design Philosophy\n\n**Status**: Accepted  \n**Date**: 2026-05-25\n\n---\n\n## Context\n\nKarmyq feeds exist to generate one action: someone offering help on an open request. This ADR establishes the design principles that keep feeds purpose-built rather than borrowing mechanics from social media.\n\n---\n\n## Decision\n\nKarmyq feeds are **work surfaces, not scroll surfaces**.\n\n### Priority Order\n\n1. Admin-proposed requests (act now)\n2. Active offers (track these)\n3. Community requests, trust-weighted\n4. All other open requests\n\nAlgorithmic ranking operates within tier 3 only.\n\n### Trust-Weighted Surfacing\n\nRequests are ranked by: trust distance → skill match → urgency → recency → admin boost (+0.3 after normalization). Requests from closer trust graph connections surface higher, but are never hidden.\n\n### Admin Boost Is the Only Curation Signal\n\nAdmins and mods can boost a request for 48 hours. This is the only human curation mechanism — no trending, no editor's picks, no engagement-weighted popularity.\n\n### No Social Mechanics\n\nNo likes, reactions, comments, follower counts, or viral mechanics. Trust is surfaced through matching quality, not social pressure.\n\n### Empty States Are Not Failures\n\nAn empty feed means no open obligations — a good state. Empty states suggest next actions, not manufactured urgency.\n\n---\n\n## Consequences\n\nFeed UIs are easier to reason about. Members trust the feed because it shows what is real. The platform grows through trust and word of mouth, not algorithmic reach.",
  "filename": "ADR-053-feed-design-philosophy.md"
}
```

- [ ] **Update `nav.json`** — add ADR-053 entry in the "Architecture Decisions" section. Find the last ADR entry and add after it:

```json
{
  "title": "ADR-053: Feed Design Philosophy",
  "href": "/docs/concepts/adr-053-feed-design-philosophy",
  "description": "Feed as a work surface — priority order, trust-weighted surfacing, admin boost as the only curation signal."
}
```

- [ ] **Verify nav integrity** — every new JSON file has a nav.json entry

---

## Task 6: CONTEXT.md Update

**Files:**
- Modify: `services/request-service/CONTEXT.md`

- [ ] **Update API Endpoints section** in `services/request-service/CONTEXT.md` to note that boost and propose-match endpoints now accept admin OR mod role (previously admin-only).

- [ ] **Add to Recent Changes** (or equivalent section):
```
- Sprint 64: Extended admin action endpoints (boost, remove-boost, propose-match) to accept moderator role in addition to admin.
```

---

## Task 7: TDD Tests

**Files:**
- Create: `apps/frontend/tests/tdd/sprint-64-admin-connector.test.tsx`

- [ ] **Create the TDD test file**. Tests cover:
  1. BrowseFeed renders "Community Pick" badge for an active boosted request
  2. BrowseFeed does NOT render the badge for an expired boost
  3. BrowseFeed does NOT render the badge for a non-boosted request

```typescript
import { render, screen } from '@testing-library/react'
import BrowseFeed from '@/components/BrowseFeed'

// Minimal mock of a request item
const makeRequest = (overrides = {}) => ({
  id: 'req-1',
  title: 'Help moving furniture',
  description: 'Need 2 people for 2 hours',
  urgency: 'medium',
  created_at: new Date().toISOString(),
  community_name: 'Test Community',
  match_score: 0.8,
  is_boosted: false,
  boosted_expires_at: null,
  ...overrides,
})

// Note: BrowseFeed requires several props. Mock the minimum needed.
// If BrowseFeed is complex to mount, test isBoostActive logic directly:
import { isBoostActive } from '@/utils/boost'

describe('isBoostActive', () => {
  it('returns true for an active boost', () => {
    const future = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
    expect(isBoostActive({ is_boosted: true, boosted_expires_at: future })).toBe(true)
  })

  it('returns false for an expired boost', () => {
    const past = new Date(Date.now() - 1000).toISOString()
    expect(isBoostActive({ is_boosted: true, boosted_expires_at: past })).toBe(false)
  })

  it('returns false when is_boosted is false', () => {
    const future = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
    expect(isBoostActive({ is_boosted: false, boosted_expires_at: future })).toBe(false)
  })

  it('returns false when boosted_expires_at is null', () => {
    expect(isBoostActive({ is_boosted: true, boosted_expires_at: null })).toBe(false)
  })
})
```

- [ ] **Run the tests**

```bash
cd apps/frontend && npx jest tests/tdd/sprint-64-admin-connector.test.tsx --no-coverage 2>&1 | tail -20
```

---

## Task 8: Version Bump

**Files:**
- Modify: `package.json` (root)

- [ ] **Bump root version to `9.40.0`**

```bash
# In root package.json, update "version": "9.30.0" → "version": "9.40.0"
```

---

## Task 9: Final Verification

**Files:**
- No new changes (verification only)

- [ ] **Full type check**

```bash
cd apps/frontend && npx tsc --noEmit 2>&1 | grep -v "node_modules" | head -30
cd services/request-service && npx tsc --noEmit 2>&1 | grep -v "node_modules" | head -20
```

- [ ] **Run unit + regression tests**

```bash
npm test 2>&1 | tail -30
```

- [ ] **Run TDD tests**

```bash
npm run test:tdd 2>&1 | tail -20
```

- [ ] **Run feedback check**

```bash
npm run feedback:check
```

- [ ] **Confirm no regressions in BrowseFeed, BrowseTab, CommitmentsTab**

- [ ] **Stage and commit**

```bash
git add apps/frontend/src/components/BrowseFeed.tsx
git add services/request-service/src/routes/adminActions.ts
git add services/request-service/CONTEXT.md
git add apps/frontend/tests/tdd/sprint-64-admin-connector.test.tsx
git add docs/adr/ADR-053-feed-design-philosophy.md
git add -f apps/landing/src/data/docs/concepts/adr-053-feed-design-philosophy.json
git add -f apps/landing/src/data/docs/guides/admin-community.json
git add -f apps/landing/src/data/docs/nav.json
git add package.json
git add docs/superpowers/specs/2026-05-25-sprint-64-admin-connector-feed-adr-design.md
git add docs/superpowers/plans/2026-05-25-sprint-64-admin-connector-feed-adr.md

git commit -m "feat(sprint-64): Community Pick badge, mod permissions, ADR-053 — v9.40.0"
```

---

## Task 10: Merge + Deploy

Use the `/deploy` skill. Steps:

- [ ] Merge to master: `git checkout master && git merge feature/sprint-64-admin-connector-adr`
- [ ] Push: `git push origin master`
- [ ] Monitor GitHub Actions — should pass (no service changes beyond request-service backend fix)
- [ ] Verify on karmyq.com: log in as a mod, confirm boost/propose buttons work without 403; log in as a member, confirm ⚡ Community Pick badge appears on boosted requests in BrowseFeed
