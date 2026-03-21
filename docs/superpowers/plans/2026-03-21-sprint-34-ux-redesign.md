# Sprint 34: UX Redesign — Navigation & Feed Foundation

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development`
> (recommended) or `superpowers:executing-plans` to implement this plan task-by-task.

**Goal:** Replace the 3-column dashboard with a tab-based layout that puts the 5 core user flows (Browse, Commit, Request, Offer, Profile) front and center with minimal cognitive load.

**Architecture:** New `TabBar` component drives the dashboard shell. `Layout.tsx` loses both sidebars. Four focused tab components (`BrowseFeed`, `CommitmentsTab`, `MyRequestsTab`, Profile tab) own their own data fetching. No backend changes required.

**Tech Stack:** Node.js/Express/TypeScript, Next.js 14, PostgreSQL 15, Bull queue.

---

## File Map

### New files to create

| File | Responsibility |
|------|---------------|
| `apps/frontend/src/components/TabBar.tsx` | Horizontal tabs (desktop) + sticky bottom bar (mobile) |
| `apps/frontend/src/components/BrowseFeed.tsx` | Single-column feed of community requests user can help with |
| `apps/frontend/src/components/CommitmentsTab.tsx` | "I'm Helping" + "I Asked For Help" two-section view |
| `apps/frontend/src/components/MyRequestsTab.tsx` | My posted requests + offer acceptance |
| `apps/frontend/src/components/FilterChipRow.tsx` | Horizontal category/urgency filter chips (replaces hidden FeedFilterPanel) |

### Existing files to modify

| File | Change |
|------|--------|
| `apps/frontend/src/components/Layout.tsx` | Remove LeftSidebar + RightSidebar; add TabBar slot only on dashboard route |
| `apps/frontend/src/pages/dashboard.tsx` | Becomes tab shell — delegates to BrowseFeed / CommitmentsTab / MyRequestsTab |
| `apps/frontend/src/styles/globals.css` | Add `.tab-bar`, `.bottom-nav`, `.fab`, `.status-badge--*`, `.filter-chip` classes |
| `apps/landing/src/data/docs/guides/getting-started-guide.json` | Replace dashboard-centric walkthrough with tab-based navigation |
| `apps/landing/src/data/docs/guides/making-requests-guide.json` | Reference "My Requests" tab instead of dashboard text area |
| `apps/landing/src/scripts/generate-docs.ts` | Add new `ux-design-principles` concept page entry |
| `apps/frontend/CONTEXT.md` | Update "Layout" and "Navigation" sections |

---

## ⚠️ Critical Implementation Notes (read before Task 2)

1. **Dashboard becomes a tab shell.** `dashboard.tsx` renders the active tab component based on `activeTab` state. Tab components own their own data fetching — do NOT pass data down from dashboard.

2. **LeftSidebar and RightSidebar are NOT deleted** — just removed from dashboard/Layout imports. Check for other usages before removing any import.

3. **Bottom tab bar must sit above the FAB.** FAB is `fixed bottom-24 right-6`. Bottom nav is `fixed bottom-0 h-16`. Update FAB offset if bottom-nav height changes.

4. **Community selector moves from LeftSidebar to top bar.** Lift `selectedCommunity` state to `dashboard.tsx` and pass as prop to `BrowseFeed`.

5. **FilterChipRow does NOT duplicate FeedFilterPanel logic** — reuse existing filter state, expose as chips. Start with type + urgency chips only.

6. **CommitmentsTab fetches its own matches independently.** Do not pass match data from dashboard.

7. **The FAB opens the EXISTING request form** — do not simplify the form in this sprint. Sprint 35 owns that.

8. **`generate-docs.ts` is source of truth for nav.json.** Never edit nav.json directly. Force-add: `git add -f apps/landing/src/data/docs/...`

9. **Max-width on content**: `max-w-2xl mx-auto` (672px) for all tab content areas.

10. **Single responsive breakpoint**: `md:` (768px) — below = bottom tab bar, above = horizontal tab bar.

---

## Task 1: Feature Branch

**Files:**
- No file changes — branch setup only

- [ ] **Create the sprint branch**

```bash
git checkout master
git checkout -b feature/sprint-34-ux-redesign
```

- [ ] **Verify clean state**

```bash
git status
# Confirm you're on feature/sprint-34-ux-redesign
```

---

## Task 2: CSS Foundation — Tab Bar, FAB, Status Badges, Filter Chips

**Files:**
- Modify: `apps/frontend/src/styles/globals.css`

- [ ] **Add new `@layer components` classes after the existing `.section-heading` block:**

```css
/* ── Tab Bar (desktop horizontal tabs) ── */
.tab-bar {
  @apply flex border-b border-border bg-surface-raised;
}
.tab-bar-item {
  @apply px-5 py-3 text-sm font-medium text-text-muted border-b-2 border-transparent
         hover:text-text hover:border-border transition-all cursor-pointer whitespace-nowrap;
}
.tab-bar-item.active {
  @apply text-primary border-primary;
}

