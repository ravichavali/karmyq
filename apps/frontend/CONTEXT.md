# Frontend CONTEXT.md

**Last updated**: 2026-06-14 (Sprint 99 — release experience audit)

## Overview

Next.js 14 web application (Pages Router) consuming all Karmyq backend services.

---

## Sprint 99 Release Experience Audit (2026-06-14)

Findings + evidence: `docs/bugs/sprint-99-release-experience-audit.md`.

- **S99-001 — Stewardship 403.** `GET /communities/:id/stats` is admin-only (403 "Only community admins can view statistics"). The community page (`src/pages/communities/[id].tsx`) now gates `refetchStats()` behind `canViewCommunityStats({ isAdmin })` (`src/lib/community/statsVisibility.ts`) and re-runs the stewardship effect when `isAdmin` resolves, so members no longer flood the console with 403s.
- **S99-002 — caught-up overclaim.** The empty *curated* home feed terminal copy (`Feed/UnifiedFeed.tsx`) no longer says "That's everyone for now"; an empty curated feed only means no direct matches, so it points to community open asks instead.
- **S99-004 — provider Get Service routing.** `RequestWizard.tsx` already sends `preferred_provider_id`; the modal now surfaces it — submit reads "Ask {provider}" and a note says the provider will see it first — instead of looking like a blind "Ask neighbours" broadcast.
- **S99-006 — member email privacy.** The member-facing People roster (`community/tabs/ActiveTab.tsx`) no longer renders member emails; they remain in the admin/mod management table only.

## Sprint 98 Trust Truth Audit (2026-06-14, ADR-077)

- **BUG-098-001 — trust-path community context.** `useTrustPath`/`useBatchTrustPaths` (`src/hooks/useTrustPath.ts`) now accept an optional `communityId` and pass it as `X-Community-ID` via `socialGraphService.getTrustPath/getBatchTrustPaths(id, communityId)` (`src/lib/api.ts`). `RequestCard` supplies the card's `data.community_id`, so a badge's path matches the visible surface; absent context = platform-wide. The localStorage `user` parse is guarded (`readCurrentUserId`) so a corrupt value can't crash the hook.
- **BUG-098-005 — feed terminal state.** `UnifiedFeed` no longer shows "You're caught up" together with "Show more open requests"; "caught up" appears only after the feed is widened (`showingMoreOpen`). Onboarding workflow copy updated to match.
- **BUG-098-006 — legacy `/network`.** Removed the unused `socialGraphService.getNetwork()` wrapper; all trust-graph surfaces use `getTrustGraph*`.
- Relationship copy (DibsPrompt `community_connection`, ProviderCard "✓ In {community}") was already honest; the data-layer fixes make it true.

## Sprint 97 Release Readiness Data Quality (2026-06-13)

### `dashboard.tsx` membership bootstrap (BUG-097-001)

The mount effect called `fetchCommunities()` (async, not awaited) and then ran `setLoading(false)`
synchronously, so the page rendered with `loading=false` and an empty `userCommunities` before the
membership fetch resolved — flashing the false "You haven't joined a community yet" state for users
who *are* in communities. Fixed by tracking membership loading separately: a new
`communitiesLoading` state (initialised `true`) gates the loading screen
(`!user || loading || communitiesLoading`), `fetchCommunities` toggles it instead of `loading`, and
the zero-community block is gated on `!communitiesLoading && !communityLoadError &&
userCommunities.length === 0` — so a fetch failure shows the existing retry banner, never the false
empty state. Test: `tests/tdd/sprint-97-dashboard-community-load.test.tsx`.

### `Feed/UnifiedFeed.tsx` widened-feed terminal state (BUG-097-003)

The "That's everyone for now" finite copy only existed in the zero-card empty states; when the
widened feed (`showingMoreOpen`/`minScore=0`) still returned cards, the list just ended silently.
Added a terminal note rendered after the request cards, gated on `showingMoreOpen && activeType ===
'all' && activeUrgency === 'all' && !noCommunities`, so it appears only after the user clicks **Show
more open requests** and only on an unfiltered widened feed. Test:
`tests/tdd/sprint-97-feed-terminal-state.test.tsx`.

---

## Sprint 89 Community Sovereignty Redesign (2026-06-06, ADR-068)

### Community page → warm four-tab model
**Paths**: `src/pages/communities/[id].tsx`, `src/lib/communityTabs.ts`, `src/components/community/CommunityHero.tsx`, `src/components/community/CommunityPulse.tsx`, `src/components/community/StewardRequestsAdmin.tsx`, `src/components/community/tabs/StewardshipTab.tsx`, `src/components/community/tabs/BrowseTab.tsx`, `src/components/Feed/UnifiedFeed.tsx`, `src/hooks/useCommunityPulse.ts`, `src/styles/karmyq-shell.css`

