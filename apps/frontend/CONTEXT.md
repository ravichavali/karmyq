# Frontend CONTEXT.md

**Last updated**: 2026-03-21 (Sprint 34)

## Overview

Next.js 14 web application (Pages Router) consuming all Karmyq backend services.

---

## New Components (Sprint 34)

### `TabBar.tsx`
**Path**: `src/components/TabBar.tsx`
Tab navigation component. Renders horizontal tab bar on desktop (`md:`) and sticky bottom nav on mobile.

- **Desktop**: `div.tab-bar.hidden.md:flex` — horizontal tabs below top nav
- **Mobile**: `nav.bottom-nav` — fixed to `bottom-0`, hidden at `md:` breakpoint
- Props: `activeTab: TabId`, `onChange: (tab: TabId) => void`, `commitmentCount?: number`
- `TabId` = `'browse' | 'commitments' | 'my-requests' | 'profile'`
- Shows commitment count dot/badge on Commitments tab when `commitmentCount > 0`

### `BrowseFeed.tsx`
**Path**: `src/components/BrowseFeed.tsx`
Single-column feed of open community requests the current user can help with.

- Fetches via `requestService.getCuratedRequests()` — filters to `status === 'open'` and `requester_id !== currentUser`
- Props: `communityId?: string` — passed from community selector in dashboard
- Renders `FilterChipRow` at top; uses `EmptyState` for empty/error states
- Shows match score badge when `match_score` is available

### `FilterChipRow.tsx`
**Path**: `src/components/FilterChipRow.tsx`
Horizontal chip row for type + urgency filtering. Urgency row only shows when a type filter is active or urgency is not "all".

### `CommitmentsTab.tsx`
**Path**: `src/components/CommitmentsTab.tsx`
Two-section view: "I'm Helping" (matches where I'm the responder) and "I Asked For Help" (matches on my own requests). Fetches independently via `requestService.getMatches()`.

### `MyRequestsTab.tsx`
**Path**: `src/components/MyRequestsTab.tsx`
My posted requests with expandable offer management. Calls `requestService.getRequests({ requester_id })` + `requestService.getMatches()`.

---

## New Components (Sprint 33)

### `EmptyState.tsx`
**Path**: `src/components/EmptyState.tsx`
Reusable empty-state block. Used on: Dashboard, Communities list, Requests list, Offers list.

Props: `icon?` (emoji), `heading`, `body`, `ctaLabel?`, `ctaHref?`, `ctaOnClick?`

**Usage guard**: Only render when `!loading && items.length === 0` to prevent flash during initial load.

### `WelcomeModal.tsx`
**Path**: `src/components/WelcomeModal.tsx`
3-step first-time onboarding modal. Controlled by `karmyq_onboarded` localStorage key.

- Hydration-safe: `visible` initialises `false`; set `true` only inside `useEffect` after checking localStorage
- On close/done: writes `karmyq_onboarded = '1'` to localStorage
- Rendered inside `dashboard.tsx` `<Layout>`, above the main grid

---

## Patterns

### `next/dynamic` + `ssr: false`
Used for components that reference browser APIs (`window`, `canvas`, `document`). Omitting `ssr: false` crashes the dev server during SSR.

| Component | File |
|---|---|
| `NetworkGraph` | `profile.tsx` |
| `CommunityConfigEditor` | `communities/new.tsx`, `communities/[id].tsx` |
| `SchemaCanvas` | `admin/schemas/[id]/edit.tsx` |

### `karmyq_onboarded` localStorage flag
Absence of this key triggers the `WelcomeModal`. Set to `'1'` on first close. Checked in `useEffect` (never at render time).

### Canonical CSS classes (`globals.css @layer components`)
Sprint 33 added canonical utility classes. Use these instead of raw Tailwind on buttons, inputs, and cards:

| Class | Usage |
|---|---|
| `.btn-primary` | Primary action buttons |
| `.btn-secondary` | Secondary / outline buttons |
| `.btn-ghost` | Text-style buttons |
| `.btn-danger` | Destructive actions |
| `.card` | Container cards |
| `.input` | Form inputs |
| `.section-heading` | Section headings within pages |
| `.tab-bar` + `.tab-bar-item` | Desktop horizontal tab bar |
| `.bottom-nav` + `.bottom-nav-item` | Mobile sticky bottom nav |
| `.fab` | Floating action button |
| `.status-badge` + `.status-badge--{state}` | Commitment status chips |
| `.filter-chip` | Horizontal filter chips |
| `.feed-card` | Feed request cards (extends `.card`) |

---

## Evolution Toggle (Sprint 33 move)

The Trust Evolution toggle was removed from `reputation/trust.tsx` and moved to `profile.tsx` (bottom section, "Trust Evolution Settings").

- `trust.tsx` now shows a plain link: "Manage trust evolution settings on your Profile page."
- `profile.tsx` reads communities from the localStorage JWT (no extra API call): `JSON.parse(localStorage.getItem('user') || '{}')?.communities ?? []`

---

## Layout & Navigation (Sprint 34)

### Tab-Based Dashboard Architecture
`dashboard.tsx` is now a tab shell — it does NOT own feed logic. The active tab drives which component renders.

```
dashboard.tsx
├── Community selector (top bar, filters BrowseFeed)
├── TabBar (Browse | Commitments | My Requests | Profile)
├── Tab content area
│   ├── <BrowseFeed communityId={activeCommunityId} />
│   ├── <CommitmentsTab />
│   ├── <MyRequestsTab onNewRequest={...} />
│   └── <Profile stub → /profile link>
└── FAB ("Get Help") — visible on Browse + Commitments only
```

### Single Responsive Breakpoint
`md:` (768px) is the only breakpoint for layout:
- Below `md:`: bottom tab bar, stacked layout
- At/above `md:`: horizontal tab bar, no bottom nav

### Content Max-Width
All tab content areas use `max-w-2xl mx-auto` (672px).

### FAB Positioning
```css
.fab { @apply fixed bottom-24 right-6 md:bottom-8; }
```
`bottom-24` clears the bottom nav (h-16) on mobile. On desktop (`md:`), drops to `bottom-8`.

### Layout.tsx Changes (Sprint 34)
Top nav simplified:
- **Desktop**: Logo | Communities | Providers | [Bell] | [Avatar] | [Logout]
- **Mobile**: Logo | [Bell] | [Avatar] | [☰ hamburger → Communities, Providers, Profile]
- Dashboard / main nav links removed — tabs replace them on the dashboard page
- `LeftSidebar` and `RightSidebar` kept in codebase but NOT rendered in `dashboard.tsx` (available for other pages if needed)

---

## Known Issues / Pre-existing TS Warnings

These warnings exist in the codebase and were NOT introduced in Sprint 33:
- `BUILD_VERSION` declared but never read (profile.tsx)
- `fetchUserCommunities` / `fetchPrivacySettings` declared but never read (profile.tsx)
- `FormEvent` deprecated (login.tsx, register.tsx, communities/[id].tsx, communities/new.tsx)
- `InlineChat` unused import
