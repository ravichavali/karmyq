# On-Duty Browse Refinement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the binary on-duty feed fork with a 3-chip segmented control (Community / Provider / Both), add amber left-border accents on provider-match request cards, persist mode to `localStorage`.

**Architecture:** Pure frontend change — `BrowseFeed` takes `isOnDuty` + `providerServiceTypes` props (replacing `serviceTypeFilter`), owns `browseMode` state with localStorage persistence, and renders the segmented control when on-duty. `dashboard.tsx` passes the new props.

**Tech Stack:** Node.js/Express/TypeScript, Next.js 14, PostgreSQL 15, Bull queue.

---

## File Map

### New files to create
| File | Responsibility |
|------|----------------|
| `apps/frontend/tests/tdd/sprint-61-on-duty-browse.test.tsx` | TDD tests for segmented control, filter logic, card accents, localStorage persistence |

### Existing files to modify
| File | Change |
|------|--------|
| `apps/frontend/src/components/BrowseFeed.tsx` | Replace `serviceTypeFilter` prop with `isOnDuty` + `providerServiceTypes`; add `browseMode` state + localStorage; render segmented control; update filter logic; add card accents |
| `apps/frontend/src/pages/dashboard.tsx` | Update `<BrowseFeed>` props — remove `serviceTypeFilter`, add `isOnDuty` and `providerServiceTypes` |
| `docs/guides/provider-mode-guide.md` | Update for current on-duty toggle; add "Feed Modes" section with chip descriptions and card accent explanation |

---

## ⚠️ Critical Implementation Notes (read before Task 2)

1. **localStorage key is `karmyq_browse_mode`** — not user-scoped.
2. **Default on first on-duty is `'provider'`** — not `'community'`. Providers who just went on-duty see provider-matched requests first.
3. **Off-duty = no segmented control rendered at all** — when `isOnDuty` is false, filtering and accents are skipped entirely.
4. **`'both'` mode is unfiltered** — show all requests, but mark cards that match `providerServiceTypes` with amber accent. Do NOT filter the list.
5. **Prop rename is a breaking change to BrowseFeed's interface** — update both `BrowseFeed.tsx` AND `dashboard.tsx` in the same task (Task 4) to avoid a type error build gap.
6. **Amber color token** — `border-amber-400` for left-border, `text-amber-600 bg-amber-50` for the badge text. Both already exist in the component's `URGENCY_COLORS` map — consistent.
7. **Remove the static label** — the `"Showing requests matching your service types"` `<p>` tag is replaced by the segmented control.

---

## Task 1: Feature branch

**Files:**
- No file changes — git operation only.

- [ ] **Create the feature branch**

```bash
git checkout -b feature/sprint-61-on-duty-browse
```

- [ ] **Verify branch is active**

```bash
git branch --show-current
```

---

## Task 2: Write TDD tests first

**Files:**
- Create: `apps/frontend/tests/tdd/sprint-61-on-duty-browse.test.tsx`

Write tests BEFORE implementing. Tests will fail initially — that's expected and correct TDD.

- [ ] **Create the TDD test file**