- The `/communities/[id]` page is restructured from ~10 pre-shell tabs into **four warm tabs** — **Home · People · How we're connected · Stewardship** (+ a group-only **Activities**). The initial `activeTab` is **`home` for every role** (the `overview` default is gone). This fixes the headline S88 bug: the warm feed (`BrowseTab` → `UnifiedFeed`) was admin-gated under the old `requests` tab, so members never reached it.
- **`lib/communityTabs.ts`** is the single exported deep-link resolver (`resolveCommunityTab`, `VALID_TABS`). It maps every legacy `?tab=` alias into the four-tab model (`overview`/`requests`→home, `trust`→connected, `governance`/`fission`/`fusion`/`settings`/`config`/`links`/`providers`/`stats`/`insights`/`export`→stewardship, `manage`/`pending`/`members`/`norms`→people, unknown→home). The page **and** the IA test import it — never copy the map.
- **`BrowseTab` was split.** It now renders the member `UnifiedFeed` only (Home, all roles). Its admin steward-request manager (all-status list, triage/boost/propose, member picker, insights, export) was **extracted verbatim** into `StewardRequestsAdmin`, relocated under **Stewardship** (admin-only). `CommunityHeader` is **retired** in favour of `CommunityHero` (warm serif hero + member faces + Dunbar cap bar + embedded join CTA).
- **`CommunityPulse`** ("This week in the neighbourhood") replaces empty KPI tiles, fed by `useCommunityPulse` → `GET /requests/community/:id/pulse`. Zero/meaningless rows are suppressed. To avoid a double summary, `UnifiedFeed` gained a **`suppressActivity`** prop that hides the in-feed `ActivityCard` on community Home (the hero pulse renders it once).
- **`StewardshipTab`** composes the existing Governance/Split/Fusion (all members) + admin `StewardRequestsAdmin`/Settings/Providers under a warm sub-nav — a relocation, not a rewrite.

---

## Sprint 88 Help-Loop Redesign (2026-06-05)

### Shared shell and feed hierarchy
**Paths**: `src/styles/karmyq-shell.css`, `src/pages/dashboard.tsx`, `src/components/community/tabs/BrowseTab.tsx`, `src/components/Feed/*`

- Adds the warm shared shell layer: Fraunces headings, Hanken Grotesk body type, `kq-page`, `kq-page-header`, `kq-card`, `kq-path-badge`, `kq-action-band`, and `kq-finite-state`.
- Fidelity follow-up: `body` now carries the approved faint paper-grain radial texture, and `Layout` uses the mockup-aligned warm topbar (`kq-topbar`, seed-dot `kq-wordmark`, Home / Communities / Providers nav, one quiet notification dot).
- Dashboard Browse now leads with a calm Home header before `UnifiedFeed view="home"`.
- Community Browse now leads with a Community Home header before `UnifiedFeed view="community"` and suppresses empty KPI tiles.
- `RequestCard` is relationship-led: `RequestTrustBadge` / `TrustPathBadge` is the lead element, rendered with the feed-only `presentation="feed"` green face-pill; raw `KarmaBadge` is removed, and match percentage is demoted to a qualitative `describeMatchSignal()` line.
- `UnifiedFeed` defaults to `minScore=30`; the quiet **Show more open requests** affordance explicitly re-fetches with `minScore=0` so sub-30 open asks can appear on demand.
- `DecisionBand` and card shells wrap on mobile; `.fab` and `SpeedDialFab` use `bottom-28` on mobile to avoid CTA overlap.

### Copy and affordance polish
**Paths**: `src/components/RequestWizard.tsx`, `src/components/Layout.tsx`, `src/components/FissionProposalModal.tsx`, `src/components/FusionProposalModal.tsx`

- Request wizard copy now asks in neighbourly language (`Ask neighbours`) while keeping the warm emoji type picker.
- Layout keeps one quiet notification affordance by removing the extra provider notification bell from the top nav.
- Split/fusion proposal names are cleaned before submit so repeated `— Group A/B` suffixes do not accumulate.

---

## Sprint 86 Hotfix (2026-06-05)

### `UnifiedFeed.tsx` decision-band reconciliation
**Path**: `src/components/Feed/UnifiedFeed.tsx`

- After a decision-band action resolves, Dashboard Home optimistically drops the acted-on decision and background-refetches `view=home` without showing the loading skeleton.
- Prevents stale sibling offer decisions from remaining after the backend accepts one proposed match and rejects the other proposed matches for the same request.
- Fixes repeated `Match must be in proposed state to accept` 400s caused by clicking stale rejected match decisions.

### Tests updated
- `tests/tdd/sprint-85-unified-feed.test.tsx`
  - new case: accepting one decision refetches and removes sibling decisions rejected by the server.

---