/* ── Bottom Nav (mobile sticky footer) ── */
.bottom-nav {
  @apply fixed bottom-0 left-0 right-0 z-50 flex bg-surface-raised border-t border-border
         md:hidden;
}
.bottom-nav-item {
  @apply flex-1 flex flex-col items-center justify-center py-2 gap-0.5 text-xs
         font-medium text-text-muted transition-colors;
}
.bottom-nav-item.active {
  @apply text-primary;
}
.bottom-nav-item svg {
  @apply w-5 h-5;
}

/* ── FAB (Floating Action Button) ── */
.fab {
  @apply fixed bottom-24 right-6 z-40 btn-primary shadow-lg rounded-full
         px-5 py-3 flex items-center gap-2 text-sm font-semibold
         md:bottom-8;
}

/* ── Status Badges (commitment state) ── */
.status-badge {
  @apply inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium;
}
.status-badge--proposed {
  @apply bg-gray-100 text-gray-600;
}
.status-badge--matched {
  @apply bg-blue-50 text-blue-700;
}
.status-badge--in-progress {
  @apply bg-amber-50 text-amber-700;
}
.status-badge--pending-confirmation {
  @apply bg-green-50 text-green-700;
}
.status-badge--completed {
  @apply bg-gray-50 text-gray-500;
}

/* ── Filter Chips ── */
.filter-chip {
  @apply px-3 py-1.5 rounded-full text-sm font-medium border border-border
         bg-surface text-text-muted hover:bg-surface-raised transition-colors
         cursor-pointer whitespace-nowrap;
}
.filter-chip.active {
  @apply bg-primary text-white border-primary;
}

/* ── Feed Card (extends .card) ── */
.feed-card {
  @apply card p-4 hover:shadow-md transition-shadow cursor-pointer;
}
```

- [ ] **Verify no Tailwind errors**

```bash
cd apps/frontend && npx tailwindcss --content "src/**/*.{tsx,ts}" --output /dev/null 2>&1 | head -20
```

---

## Task 3: TabBar Component

**Files:**
- Create: `apps/frontend/src/components/TabBar.tsx`

- [ ] **Create the TabBar component:**

```tsx
import React from 'react'
import Link from 'next/link'

export type TabId = 'browse' | 'commitments' | 'my-requests' | 'profile'

interface Tab {
  id: TabId
  label: string
  mobileLabel: string
  icon: React.ReactNode
}

const BrowseIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
  </svg>
)
const CommitmentsIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
)
const RequestsIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /><polyline points="10 9 9 9 8 9" />
  </svg>
)
const ProfileIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
  </svg>
)

const TABS: Tab[] = [
  { id: 'browse', label: 'Browse', mobileLabel: 'Browse', icon: <BrowseIcon /> },
  { id: 'commitments', label: 'Commitments', mobileLabel: 'Commits', icon: <CommitmentsIcon /> },
  { id: 'my-requests', label: 'My Requests', mobileLabel: 'Requests', icon: <RequestsIcon /> },
  { id: 'profile', label: 'Profile', mobileLabel: 'Profile', icon: <ProfileIcon /> },
]

interface TabBarProps {
  activeTab: TabId
  onChange: (tab: TabId) => void
  commitmentCount?: number
}