```tsx
// apps/frontend/tests/tdd/sprint-61-on-duty-browse.test.tsx

import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import BrowseFeed from '@/components/BrowseFeed'
import { requestService } from '@/lib/api'

// Mock the API and hooks
jest.mock('@/lib/api', () => ({
  requestService: {
    getCuratedRequests: jest.fn(),
    createMatch: jest.fn(),
  },
}))
jest.mock('@/hooks/useTrustPath', () => ({
  useTrustPath: () => ({ trustPath: null, loading: false }),
}))

const MOCK_REQUESTS = [
  {
    id: 'r1', title: 'Need a ride', description: 'Downtown', status: 'open',
    urgency: 'medium', request_type: 'ride', requester_id: 'user-2',
    requester_name: 'Alice', created_at: new Date().toISOString(),
  },
  {
    id: 'r2', title: 'Fix my sink', description: 'Kitchen', status: 'open',
    urgency: 'low', request_type: 'service', requester_id: 'user-3',
    requester_name: 'Bob', created_at: new Date().toISOString(),
  },
  {
    id: 'r3', title: 'Borrow a drill', description: 'Weekend project', status: 'open',
    urgency: 'low', request_type: 'borrow', requester_id: 'user-4',
    requester_name: 'Carol', created_at: new Date().toISOString(),
  },
]

beforeEach(() => {
  ;(requestService.getCuratedRequests as jest.Mock).mockResolvedValue({
    data: { requests: MOCK_REQUESTS },
  })
  localStorage.clear()
  // Mock current user so all requests pass the requester_id filter
  localStorage.setItem('user', JSON.stringify({ id: 'user-1' }))
})

describe('BrowseFeed — off-duty (no segmented control)', () => {
  it('does not show segmented control when isOnDuty is false', async () => {
    render(<BrowseFeed isOnDuty={false} providerServiceTypes={['ride']} />)
    await waitFor(() => expect(screen.queryByRole('button', { name: /community/i })).toBeNull())
    expect(screen.queryByRole('button', { name: /provider/i })).toBeNull()
    expect(screen.queryByRole('button', { name: /both/i })).toBeNull()
  })

  it('shows all requests when off-duty', async () => {
    render(<BrowseFeed isOnDuty={false} providerServiceTypes={['ride']} />)
    await waitFor(() => expect(screen.getByText('Need a ride')).toBeInTheDocument())
    expect(screen.getByText('Fix my sink')).toBeInTheDocument()
    expect(screen.getByText('Borrow a drill')).toBeInTheDocument()
  })
})

describe('BrowseFeed — on-duty segmented control', () => {
  it('shows Community / Provider / Both chips when isOnDuty is true', async () => {
    render(<BrowseFeed isOnDuty providerServiceTypes={['ride']} />)
    await waitFor(() => expect(screen.getByRole('button', { name: /community/i })).toBeInTheDocument())
    expect(screen.getByRole('button', { name: /provider/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /both/i })).toBeInTheDocument()
  })

  it('defaults to Provider mode on first on-duty visit', async () => {
    render(<BrowseFeed isOnDuty providerServiceTypes={['ride']} />)
    await waitFor(() => screen.getByRole('button', { name: /provider/i }))
    // Provider mode: only ride requests shown
    expect(screen.getByText('Need a ride')).toBeInTheDocument()
    expect(screen.queryByText('Fix my sink')).toBeNull()
    expect(screen.queryByText('Borrow a drill')).toBeNull()
  })

  it('Community mode shows all requests without service type filter', async () => {
    render(<BrowseFeed isOnDuty providerServiceTypes={['ride']} />)
    await waitFor(() => screen.getByRole('button', { name: /community/i }))
    fireEvent.click(screen.getByRole('button', { name: /community/i }))
    await waitFor(() => expect(screen.getByText('Fix my sink')).toBeInTheDocument())
    expect(screen.getByText('Need a ride')).toBeInTheDocument()
    expect(screen.getByText('Borrow a drill')).toBeInTheDocument()
  })

  it('Both mode shows all requests', async () => {
    render(<BrowseFeed isOnDuty providerServiceTypes={['ride']} />)
    await waitFor(() => screen.getByRole('button', { name: /both/i }))
    fireEvent.click(screen.getByRole('button', { name: /both/i }))
    await waitFor(() => expect(screen.getByText('Fix my sink')).toBeInTheDocument())
    expect(screen.getByText('Need a ride')).toBeInTheDocument()
    expect(screen.getByText('Borrow a drill')).toBeInTheDocument()
  })
})

describe('BrowseFeed — localStorage persistence', () => {
  it('persists browseMode to localStorage on chip click', async () => {
    render(<BrowseFeed isOnDuty providerServiceTypes={['ride']} />)
    await waitFor(() => screen.getByRole('button', { name: /community/i }))
    fireEvent.click(screen.getByRole('button', { name: /community/i }))
    expect(localStorage.getItem('karmyq_browse_mode')).toBe('community')
  })

  it('restores browseMode from localStorage on mount', async () => {
    localStorage.setItem('karmyq_browse_mode', 'both')
    render(<BrowseFeed isOnDuty providerServiceTypes={['ride']} />)
    await waitFor(() => expect(screen.getByText('Fix my sink')).toBeInTheDocument())
    // Both mode — all requests visible
    expect(screen.getByText('Need a ride')).toBeInTheDocument()
    expect(screen.getByText('Borrow a drill')).toBeInTheDocument()
  })
})

describe('BrowseFeed — card accents', () => {
  it('does not show "Provider match" badge in Community mode', async () => {
    render(<BrowseFeed isOnDuty providerServiceTypes={['ride']} />)
    await waitFor(() => screen.getByRole('button', { name: /community/i }))
    fireEvent.click(screen.getByRole('button', { name: /community/i }))
    await waitFor(() => screen.getByText('Need a ride'))
    expect(screen.queryByText(/provider match/i)).toBeNull()
  })

  it('shows "Provider match" badge on matching cards in Both mode', async () => {
    render(<BrowseFeed isOnDuty providerServiceTypes={['ride']} />)
    await waitFor(() => screen.getByRole('button', { name: /both/i }))
    fireEvent.click(screen.getByRole('button', { name: /both/i }))
    await waitFor(() => screen.getByText('Need a ride'))
    expect(screen.getByText(/provider match/i)).toBeInTheDocument()
  })
})
```

