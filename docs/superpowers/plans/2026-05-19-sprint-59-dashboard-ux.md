# Sprint 59: Dashboard UX Simplification — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Simplify the personal dashboard — 3 tabs (browse/helping/asks), no Profile tab stub, no provider stat cards, provider re-entry in nav, and confirmed matches excluded from the Browse feed.

**Architecture:** All changes are frontend-only except one backend verification (request status on match acceptance). No schema changes, no new routes.

**Tech Stack:** Node.js/Express/TypeScript, Next.js 14, PostgreSQL 15.

---

## File Map

### New files to create
None.

### Existing files to modify
| File | Change |
|------|--------|
| `apps/frontend/src/components/TabBar.tsx` | Rename tabs + remove profile |
| `apps/frontend/src/pages/dashboard.tsx` | Remove profile tab render + provider stat cards |
| `apps/frontend/src/components/Layout.tsx` | Add "Become a provider" link for non-providers |
| `apps/frontend/src/pages/requests/[id].tsx` | Update redirect URL |
| `services/request-service/src/routes/requests.ts` | Verify/fix match acceptance sets request status to `matched` |
| Landing docs | Tab name updates in affected guides |

---

## ⚠️ Critical Implementation Notes (read before Task 2)

1. **`TabId` is a breaking rename** — grep ALL files before touching anything: `grep -rn "commitments\|my-requests\|tab.*profile" apps/frontend/src/ --include="*.ts" --include="*.tsx"`. Fix every hit.

2. **Only one `?tab=commitments` redirect exists**: `apps/frontend/src/pages/requests/[id].tsx:20`. Also check `services/notification-service/src/` for hardcoded dashboard deep-link URLs.

3. **ProviderDashboardCard removal**: don't remove the `useProvider()` hook call from dashboard.tsx — it's still needed for other logic. Only remove the two JSX component renders. Also remove `activeCommitmentsCount` (line 419) which becomes unused.

4. **Mobile labels**: `TabBar` has both `label` (desktop) and `mobileLabel` (bottom nav). Update both strings. Current mobile label for commitments is `'Commits'` — new label should be `'Helping'`.

5. **Provider re-entry**: `/providers/new` already exists. Just add a nav link. The link is conditional: show `"Become a provider"` only when `!hasProviderProfile`.

6. **Feed fix**: `BrowseFeed` already filters `r.status === 'open'`. The bug is likely that the offer-acceptance handler doesn't update the request's status to `'matched'`. Verify by reading the accept-match endpoint. If status IS being set, look for a stale-fetch issue in BrowseFeed.

---

## Task 1: Feature branch

- [ ] Create branch and verify baseline tests pass

```bash
git checkout -b feature/sprint-59-dashboard-ux
npm test
```

---

## Task 2: Write TDD tests first

**Files:**
- Create: `apps/frontend/tests/tdd/sprint-59-dashboard-ux.test.tsx`

- [ ] **Test: Profile tab absent from TabBar**

```typescript
import { render, screen } from '@testing-library/react'
import TabBar from '@/components/TabBar'

test('TabBar renders helping and asks tabs, not commitments/my-requests/profile', () => {
  const onChange = jest.fn()
  render(<TabBar activeTab="browse" onChange={onChange} />)
  expect(screen.queryByText('Profile')).toBeNull()
  expect(screen.queryByText('Commitments')).toBeNull()
  expect(screen.queryByText('My Requests')).toBeNull()
  expect(screen.getByText('Helping')).toBeInTheDocument()
  expect(screen.getByText('Asks')).toBeInTheDocument()
})
```

- [ ] **Test: BrowseFeed excludes matched-status requests**

```typescript
// Test that BrowseFeed's filter excludes matched requests
import { render } from '@testing-library/react'
// Mock requestService to return a matched request + an open request
// Assert: only the open request appears; matched request is not rendered
```

