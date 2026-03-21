# Sprint 34: UX Redesign — Navigation & Feed Foundation — Design Spec

**Date**: 2026-03-21
**Status**: Approved
**Version**: v9.8.0 → v9.9.0
**Sprint Branch**: `feature/sprint-34-ux-redesign`

---

## Overview

The current dashboard imposes 8 competing focal points before a user can do anything useful. A 3-column layout with left/right sidebars, 5 mixed feed tiers, hidden filter panels, and a subtle text-area entry point means users must first *understand the system* before they can act within it. This is backwards for a mutual aid platform where the primary value proposition is dead-simple: someone needs help, someone else can give it.

Sprint 34 redesigns the navigation shell and feed architecture around the 5 most-used flows: browse needs, ask for help, ask for a service, offer help, and track commitments. The approach is mobile-first and tab-based — each tab has one job. The 3-column layout is retired. Sidebars are removed. The dashboard becomes a tab shell that delegates to focused sub-views.

Sprint 35 will simplify the request creation flow itself (progressive disclosure, fewer required fields). Sprint 36 will add depth to commitment tracking (timeline, inline messaging). This sprint lays the structural foundation both need.

### Core Principle: One Screen, One Job

Every tab should have one obvious primary action. No competing focal points. Users should be able to identify their goal and act on it within 2 taps.

---

## Multi-Sprint UX Arc

| Sprint | Focus | Status |
|--------|-------|--------|
| **33** | Design system foundation: canonical classes, empty states, onboarding, performance | ✅ Complete |
| **34** | Navigation redesign + feed simplification + Commitments as first-class tab | 🔜 This sprint |
| **35** | Request creation simplification (progressive disclosure) + service hiring from provider profiles | Future |
| **36** | Commitment depth (timeline, inline messaging) + admin simplification | Future |

---

## UX Research Summary

Research into best-in-class mutual aid and community help platforms reveals consistent patterns:

**Nextdoor Help flow**: Bottom nav, single-column feed, prominent "Post" button always visible. Color encodes urgency, not type. Feed is one thing: requests from your neighborhood.

**Taskrabbit**: First question is the only question on screen ("What do you need done?"). Category comes after intent. Zero cognitive load at entry.

**Uber driver / DoorDash delivery**: The current commitment (active order/delivery) is a full-screen dedicated view — not a section in a feed. You cannot miss what you are responsible for.

**Gig economy offer pattern**: "Accept" and "Decline" are the only choices on a request card. No ambiguity about what action to take.

**Key principles extracted:**
1. Separate "browse needs" from "my commitments" — different mental contexts, different screens
2. Default to one thing; reveal categories after intent is established
3. Commitments need a dedicated home — not a section in a mixed feed
4. Mobile-first bottom tab bar for 4 core destinations
5. Persistent "Get Help" / "Offer Help" FAB always reachable
6. Color = urgency (not request type)

---

## Current State Audit

### What the 3-column layout costs users

```
┌──────────────────┬──────────────────────────────────┬────────────────┐
│ LEFT SIDEBAR     │ MAIN FEED (mixed)                │ RIGHT SIDEBAR  │
│ • Karma card     │ • Quick-create form (subtle)     │ • Comm. Health │
│ • Communities    │ • Upcoming Commitments (tier 1)  │ • Milestones   │
│ • Your Impact    │ • Accepted Matches (tier 2)      │ • Top Helpers  │
│                  │ • Pending Offers (tier 3)        │ • Active Now   │
│                  │ • My Open Requests (tier 4)      │                │
│                  │ • Community Requests (tier 5)    │                │
│                  │ • Filter panel (hidden)           │                │
└──────────────────┴──────────────────────────────────┴────────────────┘
```

**7+ focal points. 5 feed tiers. 0 obvious primary action.**

Mixing commitments and community requests in the same feed forces users to parse which category each card belongs to before they can decide what to do. Users looking to offer help must scroll past their own pending items to reach requests they can act on.

### Commitment tracking gap