export default function TabBar({ activeTab, onChange, commitmentCount }: TabBarProps) {
  return (
    <>
      {/* Desktop horizontal tabs */}
      <div className="tab-bar hidden md:flex" role="tablist">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            role="tab"
            aria-selected={activeTab === tab.id}
            onClick={() => onChange(tab.id)}
            className={`tab-bar-item ${activeTab === tab.id ? 'active' : ''}`}
          >
            {tab.label}
            {tab.id === 'commitments' && commitmentCount != null && commitmentCount > 0 && (
              <span className="ml-1.5 inline-flex items-center justify-center w-4 h-4 rounded-full bg-primary text-white text-xs">
                {commitmentCount > 9 ? '9+' : commitmentCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Mobile bottom nav */}
      <nav className="bottom-nav" role="navigation" aria-label="Main navigation">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onChange(tab.id)}
            className={`bottom-nav-item ${activeTab === tab.id ? 'active' : ''}`}
            aria-label={tab.label}
          >
            {tab.icon}
            <span>
              {tab.mobileLabel}
              {tab.id === 'commitments' && commitmentCount != null && commitmentCount > 0 && (
                <span className="ml-0.5 text-primary font-bold">·</span>
              )}
            </span>
          </button>
        ))}
      </nav>
    </>
  )
}
```

- [ ] **Verify TypeScript compilation**

```bash
cd apps/frontend && npx tsc --noEmit 2>&1 | grep TabBar
```

---

## Task 4: FilterChipRow Component

**Files:**
- Create: `apps/frontend/src/components/FilterChipRow.tsx`

- [ ] **Create the FilterChipRow component:**

```tsx
import React from 'react'

export type RequestTypeFilter = 'all' | 'generic' | 'ride' | 'service' | 'event' | 'borrow'
export type UrgencyFilter = 'all' | 'urgent' | 'high' | 'medium' | 'low'

interface FilterChipRowProps {
  activeType: RequestTypeFilter
  activeUrgency: UrgencyFilter
  onTypeChange: (type: RequestTypeFilter) => void
  onUrgencyChange: (urgency: UrgencyFilter) => void
}

const TYPE_CHIPS: { value: RequestTypeFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'ride', label: '🚗 Rides' },
  { value: 'service', label: '🔧 Services' },
  { value: 'borrow', label: '📦 Borrow' },
  { value: 'event', label: '📅 Events' },
  { value: 'generic', label: 'General' },
]

const URGENCY_CHIPS: { value: UrgencyFilter; label: string }[] = [
  { value: 'all', label: 'Any urgency' },
  { value: 'urgent', label: '🔴 Urgent' },
  { value: 'high', label: '🟠 High' },
  { value: 'medium', label: '🟡 Medium' },
]