- [ ] Run tests (they will fail — that's correct TDD)

```bash
cd apps/frontend && npx jest tests/tdd/sprint-59-dashboard-ux.test.tsx --no-coverage 2>&1 | tail -20
```

---

## Task 3: Rename tabs in TabBar

**Files:**
- Modify: `apps/frontend/src/components/TabBar.tsx`

- [ ] **Update `TabId` type** — remove `'profile'`, rename `'commitments'` → `'helping'`, `'my-requests'` → `'asks'`

```typescript
export type TabId = 'browse' | 'helping' | 'asks'
```

- [ ] **Update `TABS` array** — new entries:

```typescript
const TABS: Tab[] = [
  { id: 'browse', label: 'Browse', mobileLabel: 'Browse', icon: <BrowseIcon /> },
  { id: 'helping', label: 'Helping', mobileLabel: 'Helping', icon: <CommitmentsIcon /> },
  { id: 'asks', label: 'Asks', mobileLabel: 'Asks', icon: <RequestsIcon /> },
]
```

- [ ] **Update badge logic** — change `tab.id === 'commitments'` checks → `tab.id === 'helping'`; update `dibsCount` badge to target `'helping'` tab

- [ ] **Remove ProfileIcon** (no longer used)

- [ ] **Verify TypeScript** — `tsc --noEmit` from `apps/frontend`

---

## Task 4: Update dashboard.tsx

**Files:**
- Modify: `apps/frontend/src/pages/dashboard.tsx`

- [ ] **Update `activeTab` initial state and type**

```typescript
const [activeTab, setActiveTab] = useState<TabId>('browse')
```

- [ ] **Update URL tab param handler** (line 119) — remove `'profile'` check; rename `'commitments'` → `'helping'`, `'my-requests'` → `'asks'`

```typescript
if (tabParam === 'helping' || tabParam === 'asks') {
  setActiveTab(tabParam)
}
```

- [ ] **Remove `ProviderDashboardCard` and `ProviderMatchingRequests` render blocks** (lines 466–476 in dashboard.tsx)

- [ ] **Remove `activeCommitmentsCount` variable** (it was only used for ProviderDashboardCard's prop)

- [ ] **Remove imports** for `ProviderDashboardCard` and `ProviderMatchingRequests`

- [ ] **Update tab content renders**:
  - `activeTab === 'commitments'` → `activeTab === 'helping'`
  - `activeTab === 'my-requests'` → `activeTab === 'asks'`
  - Remove the profile tab render block entirely

- [ ] **Update `SpeedDialFab`** — if it references tab IDs, update those too

- [ ] **TypeScript check**: `tsc --noEmit`

---

## Task 5: Update all other files referencing old tab IDs

**Files:**
- Modify: `apps/frontend/src/pages/requests/[id].tsx`
- Check: `services/notification-service/src/` for hardcoded tab URLs

- [ ] **Grep for all old tab ID references**:

```bash
grep -rn "'commitments'\|'my-requests'\|tab=commitments\|tab=my-requests\|tab=profile" apps/frontend/src/ services/ --include="*.ts" --include="*.tsx"
```

- [ ] **Update `requests/[id].tsx:20`** — change redirect from `?tab=commitments` → `?tab=helping`

- [ ] **Fix any notification service deep-links** that reference `/dashboard?tab=commitments` → `/dashboard?tab=helping` (check `services/notification-service/src/templates/` or similar)

- [ ] **TypeScript check across changed files**

---

## Task 6: Provider re-entry in Layout nav

**Files:**
- Modify: `apps/frontend/src/components/Layout.tsx`

- [ ] **Desktop nav — add "Become a provider" for non-providers**

In the `{hasProviderProfile && <Link href="/providers">` block, add an `else` link for non-providers:

```typescript
{hasProviderProfile ? (
  <Link href="/providers" className={/* existing styles */}>
    Providers
  </Link>
) : (
  <Link href="/providers/new" className={`px-3 py-2 text-sm font-medium rounded-lg transition-all text-text-muted hover:bg-surface`}>
    Become a provider
  </Link>
)}
```

- [ ] **Mobile hamburger — add "Become a provider" for non-providers**

In `HamburgerMenu`, after the existing `{hasProviderProfile && <Link href="/providers">}` block:

```typescript
{!hasProviderProfile && (
  <Link href="/providers/new" className="block px-4 py-2 text-sm text-text hover:bg-surface transition-colors" onClick={() => setOpen(false)}>
    Become a provider
  </Link>
)}
```

- [ ] **TypeScript check**

---

## Task 7: Fix feed — confirmed matches excluded from Browse

**Files:**
- Modify: `services/request-service/src/routes/requests.ts`

- [ ] **Find the offer/match acceptance handler**

```bash
grep -n "accept\|matched\|status.*matched" services/request-service/src/routes/requests.ts | head -30
```

- [ ] **Verify that on match acceptance, the request status is set to `'matched'`**

Look for the pattern where `matches` row status is updated to `'matched'`. Check whether a corresponding `UPDATE help_requests SET status = 'matched'` runs.

- [ ] **If missing: add the request status update**

After the match status update, add:
```typescript
await db.query(
  `UPDATE requests.help_requests SET status = 'matched', updated_at = NOW() WHERE id = $1`,
  [requestId]
)
```

- [ ] **If already present but BrowseFeed still shows matched requests**: the issue is stale client data. In `BrowseFeed.tsx`, the filter already does `r.status === 'open'` — the fix is to ensure the curated endpoint also explicitly excludes `status != 'open'` in the DB query. Check `services/request-service/src/routes/requests.ts` curated endpoint.

- [ ] **Test the fix**: start services locally, create a request, accept an offer on it, verify the request disappears from BrowseFeed

---

## Task 8: Landing docs + user guide updates

**Files:**
- Modify: `apps/landing/src/data/docs/guides/` (affected guides)
- Modify: `apps/landing/src/data/docs/guides/getting-started.json` if tab names mentioned
- Modify: relevant user guides referencing "My Requests", "Commitments", or "Profile tab"

- [ ] **Find all landing doc files that mention old tab names**

```bash
grep -rn "My Requests\|Commitments\|commitments tab\|profile tab" apps/landing/src/data/docs/ --include="*.json"
```

- [ ] **Update each mention**: "My Requests tab" → "Asks tab", "Commitments tab" → "Helping tab", "Profile tab" → reference to profile via nav

- [ ] **If a provider mode guide exists**: update it to reflect the new "Become a provider" nav link rather than any previous mode-switcher UI

---

## Task 9: CONTEXT.md + registry.json

**Files:**
- Modify: `apps/frontend/.claude/README.md` or frontend CONTEXT.md if it exists

- [ ] **No service CONTEXT.md changes needed** — this sprint has no backend schema or endpoint changes (only one potential status-update bug fix)

- [ ] **Document the fix** in `services/request-service/CONTEXT.md` "Recent Fixes" section if the match acceptance bug was patched

- [ ] **Run feedback check**:

```bash
npm run feedback:check
```

---

## Task 10: Final verification

- [ ] **All tests pass**:

```bash
npm test
npm run test:tdd
```

- [ ] **TypeScript clean across the entire frontend**:

```bash
cd apps/frontend && npx tsc --noEmit
```

- [ ] **Smoke test manually**:
  1. Open `/dashboard` — confirm 3 tabs (Browse / Helping / Asks), no Profile tab, no ProviderDashboardCard
  2. Click avatar/name → should go to /profile (nav still works)
  3. Non-provider user → nav shows "Become a provider" link → clicking goes to `/providers/new`
  4. User with provider profile → nav shows "Providers" link + availability toggle (unchanged)
  5. Accept a match on a request → that request should no longer appear in Browse tab

- [ ] **Feedback check**:

```bash
npm run feedback:check
```

---

## Task 11: Merge + Deploy

- [ ] Merge to master, push, monitor GitHub Actions, verify deploy completes

```bash
git checkout master
git merge feature/sprint-59-dashboard-ux
git push origin master
```

Use the `/deploy` skill if deployment issues arise.

- [ ] Bump version to v9.26.0 in `package.json` (root)

- [ ] Update handoff: mark Sprint 59 complete, set Sprint 60 as next