"Upcoming Commitments" lives as a secondary panel inside the main feed scroll. It is visually similar to other feed items, has no dedicated state (just a status badge), and provides no timeline or communication affordance. Users with active commitments must scroll to find them each session. There is no dedicated "what do I need to do today?" view.

### Navigation debt

Top nav: Dashboard | Communities | Service Providers | Notifications | Profile — five global items with no clear hierarchy. "Service Providers" and "Communities" are secondary features for many users but take equal prominence with Dashboard.

---

## New Navigation Architecture

### Tab Bar (replaces top-nav links + both sidebars)

| Tab | Icon | Purpose | Primary action |
|-----|------|---------|----------------|
| **Browse** | 🔍 | See community requests I can help with | "Offer to Help" on each card |
| **Commitments** | 🤝 | See everything I've agreed to (giving + receiving) | "Mark Done" on each item |
| **My Requests** | 📋 | See requests I've posted + incoming offers | "Accept Offer" on each item |
| **Profile** | 👤 | Karma, trust, communities, settings | — |

### Top Bar (stays)

Slimmed down: `Karmyq` logo | `[Community: All ▾]` selector | Notification bell | Avatar

- Community selector moves to top bar (was left sidebar)
- Notification bell stays
- Avatar links to profile
- No more "Dashboard / Communities / Service Providers" horizontal links in nav

### Communities + Providers navigation

These remain accessible via:
- Profile tab → "My Communities" section → community detail pages
- Browse tab → filter chip → "Providers" filter surfaces service requests
- Direct URL `/communities`, `/providers` still work

They are not removed — they are deprioritized from primary nav to secondary access points.

### Floating Action Button (FAB)

Persistent "Get Help" button fixed at bottom-right on Browse and Commitments tabs. Tapping it opens the existing request creation flow (Sprint 35 will simplify the form itself).

```
Position: fixed bottom-24 right-6 (above bottom tab bar on mobile)
Label: + Get Help
Variant: .btn-primary with shadow-lg, pill shape
```

Absent from My Requests (user is already in request management context) and Profile.

---

## Layout Redesign

### Desktop (≥ 768px)

```
┌──────────────────────────────────────────────────────────────┐
│  Karmyq          [All Communities ▾]         🔔  [Avatar]   │
├──────────────────────────────────────────────────────────────┤
│  Browse  │  Commitments  │  My Requests  │  Profile          │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│   [Single-column content, max-width: 680px, centered]        │
│                                                              │
│                                          ╭─────────────╮    │
│                                          │  + Get Help │    │
│                                          ╰─────────────╯    │
└──────────────────────────────────────────────────────────────┘
```

- Horizontal tab bar below top nav
- Content area: max-width 680px, centered, no sidebars
- FAB: fixed bottom-right

### Mobile (< 768px)

```
┌──────────────────────────┐
│ Karmyq            🔔 ☰  │
├──────────────────────────┤
│                          │
│   [Full-width cards]     │
│                          │
│                 ╭──────╮ │
│                 │ Help │ │
│                 ╰──────╯ │
├──────────────────────────┤
│ Browse  Commits  Me  ☰  │
└──────────────────────────┘
```

- Top bar: Logo + notification bell + hamburger (for Communities, Providers, Settings)
- Bottom tab bar: Browse | Commitments | My Requests | Profile
- FAB: fixed above bottom tab bar
- Hamburger drawer for secondary nav (Communities, Providers, Admin)

---

## Tab Content Design

### Tab 1: Browse

**Purpose**: See community requests I can help with. Offer help.

**Content**: Single-column card feed. Cards show:
- Requester name + trust path badge (compact)
- Request title + 1-line description
- Category chip (ride / service / general / borrow / event) — colored
- Urgency indicator (bar or dot: low/medium/high/urgent) — colored by urgency, NOT type
- Match score (if curated feed enabled) — subtle percentage badge
- "Offer to Help" CTA — prominent, one per card

