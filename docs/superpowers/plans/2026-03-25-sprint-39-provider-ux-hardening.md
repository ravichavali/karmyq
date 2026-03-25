# Sprint 39: Provider Mode UX Hardening — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Harden provider mode into a true behavioral toggle: gate all provider UI,
wire accept/reject offers, and make requester/helper names clickable (TrustCard).

**Architecture:** Frontend-only sprint. Four targeted component edits + doc update.
No new backend endpoints, no DB migrations, no new files (only edits + guide update).

**Tech Stack:** Next.js 14, React, TypeScript.

---

## File Map

### Existing files to modify
| File | Change |
|------|--------|
| `apps/frontend/src/components/Layout.tsx` | Gate "Providers" nav link behind `providerMode === 'provider'` |
| `apps/frontend/src/components/ProviderNotificationBell.tsx` | Gate render behind `providerMode === 'provider'` |
| `apps/frontend/src/components/SpeedDialFab.tsx` | Add `isProviderMode` prop; return null in provider mode |
| `apps/frontend/src/pages/dashboard.tsx` | Pass `isProviderMode` to `SpeedDialFab` |
| `apps/frontend/src/components/CommitmentsTab.tsx` | Wire accept/reject API + clickable names (TrustCard) |
| `apps/frontend/src/components/Feed/FeedItem.tsx` | Make author name clickable → TrustCard in `OpenRequestItem` |
| `docs/guides/provider-mode-guide.md` | Update to describe mode toggle behavior |

---

## ⚠️ Critical Implementation Notes (read before Task 2)

1. **`useProvider()` works in Layout.tsx** — `ProviderProvider` wraps the whole app in
   `_app.tsx`. No context changes needed.

2. **CommitmentsTab accept state update** — after `acceptMatch`, optimistically set
   status to `'matched'` in local state AND re-fetch to keep both sides in sync. After
   `rejectMatch` (decline OR withdraw), remove the match from the array entirely.

3. **`requester_id` is optional** in the CommitmentsTab Match interface — guard:
   `{m.requester_id ? <button onClick={...}>name</button> : <span>name</span>}`

4. **`SuggestedRequestData` has no author name field** — skip TrustCard-on-name for
   `SuggestedRequestItem`. Only `OpenRequestItem` gets the clickable name.

5. **"I'm Helping" + proposed = Withdraw** — the helper already offered; they can't
   "Accept" their own offer. Replace the Accept+Decline pair with a single "Withdraw"
   button that calls `rejectMatch`.

6. **generate-docs is source of truth** — edit `docs/guides/provider-mode-guide.md`,
   then run `npm run generate-docs` (do NOT edit nav.json directly).

7. **No DB migration, no backend changes** — this is a pure frontend sprint.

---

## Task 1: Feature Branch

- [ ] **Create branch**

```bash
git checkout -b feature/sprint-39-provider-ux-hardening
```

---

## Task 2: Gate "Providers" Nav Link in Layout

**Files:**
- Modify: `apps/frontend/src/components/Layout.tsx`

- [ ] **Add `useProvider` import and hook call**

At the top of `Layout.tsx`, add the import:
```typescript
import { useProvider } from '../contexts/ProviderContext'
```

Inside the `Layout` component (after `const router = useRouter()`), add:
```typescript
const { providerMode } = useProvider()
const isProviderMode = providerMode === 'provider'
```

- [ ] **Gate desktop "Providers" nav link**

Wrap the desktop `<Link href="/providers">` block (lines ~97-107) in a conditional:
```tsx
{isProviderMode && (
  <Link
    href="/providers"
    className={`px-3 py-2 text-sm font-medium rounded-lg transition-all ${
      router.pathname.startsWith('/providers')
        ? 'bg-primary-light text-primary'
        : 'text-text-muted hover:bg-surface'
    }`}
  >
    Providers
  </Link>
)}
```

- [ ] **Gate hamburger "Service Providers" link**

In the `HamburgerMenu` function, wrap the `<Link href="/providers">` block in:
```tsx
{isProviderMode && (
  <Link href="/providers" ...>Service Providers</Link>
)}
```