- [ ] **Run tests — confirm they fail** (expected at this stage)

```bash
cd apps/frontend && npx jest tests/tdd/sprint-61-on-duty-browse.test.tsx --no-coverage 2>&1 | tail -20
```

---

## Task 3: Refactor BrowseFeed props + add browseMode state

**Files:**
- Modify: `apps/frontend/src/components/BrowseFeed.tsx`
- Modify: `apps/frontend/src/pages/dashboard.tsx`

Update both files together to avoid a type error gap.

- [ ] **Update BrowseFeed interface and state**

In `BrowseFeed.tsx`, replace the interface and add state:

```tsx
// Replace:
interface BrowseFeedProps {
  communityId?: string
  serviceTypeFilter?: string[]
  noCommunities?: boolean
}

// With:
type BrowseMode = 'community' | 'provider' | 'both'

interface BrowseFeedProps {
  communityId?: string
  isOnDuty?: boolean
  providerServiceTypes?: string[]
  noCommunities?: boolean
}
```

Add `browseMode` state after existing state declarations:

```tsx
const [browseMode, setBrowseMode] = useState<BrowseMode>(() => {
  if (typeof window === 'undefined') return 'provider'
  return (localStorage.getItem('karmyq_browse_mode') as BrowseMode) ?? 'provider'
})

const handleBrowseModeChange = (mode: BrowseMode) => {
  setBrowseMode(mode)
  localStorage.setItem('karmyq_browse_mode', mode)
}
```

- [ ] **Update dashboard.tsx — replace BrowseFeed props**

At `apps/frontend/src/pages/dashboard.tsx:472-479`, replace:

```tsx
// Remove:
<BrowseFeed
  communityId={activeCommunityId || undefined}
  serviceTypeFilter={
    hasProviderProfile && isAvailable && (providerServiceTypes?.length ?? 0) > 0
      ? providerServiceTypes
      : undefined
  }
  noCommunities={userCommunities.length === 0}
/>

// Add:
<BrowseFeed
  communityId={activeCommunityId || undefined}
  isOnDuty={hasProviderProfile && isAvailable}
  providerServiceTypes={providerServiceTypes ?? []}
  noCommunities={userCommunities.length === 0}
/>
```

- [ ] **Verify TypeScript compiles cleanly**

```bash
cd apps/frontend && npx tsc --noEmit 2>&1 | grep -E "error|warning" | head -20
```

---

## Task 4: Add segmented control UI