**Filter row**: Horizontal chip row above feed (not hidden panel)
```
[All]  [Urgent]  [Rides]  [Services]  [Borrow]  [Events]  ▼ More
```
Chips are single-select filters. "More" opens a drawer for advanced options.

**Empty state**: "No open requests right now — check back soon, or post your own." with "Get Help" CTA.

**What's removed**: Upcoming Commitments, Accepted Matches, Pending Offers, My Open Requests no longer appear in this feed. Browse is purely "other people's requests I can help with."

### Tab 2: Commitments

**Purpose**: Everything I've agreed to — active matches where I'm the helper OR the requester.

**Content**: Two sections:
1. **I'm Helping** — matches where I offered and was accepted. Shows: request title, requester name, status badge (proposed / matched / in-progress / pending confirmation), "Mark Done" CTA.
2. **I Asked For Help** — my requests that have been matched. Shows: request title, helper name, status badge, "Confirm Done" CTA when helper marks complete.

**Status color coding**:
- `proposed` → gray (waiting)
- `matched` → blue (accepted, not yet started)
- `in-progress` → amber (active)
- `pending-confirmation` → green (one party marked done)
- `completed` → muted green (done)

**Empty state**: Two separate empty states per section.

### Tab 3: My Requests

**Purpose**: Requests I've posted, their status, and incoming offers.

**Content**: List of my help requests. Each shows:
- Request title + type chip
- Status badge (open / matched / completed / expired)
- Offer count ("3 offers")
- Tapping expands to show offers with "Accept" / "Decline" per offer

**FAB absent**: Already in request context. "New Request" button at top of list instead.

### Tab 4: Profile

**Purpose**: Karma, trust score, communities, settings.

**Content**: Consolidates what was in the left sidebar + profile page:
- Karma score + recent activity
- Trust score summary
- My Communities (list with quick-join link)
- Settings link
- Evolution toggle (already moved here in Sprint 33)
- Logout

---

## Component Map

### New components to create

| Component | Path | Purpose |
|-----------|------|---------|
| `TabBar` | `src/components/TabBar.tsx` | Horizontal tabs (desktop) + sticky bottom bar (mobile) |
| `BrowseFeed` | `src/components/BrowseFeed.tsx` | Feed of community requests (formerly part of dashboard) |
| `CommitmentsTab` | `src/components/CommitmentsTab.tsx` | "I'm Helping" + "I Asked For Help" sections |
| `MyRequestsTab` | `src/components/MyRequestsTab.tsx` | My posted requests + offer management |
| `FilterChipRow` | `src/components/FilterChipRow.tsx` | Horizontal filter chips (replaces FeedFilterPanel) |

### Components to significantly modify

| Component | Change |
|-----------|--------|
| `Layout.tsx` | Remove sidebar imports, add TabBar slot, restructure page container |
| `dashboard.tsx` | Becomes tab shell — renders active tab component, no longer owns feed logic |

### Components to remove from layout (not delete)

| Component | What happens |
|-----------|-------------|
| `LeftSidebar.tsx` | No longer imported in Layout or dashboard — karma/communities info moves to Profile tab |
| `RightSidebar.tsx` | No longer imported — Community Health moves to community detail page; leaderboard deferred |
| `UpcomingPanel.tsx` | No longer shown in dashboard feed — data reused in CommitmentsTab |
| `FeedFilterPanel.tsx` | Replaced by FilterChipRow on Browse tab — file kept but no longer used in dashboard |

> **Note**: Do not delete these files — some may be used in other pages. Simply remove them from the dashboard + layout composition.

---

## CSS / Design Tokens Needed

New utility classes in `globals.css @layer components`:

```css
/* Tab bar */
.tab-bar { ... }                  /* horizontal tab container */
.tab-bar-item { ... }             /* individual tab */
.tab-bar-item.active { ... }      /* active tab */

/* Bottom nav (mobile) */
.bottom-nav { ... }               /* fixed bottom bar */
.bottom-nav-item { ... }

/* FAB */
.fab { ... }                      /* floating action button */

/* Status badges */
.status-badge { ... }             /* base */
.status-badge--proposed { ... }
.status-badge--matched { ... }
.status-badge--in-progress { ... }
.status-badge--pending-confirmation { ... }
.status-badge--completed { ... }

/* Filter chips */
.filter-chip { ... }
.filter-chip--active { ... }

/* Feed card */
.feed-card { ... }                /* extends .card with feed-specific layout */
```

---

## API Impact

**No new API endpoints required.** All data is already available:
- Browse feed: existing `feedApi.getCuratedFeed()` + `requestService.getRequests()`
- Commitments: existing `requestService.getMatches()` — already returns match status
- My Requests: existing `requestService.getMyRequests()` + offers per request
- Profile: existing karma + trust APIs

The CommitmentsTab needs data from two match query shapes (where I'm helper vs. where I'm requester). Both already exist in the API — they just need to be fetched in a dedicated component rather than mixed into the dashboard feed.

---

## User Guide & Doc Updates

Every sprint ships doc updates. Sprint 34 must update:

| Doc | Location | Change |
|-----|----------|--------|
| Getting Started guide | `apps/landing/src/data/docs/guides/getting-started-guide.json` | Replace dashboard-centric walkthrough with tab-based navigation |
| Making Requests guide | `apps/landing/src/data/docs/guides/making-requests-guide.json` | Reference "My Requests" tab instead of dashboard |
| New concept page | `apps/landing/src/data/docs/concepts/ux-design-principles.json` | Document the 5-flow user mental model + design philosophy |
| nav.json | `apps/landing/src/data/docs/nav.json` | Add new concept page entry |

The `using-service-providers.json` guide is lower priority — service provider flow is Sprint 35's scope.

---

## Critical Implementation Notes

1. **Dashboard becomes a tab shell, not a page.** `dashboard.tsx` should no longer own feed fetching, sidebar rendering, or commitment display. It renders the active tab component based on `activeTab` state. Tab components own their own data fetching.

2. **LeftSidebar and RightSidebar are NOT deleted** — they are simply removed from `Layout.tsx` and `dashboard.tsx` imports. Other pages may reference them; check before removing any imports.

3. **Bottom tab bar must sit above the FAB on mobile.** FAB is `fixed bottom-24 right-6` (6rem from bottom), bottom nav is `fixed bottom-0`. If bottom nav height changes, update FAB offset.

4. **Community selector moves from left sidebar to top bar.** The `selectedCommunity` state that was in `LeftSidebar` must be lifted to `dashboard.tsx` and passed to `BrowseFeed` as a prop (or via React context).

5. **FilterChipRow replaces FeedFilterPanel but does not duplicate its logic.** The existing filter state (requestType, urgency, matchScore, trustDistance) should be preserved — just exposed as chips instead of a hidden panel. Start with type + urgency chips only; defer match score slider and trust distance to Sprint 35.

6. **CommitmentsTab fetches its own matches.** Do NOT re-use the dashboard's existing match-fetching logic by passing data down. CommitmentsTab mounts and calls `requestService.getMatches()` independently.

7. **The FAB opens the EXISTING request creation form** (the `EnhancedAutocomplete` / `DynamicForm` flow in dashboard). Sprint 35 replaces this form. For Sprint 34, the FAB scrolls to or opens the existing request creation area, keeping the current implementation intact.

8. **`generate-docs.ts` is the source of truth for nav.json.** Never edit `nav.json` directly. Add concept/guide entries to the script's source data and regenerate. Force-add landing docs: `git add -f apps/landing/src/data/docs/...`

9. **Max-width on content area.** The single-column feed should be `max-w-2xl mx-auto` (672px). This is narrower than the current full-width layout and will require padding adjustments in container divs across the new tab components.

10. **Mobile breakpoint**: Use `md:` prefix (768px) consistently. Below 768px = bottom tab bar. Above 768px = horizontal tab bar. This is the only responsive breakpoint needed for this sprint.