Note: `HamburgerMenu` is defined outside `Layout`, so it needs to accept `isProviderMode`
as a prop OR use `useProvider()` inside it directly. The simplest fix: call `useProvider()`
at the top of the `HamburgerMenu` function (it's inside `ProviderProvider` context so this works).

- [ ] **Verify**: Switch to member mode → Providers link disappears. Switch to provider mode → reappears.

---

## Task 3: Gate ProviderNotificationBell

**Files:**
- Modify: `apps/frontend/src/components/ProviderNotificationBell.tsx`

- [ ] **Read the file first**, then add `providerMode` to the destructured hook values:

```typescript
const { hasProviderProfile, providerMode } = useProvider()
```

- [ ] **Add providerMode guard** at the render condition:

Change the existing `if (!hasProviderProfile) return null` check to:
```typescript
if (!hasProviderProfile || providerMode !== 'provider') return null
```

- [ ] **Verify**: With a provider profile in member mode, the amber bell disappears. Switch to provider mode → reappears.

---

## Task 4: Hide SpeedDial FAB in Provider Mode

**Files:**
- Modify: `apps/frontend/src/components/SpeedDialFab.tsx`
- Modify: `apps/frontend/src/pages/dashboard.tsx`

- [ ] **Add `isProviderMode` prop to `SpeedDialFab`**

Update the `SpeedDialFabProps` interface:
```typescript
interface SpeedDialFabProps {
  activeTab: TabId
  onGetHelp: () => void
  onGetService: () => void
  isProviderMode?: boolean
}
```

At the top of the `SpeedDialFab` function body, before the tab logic:
```typescript
if (isProviderMode) return null
```

- [ ] **Pass `isProviderMode` from `dashboard.tsx`**

The dashboard already has `const isProviderMode = providerMode === 'provider'`. Update
the `<SpeedDialFab>` call to pass it:
```tsx
<SpeedDialFab
  activeTab={activeTab}
  onGetHelp={() => setShowWizard(true)}
  onGetService={() => setShowWizard(true)}
  isProviderMode={isProviderMode}
/>
```

- [ ] **Verify**: In provider mode, the + FAB disappears. In member mode, it shows as before.

---

## Task 5: Wire CommitmentsTab Accept/Reject + Clickable Names

**Files:**
- Modify: `apps/frontend/src/components/CommitmentsTab.tsx`

This is the largest task. Four changes in one file.

### 5a: Add TrustCard import and state

- [ ] **Add imports** at the top:
```typescript
import { TrustCard } from './TrustCard'
```

- [ ] **Add state** inside `CommitmentsTab`:
```typescript
const [selectedProfileUserId, setSelectedProfileUserId] = useState<string | null>(null)
```

### 5b: Wire `handleAccept` for "requested" side

- [ ] **Replace the TODO stub** in `handleAccept`:

```typescript
const handleAccept = async (matchId: string, side: 'helping' | 'requested') => {
  setActioning(matchId)
  try {
    const userData = typeof window !== 'undefined' ? localStorage.getItem('user') : null
    let currentUser = null
    try { currentUser = userData ? JSON.parse(userData) : null } catch { currentUser = null }
    if (!currentUser) return

    await requestService.acceptMatch(matchId, currentUser.id)

    // Optimistically update status
    if (side === 'helping') {
      setHelping((prev) =>
        prev.map((m) => m.id === matchId ? { ...m, status: 'matched' } : m)
      )
    } else {
      setRequested((prev) =>
        prev.map((m) => m.id === matchId ? { ...m, status: 'matched' } : m)
      )
    }
  } catch (err: any) {
    alert(err.response?.data?.message || 'Failed to accept offer')
  } finally {
    setActioning(null)
  }
}
```

### 5c: Wire `handleDecline` for "requested" side (and rename to Withdraw for helpers)

- [ ] **Replace the TODO stub** in `handleDecline`:

```typescript
const handleDecline = async (matchId: string, side: 'helping' | 'requested') => {
  setActioning(matchId)
  try {
    const userData = typeof window !== 'undefined' ? localStorage.getItem('user') : null
    let currentUser = null
    try { currentUser = userData ? JSON.parse(userData) : null } catch { currentUser = null }
    if (!currentUser) return

    await requestService.rejectMatch(matchId, currentUser.id)

    // Remove from the relevant side (rejected/withdrawn matches are gone)
    if (side === 'helping') {
      setHelping((prev) => prev.filter((m) => m.id !== matchId))
    } else {
      setRequested((prev) => prev.filter((m) => m.id !== matchId))
    }
  } catch (err: any) {
    alert(err.response?.data?.message || 'Failed to decline offer')
  } finally {
    setActioning(null)
  }
}
```

### 5d: Fix "I'm Helping" proposed buttons (Accept → Withdraw)

- [ ] **In `renderHelpingCard`**, replace the `proposed` action block:

```tsx
{m.status === 'proposed' && (
  <div className="flex justify-end mt-3">
    <button
      className="text-xs py-1 px-2 rounded bg-red-100 text-red-700 hover:bg-red-200 disabled:opacity-50"
      disabled={actioning === m.id}
      onClick={() => handleDecline(m.id, 'helping')}
    >
      {actioning === m.id ? 'Withdrawing…' : 'Withdraw Offer'}
    </button>
  </div>
)}
```

### 5e: Make requester/responder names clickable

- [ ] **In `renderHelpingCard`**, wrap `m.requester_name` in a conditional button:

```tsx
<p className="text-sm text-text-muted mt-0.5">
  For{' '}
  {m.requester_id ? (
    <button
      className="font-medium text-primary hover:underline"
      onClick={() => setSelectedProfileUserId(m.requester_id!)}
    >
      {m.requester_name ?? 'community member'}
    </button>
  ) : (
    <span>{m.requester_name ?? 'community member'}</span>
  )}
</p>
```

- [ ] **In `renderRequestedCard`**, wrap `m.responder_name` similarly:

```tsx
<p className="text-sm text-text-muted mt-0.5">
  {m.responder_name ? (
    <>
      Helper:{' '}
      <button
        className="font-medium text-primary hover:underline"
        onClick={() => setSelectedProfileUserId(m.responder_id)}
      >
        {m.responder_name}
      </button>
    </>
  ) : (
    'Waiting for helper'
  )}
</p>
```

### 5f: Render TrustCard

- [ ] **Add TrustCard at the bottom of the return**, just before the closing `</div>`:

```tsx
{selectedProfileUserId && (
  <TrustCard
    userId={selectedProfileUserId}
    onClose={() => setSelectedProfileUserId(null)}
  />
)}
```

- [ ] **Verify**: Click a requester/helper name → TrustCard modal opens. Accept a proposed
  offer in "I Asked For Help" → status changes to matched. Decline → card disappears.
  Withdraw in "I'm Helping" → card disappears.

---

## Task 6: Clickable Author Name in FeedItem

**Files:**
- Modify: `apps/frontend/src/components/Feed/FeedItem.tsx`

Only `OpenRequestItem` has an `author_name` field (from `OpenRequestData`).
`SuggestedRequestItem` has no author name in the type — skip it.

- [ ] **In `OpenRequestItem`**, change "Posted by {data.author_name}" from plain text to a button:

Existing code:
```tsx
<span>Posted by {data.author_name}</span>
```

Replace with:
```tsx
<button
  type="button"
  className="hover:underline text-left"
  onClick={() => setSelectedTrustUserId(data.requester_id)}
>
  Posted by {data.author_name}
</button>
```

The `selectedTrustUserId` state and `<TrustCard>` render already exist in `OpenRequestItem`
(added in Sprint 38 for the TrustPathBadge). No new state needed.

- [ ] **Verify**: Click "Posted by [name]" in a feed item → TrustCard modal opens.

---

## Task 7: Update Provider Mode Guide

**Files:**
- Modify: `docs/guides/provider-mode-guide.md`

- [ ] **Update the guide** to document the full toggle behavior. Key sections to add/update:

  - **What changes in provider mode**: Providers nav link appears, provider bell appears,
    FAB disappears (you're offering, not asking), feed label changes to "Requests for Me",
    feed filters by your service types.
  - **What stays the same**: Communities tab, commitments, member notifications.
  - **How to switch**: Use the Member/Provider toggle in the top nav bar.
  - **When to use member mode**: For community participation, posting requests, browsing
    your own commitments.

- [ ] **Regenerate landing page docs**:

```bash
cd c:/Users/ravic/development/karmyq && npm run generate-docs
```

- [ ] **Force-add generated landing docs**:

```bash
git add -f apps/landing/src/data/docs/
```

---

## Task 8: TDD Tests

**Files:**
- Create: `apps/frontend/tests/tdd/sprint-39-provider-ux.test.tsx`

- [ ] **Write tests** covering the new behaviors:

```typescript
// Test: Provider nav link hidden in member mode
// Test: Provider nav link visible in provider mode
// Test: ProviderNotificationBell hidden in member mode
// Test: SpeedDialFab returns null in provider mode
// Test: SpeedDialFab renders + action in member mode (browse tab)
// Test: CommitmentsTab shows Withdraw (not Accept) for helping+proposed
// Test: CommitmentsTab shows Accept+Decline for requested+proposed
// Test: Accept button calls requestService.acceptMatch with correct args
// Test: Decline button calls requestService.rejectMatch with correct args
// Test: Clicking requester name opens TrustCard (selectedProfileUserId set)
```

- [ ] **Run tests**:

```bash
cd apps/frontend && npx jest tests/tdd/sprint-39-provider-ux.test.tsx --no-coverage
```

---

## Task 9: CONTEXT.md + Feedback Loop Check

**Files:**
- No CONTEXT.md changes needed (no backend changes)
- No registry.json changes needed

- [ ] **Run feedback loop check**:

```bash
npm run feedback:check
```

- [ ] **Run full test suite**:

```bash
npm test
```

- [ ] **TypeScript check**:

```bash
cd apps/frontend && npx tsc --noEmit
```

---

## Task 10: Final Verification + Pre-Push Check

- [ ] **Manual smoke test** (in browser at localhost:3000):
  - Log in as a user with a provider profile
  - In member mode: no Providers link, no amber bell, FAB shows +
  - Switch to provider mode: Providers link appears, amber bell appears, FAB disappears
  - Go to Commitments tab: click a name → TrustCard opens
  - On a proposed match in "I Asked For Help": click Accept → status changes to matched
  - On a proposed match in "I'm Helping": only "Withdraw Offer" button shown

- [ ] **Run pre-push checks**:

```bash
npm test && npm run test:tdd && npm run feedback:check
```

---

## Task 11: Merge + Deploy

- [ ] **Commit and merge**:

```bash
git add -p  # stage targeted files
git commit -m "feat: Sprint 39 — Provider Mode UX Hardening + Accept Offers v9.14.0"
git checkout master
git merge feature/sprint-39-provider-ux-hardening
git push origin master
```

- [ ] **Monitor GitHub Actions** — deployment to karmyq.com is automatic on push to master.

- [ ] **Verify on karmyq.com** — same smoke test as Task 10 above.

> Use the `/deploy` skill if manual SSH is needed.
