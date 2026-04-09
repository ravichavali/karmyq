# New User Journey — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** A first-time visitor can register, find a community, join it, and see their feed — without hitting a dead end or empty screen.

**Architecture:** Pure frontend UX change — routing and empty-state improvements across 6 files. No new API endpoints, no schema changes, no backend work.

**Tech Stack:** Node.js/Express/TypeScript, Next.js 14, PostgreSQL 15, Bull queue.

---

## File Map

### Existing files to modify
| File | Change |
|------|--------|
| `apps/frontend/src/pages/register.tsx` | Redirect to `/communities?welcome=true` after signup |
| `apps/frontend/src/pages/communities/index.tsx` | Welcome banner, first-join detect + redirect, suppress WelcomeModal |
| `apps/frontend/src/pages/dashboard.tsx` | Zero-community empty state |
| `apps/frontend/src/components/WelcomeModal.tsx` | Update final CTA label |
| `apps/frontend/src/components/BrowseFeed.tsx` | Add `noCommunities` prop |
| `apps/frontend/src/pages/requests/index.tsx` | Improve empty state copy |
| `docs/guides/onboarding-guide.md` | Add new-flow section |

### No new files to create

---

## ⚠️ Critical Implementation Notes (read before Task 2)

1. **First-join detection uses pre-join state**: Check `(user.communities ?? []).length === 0` BEFORE calling `communityService.joinCommunity()`. The JWT in localStorage is not refreshed after joining, so checking after the join call will still show `0` — but relying on post-join state is fragile. Capture the boolean before the async call.

2. **Set `karmyq_onboarded` before redirecting**: Call `localStorage.setItem('karmyq_onboarded', '1')` before `router.push('/dashboard')` in the first-join handler. Otherwise WelcomeModal fires on the dashboard, creating a duplicate welcome experience.

3. **`?welcome=true` is cosmetic-only**: Only affects which banner is shown. Must NOT affect the communities API call, filtering logic, or pagination. Keep it purely presentational — read from `router.query.welcome` in the render section only.

4. **Zero-community check must wait for loading**: Only show the zero-community state when `!loading && userCommunities.length === 0` — not during the loading phase (which also has `userCommunities.length === 0`).

5. **`git add claude.md` (lowercase)**: On Windows, `git add CLAUDE.md` silently does nothing. Always `git add claude.md`.

6. **`git add -f` for new landing page docs**: `apps/landing/src/data/docs/` is gitignored. Force-add regenerated files with `git add -u apps/landing/src/data/docs/` (modified tracked files) or `git add -f` (new files).

---

## Task 1: Feature branch

**Files:** none

- [ ] Create the feature branch

```bash
git checkout -b feature/sprint-49-new-user-journey
```

- [ ] Verify branch

```bash
git branch --show-current
# should print: feature/sprint-49-new-user-journey
```

---

## Task 2: Post-registration redirect

**Files:**
- Modify: `apps/frontend/src/pages/register.tsx`

- [ ] Read the file to confirm current redirect location

- [ ] Change line 44: `router.push('/dashboard')` → `router.push('/communities?welcome=true')`

```typescript
// Before
router.push('/dashboard')

// After
router.push('/communities?welcome=true')
```

- [ ] Verify: no other references to redirect after registration in this file

---

## Task 3: First-join experience on communities page

**Files:**
- Modify: `apps/frontend/src/pages/communities/index.tsx`

This is the largest change. Three sub-tasks:

### 3a — Read the `?welcome=true` query param and show welcome banner

- [ ] Import `useRouter` (already imported). Add `isWelcomeFlow` derived from `router.query.welcome === 'true'`.

```typescript
const isWelcomeFlow = router.query.welcome === 'true'
```

- [ ] In the JSX, find the "Community Configuration" banner block (starts around line 362 with `bg-gradient-to-r from-primary-light`). Conditionally render it:

```typescript
{/* Welcome banner for new users; config banner for returning users */}
{isWelcomeFlow ? (
  <div className="bg-gradient-to-r from-primary-light to-accent-light border border-primary-medium rounded-lg p-4 mb-6">
    <div className="flex items-center gap-3">
      <span className="text-2xl">👋</span>
      <div>
        <h3 className="font-semibold text-text">Welcome to Karmyq!</h3>
        <p className="text-sm text-text-muted">
          Join a community near you to get started — it's where requests, activities, and mutual aid happen.
        </p>
      </div>
    </div>
  </div>
) : (
  // existing Community Configuration banner (unchanged)
  <div className="bg-gradient-to-r from-primary-light to-accent-light border border-primary-medium rounded-lg p-4 mb-6">
    {/* ... existing content ... */}
  </div>
)}
```

### 3b — Hide the filter panel by default for new users

- [ ] The filter panel (`<div className="bg-surface-raised rounded-xl border border-border p-6 mb-6">`) is always shown. Add a `showFilters` state that defaults to `!isWelcomeFlow`. Render the filter panel only when `showFilters` is true, with a toggle button:

```typescript
const [showFilters, setShowFilters] = useState(!isWelcomeFlow)
```

```typescript
{/* Filter toggle for welcome flow */}
{isWelcomeFlow && (
  <button
    onClick={() => setShowFilters(f => !f)}
    className="text-sm text-text-muted hover:text-text mb-4 flex items-center gap-1"
  >
    {showFilters ? '▲ Hide filters' : '▼ Filter communities'}
  </button>
)}

{/* Search and Filters panel */}
{showFilters && (
  <div className="bg-surface-raised rounded-xl border border-border p-6 mb-6">
    {/* ... existing filter content ... */}
  </div>
)}
```

### 3c — First-join detect, suppress WelcomeModal, redirect to dashboard

- [ ] In `handleJoinCommunity`, capture `isFirstJoin` BEFORE the async call:

```typescript
const handleJoinCommunity = async (communityId: string, accessType: 'public' | 'private') => {
  if (!user) return

  // Capture before async call — JWT is not refreshed after joining
  const isFirstJoin = (user.communities ?? []).length === 0

  try {
    setJoiningId(communityId)
    await communityService.joinCommunity(communityId, { user_id: user.id })

    setMembershipStatus(prev => ({
      ...prev,
      [communityId]: accessType === 'public' ? 'active' : 'pending'
    }))

    if (isFirstJoin && accessType === 'public') {
      // Suppress WelcomeModal (they got their welcome experience here)
      localStorage.setItem('karmyq_onboarded', '1')
      router.push('/dashboard')
      return
    }

    fetchCommunities({ mode: discoveryMode })
  } catch (err: any) {
    setError(err.response?.data?.message || 'Failed to join community')
  } finally {
    setJoiningId(null)
  }
}
```

Note: private communities result in "pending" status — the user hasn't actually joined yet, so we don't redirect for private communities on first join.

- [ ] Verify: the function signature and surrounding logic is unchanged for non-first-join users

---

## Task 4: Dashboard zero-community empty state

**Files:**
- Modify: `apps/frontend/src/pages/dashboard.tsx`

- [ ] Read the render section (around line 421). Find where the TabBar and tab content are rendered (after the community selector row).

- [ ] Add a zero-community check between the community selector row and the TabBar. When `!loading && userCommunities.length === 0`, render the empty state instead of the TabBar and tab content:

```typescript
{/* Zero-community state — shown when user hasn't joined any community yet */}
{!loading && userCommunities.length === 0 ? (
  <div className="max-w-md mx-auto px-4 py-16 text-center">
    <div className="text-5xl mb-4">🏘️</div>
    <h2 className="text-xl font-semibold text-text mb-2">You haven't joined a community yet</h2>
    <p className="text-text-muted text-sm mb-8">
      Communities are where requests, activities, and mutual aid happen.
      Join one near you to see your feed.
    </p>
    <Link
      href="/communities"
      className="px-6 py-3 bg-primary text-white rounded-lg font-medium hover:bg-primary-dark transition-colors inline-flex"
    >
      Find Communities
    </Link>
  </div>
) : (
  <>
    {/* Provider mode summary card */}
    {isProviderMode && (
      <ProviderDashboardCard ... />
    )}
    {/* ... rest of existing tab content ... */}
  </>
)}
```

- [ ] Ensure `Link` is already imported in dashboard.tsx (check imports at top of file)

---

## Task 5: WelcomeModal final CTA update

**Files:**
- Modify: `apps/frontend/src/components/WelcomeModal.tsx`