## UX Usability Pass (Step 3, 2026-06-01)

### `dashboard.tsx` community-load recovery feedback
**Path**: `src/pages/dashboard.tsx`

- Adds an inline warning banner when community loading fails.
- Includes a `Retry` action that re-runs `fetchCommunities(user.id)` without forcing a full page refresh.
- Keeps failure feedback visible and actionable instead of logging-only behavior.

### `RequestWizard.tsx` accessibility + guidance polish
**Path**: `src/components/RequestWizard.tsx`

- Adds `type="button"` on non-submit controls to prevent accidental default submit behavior.
- Adds `aria-pressed` to urgency chips.
- Adds `aria-expanded` + `aria-controls` to community scope toggle.
- Adds short helper guidance below Description to improve request quality.

### Tests updated
- `tests/unit/sprint-80-dashboard-bootstrap.test.tsx`
  - new case: failed community load shows retry banner and retry re-calls API.
- `tests/unit/sprint-80-request-wizard-draft.test.tsx`
  - new case: urgency and community scope controls expose expected accessibility state.

---

## Reliability Hardening (Sprint 80)

### `dashboard.tsx` auth/session bootstrap
**Path**: `src/pages/dashboard.tsx`

- Prevents infinite spinner state when `token` exists but localStorage `user` is missing/corrupt.
- Behavior:
  - missing token → redirect to `/login`
  - token present but missing `user` → clear token/refresh token and redirect
  - malformed/invalid `user` JSON or missing `id` → clear auth storage and redirect
- Ensures `loading` is explicitly set false in all redirect branches.

### `Layout.tsx` localStorage parsing guard
**Path**: `src/components/Layout.tsx`

- Wraps `JSON.parse(localStorage.user)` in try/catch.
- On parse failure, clears stale `user` storage instead of throwing.

### `RequestWizard.tsx` safe close
**Path**: `src/components/RequestWizard.tsx`

- Adds draft protection on backdrop/X close:
  - if no draft, close immediately
  - if draft exists, asks for confirmation before discarding
- Prevents accidental request draft loss.

### `TabBar.tsx` label consistency
**Path**: `src/components/TabBar.tsx`

- Renames tab label from `Active` to `Helping` (desktop + mobile) to align with approved navigation taxonomy.

---

## Product Taxonomy Alignment (Sprint 81)

### Navigation labels
- Dashboard tab labels are standardized to: `Browse`, `Helping`, `Asks`.
- Request/offer confirmation copy updated from “Active tab”/“My Requests” language to `Helping`/`Asks`.
- Mobile tab titles standardized to `Browse`, `Asks`, `Me`.

---

## New Components (Sprint 35)

### `RequestWizard.tsx`
**Path**: `src/components/RequestWizard.tsx`
Two-step request creation modal. Fully self-contained — owns type fetch, schema fetch, form state, and request submission.

- **Step 1**: Type picker grid (2-col mobile, 3-col desktop). Tiles are `.type-card` CSS class.
- **Step 2**: DynamicForm (schema-driven fields) + plain description textarea + urgency chips + community scope selector.
- Props: `onClose`, `onSuccess?`, `preferredProviderId?`, `preferredProviderName?`, `preferredProviderServiceType?`
- When `preferredProviderServiceType` is set: initializes at step 2 with that type pre-selected and locked.
- Urgency mapping: UI uses `normal | urgent | critical`; backend uses `medium | urgent | critical` (normal → medium).
- Fetches available types via `requestService.getSchemas()` on mount; augments built-in types with custom schemas.
- Calls `fetchSchema(type)` immediately when user taps a tile in step 1 (so step 2 loads instantly).
- Module-level `schemaCache` prevents redundant fetches within a session.
- Z-index: backdrop `z-[49]`, modal `z-50`.

### `SpeedDialFab.tsx`
**Path**: `src/components/SpeedDialFab.tsx`
Tab-aware expandable FAB. Replaces the old static `.fab` button.

- **browse**: expands to "Get Help" + "Get Service" action stack.
- **helping** / **asks**: single "Get Help" action (plain FAB, no expansion).
- Props: `activeTab: TabId`, `onGetHelp: () => void`, `onGetService: () => void`
- Z-index: actions `z-40`, backdrop `z-39` (wizard modal is `z-50`).

### Removed in Sprint 35
- `EnhancedAutocomplete` and `ExtractedDataChips` are no longer used in dashboard.
- NLP/smart-text logic (`parseRequestDescription`, `buildPayloadFromParsed`, `getSuggestions`, `updateLocationCoordinates`) no longer called from dashboard.
- All NLP-related state removed from `dashboard.tsx`: `parsedRequest`, `autocompleteSuggestions`, `autocompleteTrigger`, etc.

## New Components (Sprint 34)