export default function FilterChipRow({ activeType, activeUrgency, onTypeChange, onUrgencyChange }: FilterChipRowProps) {
  return (
    <div className="flex flex-col gap-2 py-3">
      {/* Type filters */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
        {TYPE_CHIPS.map((chip) => (
          <button
            key={chip.value}
            onClick={() => onTypeChange(chip.value)}
            className={`filter-chip ${activeType === chip.value ? 'active' : ''}`}
          >
            {chip.label}
          </button>
        ))}
      </div>
      {/* Urgency filters — only show when a specific type is selected or urgency is active */}
      {(activeUrgency !== 'all' || activeType !== 'all') && (
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
          {URGENCY_CHIPS.map((chip) => (
            <button
              key={chip.value}
              onClick={() => onUrgencyChange(chip.value)}
              className={`filter-chip ${activeUrgency === chip.value ? 'active' : ''}`}
            >
              {chip.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
```

---

## Task 5: BrowseFeed Component

**Files:**
- Create: `apps/frontend/src/components/BrowseFeed.tsx`

- [ ] **Create BrowseFeed — extracts the community request feed from dashboard.tsx:**

The component should:
- Accept `communityId?: string` prop (from top-bar community selector)
- Call `feedApi.getCuratedFeed()` or `requestService.getRequests()` on mount
- Filter results to show ONLY open requests from other users (not user's own)
- Render `FilterChipRow` at the top
- Render cards with: requester name + trust badge, title, type chip, urgency indicator, "Offer to Help" CTA
- Handle loading, error, and empty states using `EmptyState` component
- Show match score as a subtle badge when available (e.g. `92% match`)

Key structure:
```tsx
import dynamic from 'next/dynamic'
import FilterChipRow, { RequestTypeFilter, UrgencyFilter } from './FilterChipRow'
import EmptyState from './EmptyState'
import TrustPathBadge from './TrustPathBadge'
// ... existing request/feed API imports

export default function BrowseFeed({ communityId }: { communityId?: string }) {
  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeType, setActiveType] = useState<RequestTypeFilter>('all')
  const [activeUrgency, setActiveUrgency] = useState<UrgencyFilter>('all')

  useEffect(() => {
    // fetch requests, filter to open + not own
  }, [communityId])

  // filter requests by activeType + activeUrgency
  const filtered = requests.filter(r => {
    const typeMatch = activeType === 'all' || r.request_type === activeType
    const urgencyMatch = activeUrgency === 'all' || r.urgency === activeUrgency
    return typeMatch && urgencyMatch
  })

  return (
    <div className="max-w-2xl mx-auto px-4 py-4">
      <FilterChipRow
        activeType={activeType}
        activeUrgency={activeUrgency}
        onTypeChange={setActiveType}
        onUrgencyChange={setActiveUrgency}
      />
      {loading ? <LoadingSkeleton /> : filtered.length === 0
        ? <EmptyState title="No open requests" description="Check back soon or post your own." />
        : filtered.map(r => <RequestCard key={r.id} request={r} onOfferHelp={handleOffer} />)
      }
    </div>
  )
}
```

> Pull the `RequestCard` rendering logic and `handleOffer` from the existing dashboard.tsx feed — do not rewrite from scratch, extract it.

- [ ] **Verify: BrowseFeed renders without console errors on dashboard visit**

---

## Task 6: CommitmentsTab Component

**Files:**
- Create: `apps/frontend/src/components/CommitmentsTab.tsx`

- [ ] **Create CommitmentsTab — dedicated view for active matches:**

```tsx
// Fetches matches independently (do NOT receive as props from dashboard)
// Two sections: "I'm Helping" and "I Asked For Help"
// Each item shows: title, other party name, status badge, primary CTA

import { useEffect, useState } from 'react'
import EmptyState from './EmptyState'

const STATUS_LABELS: Record<string, string> = {
  proposed: 'Pending',
  matched: 'Accepted',
  completed: 'Done',
}

function StatusBadge({ status }: { status: string }) {
  const cls = `status-badge status-badge--${status.replace('_', '-')}`
  return <span className={cls}>{STATUS_LABELS[status] ?? status}</span>
}

export default function CommitmentsTab() {
  const [helping, setHelping] = useState([])   // matches where I'm the helper
  const [requested, setRequested] = useState([]) // matches where I'm the requester
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // call requestService.getMatches() or equivalent
    // split results: helping = where currentUser is the offer creator
    //                requested = where currentUser is the request creator
  }, [])

  if (loading) return <div className="max-w-2xl mx-auto px-4 py-8 text-center text-text-muted">Loading...</div>

  return (
    <div className="max-w-2xl mx-auto px-4 py-4 space-y-8">
      {/* I'm Helping */}
      <section>
        <h2 className="section-heading mb-3">I'm Helping</h2>
        {helping.length === 0
          ? <EmptyState title="No active commitments" description="Browse requests to find someone to help." />
          : helping.map(m => (
              <div key={m.id} className="card p-4 mb-3 flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-text truncate">{m.request_title}</p>
                  <p className="text-sm text-text-muted mt-0.5">For {m.requester_name}</p>
                </div>
                <div className="flex flex-col items-end gap-2 shrink-0">
                  <StatusBadge status={m.status} />
                  {m.status === 'matched' && (
                    <button className="btn-primary text-sm py-1 px-3" onClick={() => handleMarkDone(m.id)}>
                      Mark Done
                    </button>
                  )}
                </div>
              </div>
            ))
        }
      </section>

      {/* I Asked For Help */}
      <section>
        <h2 className="section-heading mb-3">I Asked For Help</h2>
        {requested.length === 0
          ? <EmptyState title="No matched requests" description="Post a request and accept an offer to see it here." />
          : requested.map(m => (
              <div key={m.id} className="card p-4 mb-3 flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-text truncate">{m.request_title}</p>
                  <p className="text-sm text-text-muted mt-0.5">Helper: {m.helper_name}</p>
                </div>
                <div className="flex flex-col items-end gap-2 shrink-0">
                  <StatusBadge status={m.status} />
                  {m.status === 'pending-confirmation' && (
                    <button className="btn-primary text-sm py-1 px-3" onClick={() => handleConfirmDone(m.id)}>
                      Confirm Done
                    </button>
                  )}
                </div>
              </div>
            ))
        }
      </section>
    </div>
  )
}
```

---

## Task 7: MyRequestsTab Component

**Files:**
- Create: `apps/frontend/src/components/MyRequestsTab.tsx`

- [ ] **Create MyRequestsTab — user's posted requests + offer management:**

```tsx
// Shows requests the current user posted
// Each expandable to show offers with Accept/Decline CTAs
// "New Request" button at top (opens existing request form modal)

import { useEffect, useState } from 'react'
import EmptyState from './EmptyState'

export default function MyRequestsTab({ onNewRequest }: { onNewRequest: () => void }) {
  const [requests, setRequests] = useState([])
  const [expanded, setExpanded] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // requestService.getMyRequests() — or filter getRequests() by currentUser
  }, [])

  return (
    <div className="max-w-2xl mx-auto px-4 py-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="section-heading">My Requests</h2>
        <button className="btn-primary text-sm" onClick={onNewRequest}>+ New Request</button>
      </div>

      {loading
        ? null
        : requests.length === 0
          ? <EmptyState
              title="No requests yet"
              description="Ask your community for help — they're here for you."
              action={<button className="btn-primary mt-3" onClick={onNewRequest}>Post a Request</button>}
            />
          : requests.map(r => (
              <div key={r.id} className="card mb-3">
                <div
                  className="p-4 flex items-center justify-between cursor-pointer"
                  onClick={() => setExpanded(expanded === r.id ? null : r.id)}
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-text">{r.title}</p>
                    <p className="text-sm text-text-muted mt-0.5 capitalize">{r.status}</p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    {r.offer_count > 0 && (
                      <span className="text-sm text-primary font-medium">{r.offer_count} offer{r.offer_count !== 1 ? 's' : ''}</span>
                    )}
                    <svg className={`w-4 h-4 text-text-muted transition-transform ${expanded === r.id ? 'rotate-180' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                  </div>
                </div>

                {expanded === r.id && (
                  <div className="border-t border-border px-4 pb-4 pt-3 space-y-3">
                    {r.offers?.length === 0
                      ? <p className="text-sm text-text-muted">No offers yet.</p>
                      : r.offers?.map((offer: any) => (
                          <div key={offer.id} className="flex items-center justify-between">
                            <span className="text-sm text-text">{offer.helper_name}</span>
                            {r.status === 'open' && (
                              <div className="flex gap-2">
                                <button className="btn-primary text-sm py-1 px-3" onClick={() => handleAccept(offer.id, r.id)}>Accept</button>
                                <button className="btn-ghost text-sm py-1 px-3" onClick={() => handleDecline(offer.id)}>Decline</button>
                              </div>
                            )}
                          </div>
                        ))
                    }
                  </div>
                )}
              </div>
            ))
      }
    </div>
  )
}
```

---

## Task 8: Redesign Dashboard as Tab Shell + Update Layout

**Files:**
- Modify: `apps/frontend/src/pages/dashboard.tsx`
- Modify: `apps/frontend/src/components/Layout.tsx`

- [ ] **Update Layout.tsx — slim the top nav:**

Remove the three horizontal nav links (Dashboard, Communities, Service Providers) from the desktop nav. Keep: Logo, NotificationBell, User menu. Add a secondary hamburger drawer for Communities + Providers on mobile. The tab bar renders on the dashboard page itself (not in Layout), so Layout stays lean.

```tsx
// In Layout.tsx nav, replace the three <Link> items with just Logo + right side:
// Logo | [spacer] | NotificationBell | Avatar | Logout
// On mobile: Logo | [spacer] | NotificationBell | ☰ (hamburger for Communities/Providers/Settings)
```

- [ ] **Redesign dashboard.tsx as a tab shell:**

The dashboard page becomes:
1. A community selector dropdown in the top area (lifted from LeftSidebar)
2. A `TabBar` with `activeTab` state
3. A switch that renders the correct tab component
4. A `FAB` button on Browse + Commitments tabs
5. The existing `WelcomeModal` still renders on first visit
6. The existing request creation form (EnhancedAutocomplete) renders in a modal or expanded section triggered by FAB / "New Request"

```tsx
// Rough shell structure:
export default function Dashboard() {
  const [activeTab, setActiveTab] = useState<TabId>('browse')
  const [selectedCommunity, setSelectedCommunity] = useState<string>('all')
  const [showRequestForm, setShowRequestForm] = useState(false)
  const [commitmentCount, setCommitmentCount] = useState(0)
  // ... existing auth check

  return (
    <Layout>
      <WelcomeModal />

      {/* Community selector row */}
      <div className="bg-surface-raised border-b border-border px-4 py-2">
        <CommunitySelector value={selectedCommunity} onChange={setSelectedCommunity} />
      </div>

      {/* Desktop tab bar */}
      <TabBar activeTab={activeTab} onChange={setActiveTab} commitmentCount={commitmentCount} />

      {/* Tab content */}
      <div className="pb-16 md:pb-0"> {/* bottom padding for mobile nav */}
        {activeTab === 'browse' && <BrowseFeed communityId={selectedCommunity} />}
        {activeTab === 'commitments' && <CommitmentsTab />}
        {activeTab === 'my-requests' && <MyRequestsTab onNewRequest={() => setShowRequestForm(true)} />}
        {activeTab === 'profile' && <ProfileTab />}
      </div>

      {/* FAB — only on browse and commitments */}
      {(activeTab === 'browse' || activeTab === 'commitments') && (
        <button className="fab" onClick={() => setShowRequestForm(true)}>
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Get Help
        </button>
      )}

      {/* Request form (existing form, shown in modal/expanded when showRequestForm) */}
      {showRequestForm && <RequestFormModal onClose={() => setShowRequestForm(false)} />}
    </Layout>
  )
}
```

> The `ProfileTab` inline component can be a simple extract of the karma/communities/settings info currently in LeftSidebar + profile.tsx overview. A full Profile page rewrite is Sprint 35.

- [ ] **Remove LeftSidebar and RightSidebar imports from dashboard.tsx**

- [ ] **Verify: Navigating to /dashboard shows tabs, no sidebars, and FAB is visible**

```bash
# Manual check: npm run dev, navigate to /dashboard
# Confirm: TabBar renders, Browse tab is default, FAB is visible bottom-right
```

---

## Task 9: TDD Tests

**Files:**
- Create: `tests/tdd/tab-navigation.test.ts`
- Create: `tests/tdd/browse-feed.test.ts`
- Create: `tests/tdd/commitments-tab.test.ts`

- [ ] **Write tests BEFORE finalizing tab component implementations (TDD):**

**tab-navigation.test.ts** — test tab switching behavior:
```typescript
describe('TabBar', () => {
  it('renders 4 tabs', () => { ... })
  it('marks active tab correctly', () => { ... })
  it('calls onChange when tab clicked', () => { ... })
  it('shows commitment count badge when count > 0', () => { ... })
  it('does not show badge when count is 0', () => { ... })
})
```

**browse-feed.test.ts** — test feed filtering:
```typescript
describe('BrowseFeed filter behavior', () => {
  it('shows all requests when type is "all"', () => { ... })
  it('filters to ride requests when type is "ride"', () => { ... })
  it('filters by urgency', () => { ... })
  it('shows empty state when no requests match filter', () => { ... })
  it('does not show current user\'s own requests', () => { ... })
})
```

**commitments-tab.test.ts** — test commitment display:
```typescript
describe('CommitmentsTab', () => {
  it('renders "I\'m Helping" section', () => { ... })
  it('renders "I Asked For Help" section', () => { ... })
  it('shows correct status badge per match status', () => { ... })
  it('shows "Mark Done" button only for matched status', () => { ... })
  it('shows empty states when no commitments', () => { ... })
})
```

- [ ] **Run TDD tests**

```bash
npm run test:tdd 2>&1 | grep -E "(PASS|FAIL|tab-navigation|browse-feed|commitments)"
```

---

## Task 10: User Guides + Landing Page Docs

**Files:**
- Modify: `apps/landing/src/data/docs/guides/getting-started-guide.json`
- Modify: `apps/landing/src/data/docs/guides/making-requests-guide.json`
- Modify: `apps/landing/src/scripts/generate-docs.ts` (to add new concept page)
- Run: `npm run generate-docs` to regenerate nav.json

- [ ] **Update getting-started-guide.json** — replace step 3 ("Explore the Dashboard") with tab-oriented walkthrough:

Replace the section that describes left sidebar / feed / right sidebar with:
```
After logging in, you'll see four tabs at the top (or bottom on mobile):

- **Browse** — See requests from your community that you can help with
- **Commitments** — Track everything you've agreed to do (and everything you're waiting on)
- **My Requests** — Manage the help you've asked for and incoming offers
- **Profile** — Your karma, trust score, and settings

Use the **community selector** at the top to filter by a specific community, or leave it as "All" to see everything.
```

- [ ] **Update making-requests-guide.json** — replace "From the dashboard text area" with "From My Requests tab":

```
To ask for help:
1. Go to the **My Requests** tab (or tap the **+ Get Help** button from anywhere)
2. Click **New Request** at the top of the page
3. Describe what you need — the system will help you fill in the details
4. Choose who can see your request (all communities, or a specific one)
5. Submit — offers from community members will appear in your request detail
```

- [ ] **Add ux-design-principles concept page to generate-docs.ts:**

Create the JSON content and add to the generator. Content should explain:
- The 5 core flows and why they're front and center
- One screen, one job principle
- Why commitments are a first-class concept (not a feed section)
- How the platform reduces cognitive load

- [ ] **Regenerate docs + force-add**

```bash
cd apps/landing && npm run generate-docs
git add -f apps/landing/src/data/docs/
```

---

## Task 11: CONTEXT.md + Feedback Loop Check

**Files:**
- Modify: `apps/frontend/CONTEXT.md`

- [ ] **Update apps/frontend/CONTEXT.md:**

Update the "Layout" section to document:
- New tab-based architecture (Browse / Commitments / My Requests / Profile)
- TabBar component — horizontal desktop, bottom-nav mobile
- FAB presence on Browse + Commitments tabs
- dashboard.tsx is now a tab shell (no longer owns feed logic)
- LeftSidebar + RightSidebar retained in codebase but not used in dashboard

Update the "Navigation" section to document:
- Top bar: Logo + Community selector + Bell + Avatar
- Secondary nav (Communities, Providers, Settings) accessible via hamburger on mobile or direct links
- `md:` breakpoint (768px) is the single responsive breakpoint for this layout

- [ ] **Run feedback loop check**

```bash
cd /c/Users/ravic/development/karmyq && npm run feedback:check
```

---

## Task 12: Final Verification

**Files:**
- No changes — verification only

- [ ] **TypeScript check — zero new errors**

```bash
cd apps/frontend && npx tsc --noEmit 2>&1 | tail -10
```

- [ ] **Unit + regression tests pass**

```bash
npm test 2>&1 | tail -15
```

- [ ] **TDD tests pass**

```bash
npm run test:tdd 2>&1 | tail -15
```

- [ ] **Feedback loop clean**

```bash
npm run feedback:check
```

- [ ] **Visual smoke check** — start dev server and verify:
  - `/dashboard` → 4 tabs render, no sidebars
  - Browse tab → request cards with filter chips at top
  - Commitments tab → "I'm Helping" + "I Asked For Help" sections
  - My Requests tab → my requests list + "New Request" button
  - FAB visible on Browse + Commitments, absent on My Requests + Profile
  - Mobile viewport (< 768px) → bottom tab bar visible

```bash
cd apps/frontend && npm run dev
# Open http://localhost:3000/dashboard
```

- [ ] **Bump version to 9.9.0**

```bash
cd /c/Users/ravic/development/karmyq
npm version 9.9.0 --no-git-tag-version
```

- [ ] **Commit**

```bash
git add -A
git commit -m "feat(ux): Sprint 34 — UX Redesign Navigation & Feed Foundation v9.9.0"
```