**Files:**
- Modify: `apps/frontend/src/components/BrowseFeed.tsx`

- [ ] **Add segmented control above FilterChipRow**

Insert the segmented control inside the `return (...)` block, above `<FilterChipRow>`:

```tsx
{isOnDuty && (
  <div className="flex gap-1 mb-3 mt-1">
    {(['community', 'provider', 'both'] as BrowseMode[]).map((mode) => (
      <button
        key={mode}
        onClick={() => handleBrowseModeChange(mode)}
        className={`flex-1 py-1.5 text-sm font-medium rounded-lg border transition-colors capitalize ${
          browseMode === mode
            ? 'bg-primary text-white border-primary'
            : 'bg-surface text-text-muted border-border hover:border-primary hover:text-text'
        }`}
      >
        {mode === 'community' ? 'Community' : mode === 'provider' ? 'Provider' : 'Both'}
      </button>
    ))}
  </div>
)}
```

- [ ] **Remove the old static label**

Delete the `serviceTypeFilter && serviceTypeFilter.length > 0` `<p>` tag block (lines ~154-158 in the original file) — the segmented control replaces it.

- [ ] **Visual check — start dev server, go to dashboard as on-duty provider**

---

## Task 5: Update filter logic

**Files:**
- Modify: `apps/frontend/src/components/BrowseFeed.tsx`

- [ ] **Replace the `serviceMatch` filter expression**

The current `filtered` derivation at lines ~98-103:

```tsx
// Remove:
const serviceMatch = !serviceTypeFilter?.length || serviceTypeFilter.includes(r.request_type ?? '')

// The full filtered block becomes:
const filtered = requests.filter((r) => {
  const typeMatch = activeType === 'all' || r.request_type === activeType
  const urgencyMatch = activeUrgency === 'all' || r.urgency === activeUrgency
  const serviceMatch =
    !isOnDuty ||
    browseMode === 'community' ||
    browseMode === 'both' ||
    (browseMode === 'provider' && (providerServiceTypes ?? []).includes(r.request_type ?? ''))
  return typeMatch && urgencyMatch && serviceMatch
})
```

- [ ] **Run TDD tests — should see more pass now**

```bash
cd apps/frontend && npx jest tests/tdd/sprint-61-on-duty-browse.test.tsx --no-coverage 2>&1 | tail -30
```

---

## Task 6: Add card color accent

**Files:**
- Modify: `apps/frontend/src/components/BrowseFeed.tsx`

- [ ] **Derive isProviderMatch per card**

Inside the `filtered.map((request) => ...)` block, derive before the `<div>`:

```tsx
const isProviderMatch =
  isOnDuty &&
  browseMode !== 'community' &&
  (providerServiceTypes ?? []).includes(request.request_type ?? '')
```

- [ ] **Apply left-border accent to the card wrapper**

Change the card `div` from:

```tsx
<div key={request.id} className="feed-card">
```

To:

```tsx
<div
  key={request.id}
  className={`feed-card ${isProviderMatch ? 'border-l-4 border-amber-400' : ''}`}
>
```

- [ ] **Add "Provider match" badge below the request title**

After `<h3 className="font-medium text-text mb-1">{request.title}</h3>`, add:

```tsx
{isProviderMatch && (
  <span className="inline-block text-xs px-2 py-0.5 rounded-full text-amber-600 bg-amber-50 mb-2">
    Provider match
  </span>
)}
```

- [ ] **Run all TDD tests — expect all 10 to pass**

```bash
cd apps/frontend && npx jest tests/tdd/sprint-61-on-duty-browse.test.tsx --no-coverage 2>&1 | tail -30
```

---

## Task 7: Update provider-mode-guide.md

**Files:**
- Modify: `docs/guides/provider-mode-guide.md`

The current guide has stale content (Member/Provider pill toggle removed in Sprint 50, stats card removed, provider notification bell removed). Update it to reflect current reality.

- [ ] **Rewrite provider-mode-guide.md**

Replace the full file content:

```markdown
# Using Provider Mode

Provider Mode is a view toggle that shifts your Karmyq dashboard to show requests relevant to your services. When you're **on-duty**, your feed highlights requests that match your service type(s) so you can act on them quickly.

You remain in the same community — nothing about your membership, karma, or trust changes. Provider Mode is a lens.

## Going On-Duty

Look for the **availability toggle** in the top navigation bar. When toggled on, you're on-duty and your browse feed switches to Provider mode automatically.

Your mode choice is saved in your browser and persists across page loads.

## Feed Modes (On-Duty Only)

When you're on-duty, three chips appear above your browse feed:

| Mode | What you see |
|---|---|
| **Community** | Full community feed — all open requests, no filter |
| **Provider** | Only requests matching your service type(s) (default when you go on-duty) |
| **Both** | All requests, with provider-match requests highlighted in amber |

Your last-used mode is remembered for next time you go on-duty.

## Reading the Card Accents

In **Provider** and **Both** modes, requests that match your service types show:
- An **amber left border** on the card
- A **"Provider match"** label below the request title

Community requests (not matching your service types) show no accent.

## What Changes in Provider Mode

- **Browse feed**: Filtered to your service types by default. Use the mode chips to adjust.
- **Availability toggle**: Shows in the nav so you can go off-duty at any time.

## What Stays the Same in Provider Mode

- **Communities tab**: Your community memberships, norms, and activity are unaffected.
- **Helping tab**: Active commitments are always visible.
- **Profile and karma**: Your karma score, trust tier, and profile are not affected.

## Unlocking Provider Mode

Provider Mode is only available to users with at least one provider profile. If you haven't created one yet, you'll see a **Become a Provider** link in the nav instead of the availability toggle.
```

- [ ] **Regenerate landing docs**

```bash
cd apps/landing && npm run generate-docs
```

---

## Task 8: CONTEXT.md + registry.json check

**Files:**
- No backend changes in this sprint — no service CONTEXT.md or registry.json updates needed.

- [ ] **Verify feedback check passes**

```bash
npm run feedback:check
```

If `feedback:check` flags anything related to the frontend change, address it. No backend docs to update.

---

## Task 9: Final type check + pre-push verification

**Files:**
- No new files — verification only.

- [ ] **TypeScript clean compile**

```bash
cd apps/frontend && npx tsc --noEmit 2>&1 | grep "error TS" | head -20
```

- [ ] **Run all unit + regression tests**

```bash
npm test 2>&1 | tail -30
```

- [ ] **Run TDD tests**

```bash
cd apps/frontend && npx jest tests/tdd/sprint-61-on-duty-browse.test.tsx --no-coverage 2>&1 | tail -20
```

- [ ] **Manual smoke test** — open dashboard as a provider, toggle on-duty, verify:
  - Segmented control appears with Community / Provider / Both chips
  - Provider mode (default) shows only matching requests
  - Switching to Both shows all requests with amber accents on matching cards
  - Switching to Community shows all requests, no accents
  - Refreshing the page restores the last-used mode
  - Going off-duty hides the segmented control

- [ ] **Version bump**: update `package.json` at root from `9.27.0` → `9.28.0`

---

## Task 10: Merge + Deploy

Use the `/deploy` skill.

- [ ] **Commit all changes**

```bash
git add apps/frontend/src/components/BrowseFeed.tsx
git add apps/frontend/src/pages/dashboard.tsx
git add apps/frontend/tests/tdd/sprint-61-on-duty-browse.test.tsx
git add docs/guides/provider-mode-guide.md
git add apps/landing/src/data/docs/
git add package.json
git commit -m "feat(sprint-61): on-duty browse segmented control + card accents"
```

- [ ] **Merge to master and push**

```bash
git checkout master && git merge feature/sprint-61-on-duty-browse && git push origin master
```

- [ ] **Monitor GitHub Actions deploy**

```bash
gh run list --branch master --limit 3
```

- [ ] **Smoke-test on karmyq.com** — verify on-duty browse control works in production.