### `TabBar.tsx`
**Path**: `src/components/TabBar.tsx`
Tab navigation component. Renders horizontal tab bar on desktop (`md:`) and sticky bottom nav on mobile.

- **Desktop**: `div.tab-bar.hidden.md:flex` — horizontal tabs below top nav
- **Mobile**: `nav.bottom-nav` — fixed to `bottom-0`, hidden at `md:` breakpoint
- Props: `activeTab: TabId`, `onChange: (tab: TabId) => void`, `commitmentCount?: number`
- `TabId` = `'browse' | 'helping' | 'asks'`
- Shows commitment count dot/badge on Commitments tab when `commitmentCount > 0`

### `Feed/UnifiedFeed.tsx` (current feed surface — replaced the retired `BrowseFeed`)
**Path**: `src/components/Feed/UnifiedFeed.tsx`
Single-column unified feed. The same component powers two surfaces via a `view` prop:
- **Dashboard Home** (`view=home`) — rendered by `pages/dashboard.tsx`
- **Community Home** (`view=community`) — rendered by `components/community/tabs/BrowseTab.tsx`

- Fetches via `requestService.getCuratedRequests({ view, minScore?, community_id?, ... })` → `GET /requests/curated`. request-service is the **feed source-of-truth** (ADR-066); when a `view` is passed the response is `{ items: UnifiedFeedItem[] }`. Sprint 88: default feed calls pass `minScore=30`; **Show more open requests** passes explicit `minScore=0` and must not omit the param.
- `UnifiedFeedItem` is a discriminated union of four kinds rendered in priority order: `decision` (`DecisionBand` — proposed matches needing your accept/reject), `request` (`RequestCard` — open asks you can help with), `activity` (`ActivityCard`), `story` (`StoryCard`). The texture layer (activity/story cards) is ADR-066/067.
- `RequestCard` surfaces `category` as `payload_type` and switches its body on it via `RequestPayloadRenderer` (ADR-067). Sprint 88: it leads with the trust path, removes requester Karma from the card, and renders `match_score` only as qualitative quiet meta via `describeMatchSignal()`.
- After a decision-band action resolves, Dashboard Home optimistically drops the acted-on decision and background-refetches `view=home` (see Sprint 86 Hotfix above).

> **Retired in Sprint 86:** the legacy `BrowseFeed.tsx`, `Feed.tsx`, `FeedItem.tsx`, and `FeedFilterPanel` components no longer exist — do not reference them as live. The unified feed (ADR-066) replaced them.

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

## Layout & Navigation (Sprint 34, updated Sprint 86)

### Tab-Based Dashboard Architecture
`dashboard.tsx` is a tab shell — it does NOT own feed logic. The active tab drives which component renders. As of Sprint 86 the Browse tab renders `UnifiedFeed` (`view=home`), not the retired `BrowseFeed`.

```
dashboard.tsx
├── Community selector (top bar, scopes the feed)
├── TabBar (Browse | Helping | Asks)
├── Tab content area
│   ├── <UnifiedFeed view="home" communityId={activeCommunityId} />   # decisions + open requests + texture
│   ├── <CommitmentsTab />
│   └── <MyRequestsTab onNewRequest={...} />
└── FAB ("Get Help") — visible on Browse + Helping only
```

The community page (`communities/[id]`) renders the same `UnifiedFeed` with `view="community"` inside `components/community/tabs/BrowseTab.tsx`.

### Single Responsive Breakpoint
`md:` (768px) is the only breakpoint for layout:
- Below `md:`: bottom tab bar, stacked layout
- At/above `md:`: horizontal tab bar, no bottom nav

### Content Max-Width
All tab content areas use `max-w-2xl mx-auto` (672px).

### FAB Positioning
```css
.fab { @apply fixed bottom-28 right-6 md:bottom-8; }
```
`bottom-28` clears the bottom nav and feed card CTAs on mobile. On desktop (`md:`), drops to `bottom-8`.

### Layout.tsx Changes (Sprint 34)
Top nav simplified:
- **Desktop**: Logo | Communities | Providers | [Avatar] | [Logout]
- **Mobile**: Logo | [Avatar] | [☰ hamburger → Communities, Providers, Profile]
- Dashboard / main nav links removed — tabs replace them on the dashboard page
- `LeftSidebar` and `RightSidebar` kept in codebase but NOT rendered in `dashboard.tsx` (available for other pages if needed)

---

## Known Issues / Pre-existing TS Warnings

These warnings exist in the codebase and were NOT introduced in Sprint 33:
- `BUILD_VERSION` declared but never read (profile.tsx)
- `fetchUserCommunities` / `fetchPrivacySettings` declared but never read (profile.tsx)
- `FormEvent` deprecated (login.tsx, register.tsx, communities/[id].tsx, communities/new.tsx)
- `InlineChat` unused import