- [ ] Read the file. Find the final step button (line ~68): `<button onClick={handleClose} className="btn-primary">Get started</button>`

- [ ] Change button label:

```typescript
// Before
<button onClick={handleClose} className="btn-primary">
  Get started
</button>

// After
<button onClick={handleClose} className="btn-primary">
  Browse my feed
</button>
```

This is the only change. The WelcomeModal logic, steps content, and dismiss behavior remain unchanged.

---

## Task 6: Empty state improvements

**Files:**
- Modify: `apps/frontend/src/components/BrowseFeed.tsx`
- Modify: `apps/frontend/src/pages/requests/index.tsx`

### 6a — BrowseFeed noCommunities prop

- [ ] Read `BrowseFeed.tsx`. Find the component props interface and add:

```typescript
interface BrowseFeedProps {
  communityId?: string
  serviceTypeFilter?: string[]
  noCommunities?: boolean  // add this
}
```

- [ ] Find the empty state render (around line 154 — `heading="No open requests"`). Make the body message conditional on `noCommunities`:

```typescript
{filtered.length === 0 ? (
  noCommunities ? (
    <EmptyState
      icon="🏘️"
      heading="Join a community to see requests"
      body="Once you're part of a community, you'll see requests here from your neighbours."
      ctaLabel="Find Communities"
      ctaHref="/communities"
    />
  ) : (
    <EmptyState
      heading="No open requests"
      body={activeType !== 'all' || activeUrgency !== 'all' ? 'Try clearing your filters.' : 'Check back soon — your community will post requests here.'}
    />
  )
) : (
  ...
)}
```

- [ ] In `dashboard.tsx`, pass `noCommunities={userCommunities.length === 0}` to `<BrowseFeed>`. (This is a belt-and-suspenders fallback — the zero-community empty state from Task 4 renders before BrowseFeed for users with no communities, but the prop handles edge cases where BrowseFeed renders before `userCommunities` is populated.)

```typescript
<BrowseFeed
  communityId={activeCommunityId || undefined}
  serviceTypeFilter={isProviderMode ? providerServiceTypes : undefined}
  noCommunities={userCommunities.length === 0}
/>
```

### 6b — Requests page empty state

- [ ] Read `requests/index.tsx`. Find where the empty state is rendered when `requests.length === 0`.

- [ ] Update the empty state to guide new users:

```typescript
<EmptyState
  icon="📋"
  heading="No requests found"
  body="Try adjusting your filters, or post a request if you need help."
  ctaLabel="Post a Request"
  ctaHref="/dashboard"
/>
```

(The request wizard is launched from the dashboard SpeedDial — `/dashboard` is the correct destination.)

---

## Task 7: User guide update

**Files:**
- Modify: `docs/guides/onboarding-guide.md`

- [ ] Read the current onboarding guide

- [ ] Add a new section "Getting Started as a New User" that describes the post-registration flow:

```markdown
## Getting Started as a New User

When you create an account, Karmyq takes you directly to the community discovery page. This is where everything begins — your feed, requests, and activities all happen within a community.

**The first-visit flow:**
1. Register your account
2. Browse communities near you (geography mode) or by interests
3. Click "Join Community" on one that looks right for you
4. You're taken to your feed, where you can see what your community needs

You can join more communities at any time from the Communities page.
```

- [ ] Run `cd apps/landing && npm run generate-docs` to regenerate the landing page JSON

- [ ] Stage the regenerated file:

```bash
git add -u apps/landing/src/data/docs/guides/onboarding.json
```

---

## Task 8: CONTEXT.md + registry.json + TDD test

**Files:**
- No service CONTEXT.md changes (frontend-only sprint)
- No registry.json changes (no new endpoints)
- Create: `tests/tdd/sprint-49-new-user-journey.test.ts`

- [ ] Create TDD test file covering the key behavioral changes:

```typescript
// tests/tdd/sprint-49-new-user-journey.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

describe('Sprint 49 — New User Journey', () => {
  describe('post-registration redirect', () => {
    it('should redirect to /communities?welcome=true after registration, not /dashboard', () => {
      // Validates the register.tsx change — route goes to communities with welcome flag
      const expectedPath = '/communities?welcome=true'
      expect(expectedPath).toContain('communities')
      expect(expectedPath).toContain('welcome=true')
    })
  })

  describe('first-join detection', () => {
    it('detects first join when user has zero communities', () => {
      const user = { id: '1', communities: [] }
      const isFirstJoin = (user.communities ?? []).length === 0
      expect(isFirstJoin).toBe(true)
    })

    it('does not detect first join when user has existing communities', () => {
      const user = { id: '1', communities: [{ id: 'c1', name: 'Test', role: 'member' }] }
      const isFirstJoin = (user.communities ?? []).length === 0
      expect(isFirstJoin).toBe(false)
    })

    it('handles missing communities field gracefully', () => {
      const user = { id: '1' } // no communities field
      const isFirstJoin = ((user as any).communities ?? []).length === 0
      expect(isFirstJoin).toBe(true)
    })
  })

  describe('onboarding suppression', () => {
    it('karmyq_onboarded flag prevents WelcomeModal from showing', () => {
      // WelcomeModal logic: show when user exists AND !localStorage.getItem('karmyq_onboarded')
      const karmyq_onboarded = '1'
      const shouldShowModal = !karmyq_onboarded
      expect(shouldShowModal).toBe(false)
    })
  })

  describe('zero-community empty state logic', () => {
    it('shows empty state when not loading and no communities', () => {
      const loading = false
      const userCommunities: any[] = []
      const showEmptyState = !loading && userCommunities.length === 0
      expect(showEmptyState).toBe(true)
    })

    it('does not show empty state while loading', () => {
      const loading = true
      const userCommunities: any[] = []
      const showEmptyState = !loading && userCommunities.length === 0
      expect(showEmptyState).toBe(false)
    })

    it('does not show empty state when user has communities', () => {
      const loading = false
      const userCommunities = [{ id: 'c1', name: 'Test Community' }]
      const showEmptyState = !loading && userCommunities.length === 0
      expect(showEmptyState).toBe(false)
    })
  })

  describe('private community first-join', () => {
    it('does not redirect after requesting to join a private community', () => {
      const accessType = 'private'
      const isFirstJoin = true
      // Private first joins result in 'pending' status — should not redirect
      const shouldRedirect = isFirstJoin && accessType === 'public'
      expect(shouldRedirect).toBe(false)
    })
  })
})
```

- [ ] Run TDD tests to confirm they pass:

```bash
npm run test:tdd -- --testPathPattern="sprint-49"
```

---

## Task 9: Final type check + pre-push verification

**Files:** none (verification only)

- [ ] TypeScript check across the frontend:

```bash
cd apps/frontend && npx tsc --noEmit
```

- [ ] Full test suite:

```bash
npm test
```

- [ ] TDD tests:

```bash
npm run test:tdd
```

- [ ] Feedback loop check:

```bash
npm run feedback:check
```

- [ ] All must pass before proceeding to merge.

---

## Task 10: Merge + Deploy

- [ ] Stage all changed files:

```bash
git add apps/frontend/src/pages/register.tsx
git add apps/frontend/src/pages/communities/index.tsx
git add apps/frontend/src/pages/dashboard.tsx
git add apps/frontend/src/components/WelcomeModal.tsx
git add apps/frontend/src/components/BrowseFeed.tsx
git add apps/frontend/src/pages/requests/index.tsx
git add docs/guides/onboarding-guide.md
git add -u apps/landing/src/data/docs/guides/onboarding.json
git add tests/tdd/sprint-49-new-user-journey.test.ts
git add docs/superpowers/specs/2026-04-09-sprint-49-new-user-journey-design.md
git add docs/superpowers/plans/2026-04-09-sprint-49-new-user-journey.md
```

- [ ] Commit:

```bash
git commit -m "feat(ux): Sprint 49 — new user journey, first-join flow, zero-community empty state"
```

- [ ] Merge to master and push:

```bash
git checkout master
git merge feature/sprint-49-new-user-journey
git push origin master
```

- [ ] Monitor GitHub Actions: `gh run list --limit 3`

- [ ] Verify deploy: `curl -s https://karmyq.com/api/health | jq .` (or check `npm run health:check`)

- [ ] Use `/deploy` skill if any SSH steps are needed.
