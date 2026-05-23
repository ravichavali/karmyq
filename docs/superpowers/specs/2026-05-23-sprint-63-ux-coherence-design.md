# Sprint 63: UX Coherence — Design Spec

**Date**: 2026-05-23
**Status**: Approved
**Version**: v9.29.0 → v9.30.0
**Sprint Branch**: `feature/sprint-63-ux-coherence`

---

## Overview

Sprint 63 ships three targeted UX improvements that reduce friction and visual noise across the community admin experience, the browse feed, and the provider context.

The shared theme: **surfaces that exist should do their job clearly.** The people tab currently asks admins to navigate two sub-tabs and a toggle to see a complete picture of their community. The browse feed leaks stale matched requests. Provider mode has no consistent visual identity beyond the browse feed cards.

None of these changes touch the backend data model. All three are correctness and clarity improvements applied to existing data.

### Core Principle: Signal over Surface

Every element visible to the user makes an implicit claim on their attention. These changes reduce the number of distinct surfaces without reducing functionality — the same actions are available, just in fewer clicks.

---

## Multi-Sprint Arc

| Sprint | Theme | Status |
|--------|-------|--------|
| Sprint 59 | Dashboard UX Simplification | ✅ Complete |
| Sprint 60 | Provider Browse Fork + Communities Polish | ✅ Complete |
| Sprint 61 | On-Duty Browse Refinement (segmented control + card accents) | ✅ Complete |
| Sprint 62 | Platform Coherence — 5 runtime gaps | ✅ Complete |
| **Sprint 63** | **UX Coherence — admin, feed, provider visual language** | 🔲 This sprint |
| Sprint 64 | Admin-as-connector (boost, DM) + Feed design doc | 🔲 Next |

---

## Item 1: Admin Page Simplification

### Problem

The community people tab (`ActiveTab`) has three conceptual layers for admins:
1. Sub-tab toggle: **Members | Norms**
2. Within Members: **Active | Pending** filter
3. Within each filter: separate list rendering

An admin managing a small community has to navigate 2–3 clicks to see the full picture. Pending members (the most time-sensitive item) are hidden behind a filter, surfaced only via a red dot badge.

### Solution

Collapse to a single unified view with natural vertical priority:

```
People tab (admin view)
├── Pending requests section (only shown if pendingCount > 0)
│   └── [Name] [Email] [Approve] [Reject] — one row per pending member
├── Active members section
│   └── [Name] [Email] [Joined] [Role dropdown] [Trust] [Remove]
└── Community Norms (collapsible accordion, closed by default)
    └── Norm cards + Add Norm form
```

**Changes to `ActiveTab.tsx`:**
- Remove `peopleSubTab` state and the Members | Norms button row
- Remove `memberFilter` state and the Active | Pending filter buttons
- Always render pending members at top (guarded by `isAdminOrMod && pendingCount > 0`)
- Always render active members below
- Move norms into a collapsible `<details>` / accordion section at the bottom
- Non-admin view stays unchanged (card list of active members)

The invite button and role dropdowns remain exactly where they are.

---

## Item 2: Feed Coherence

### Problem

When a match is confirmed (requester accepts an offer), the request status is set to `'matched'` in the database. The curated feed query already filters `WHERE r.status = 'open'`, so matched requests should disappear. However there are two edge cases:

1. **Offer pending, not accepted**: A responder offers help (match created, status `'pending_acceptance'` or similar). The request is still `'open'`. Other users see it as available. The responder's local feed removes it via client-side filter, but there's no "offer pending" signal for the requester.

2. **CommitmentsTab staleness**: After accepting a match, the requester's CommitmentsTab may not refetch automatically, leaving a disconnect between what's "committed" and what shows in the feed.

### Solution

**Backend verification (Task 2):** Trace the match acceptance endpoint (`PUT /matches/:id/accept` in `matches.ts`) to confirm `status = 'matched'` is set on the help_request row in all code paths, including the dibs fast-path and regular acceptance.

**Frontend (BrowseFeed.tsx):** After `createMatch` succeeds, show a brief inline confirmation: "Offer sent — track it in [Commitments]" (link to CommitmentsTab via `?tab=helping`). This bridges the UX gap between making an offer and knowing where to track it.

**CommitmentsTab:** Trigger a refetch when the dashboard tab changes to `helping`. This ensures the tab is never stale when navigated to.

No new backend endpoints. No schema changes.

---

## Item 3: Provider/Community Visual Language

### Problem

When a user is on duty (provider mode active), the only visual signal is the amber left border on provider-matched request cards in the browse feed. No other surface acknowledges the mode change. The BrowseModeControl active chip uses `bg-primary` (green) even when in provider context.

### Solution

Apply a consistent amber/orange accent to all provider-context UI, derived from existing `isOnDuty` and `browseMode` state — no new API calls.

**Changes:**

1. **Dashboard header badge**: When `isOnDuty`, render a small amber pill "On duty" next to the community selector or near the bell icons. This is the global signal that provider context is active.

2. **BrowseModeControl**: When `browseMode === 'provider'`, use amber active-chip color (`bg-amber-500 border-amber-500`) instead of `bg-primary`. Community and Both chips keep the primary (green) style.

3. **Provider profile section** (dashboard profile card): Add an amber left-border accent to the provider profile card when `isOnDuty`, consistent with the card-level treatment in the feed.

Color tokens to use: `bg-amber-500`, `text-amber-600`, `border-amber-400`, `bg-amber-50`. These are already in use for provider-match cards and urgency indicators — no new colors.

---

## Frontend Changes

| Component | Change |
|-----------|--------|
| `apps/frontend/src/components/community/tabs/ActiveTab.tsx` | Remove sub-tabs + filter; unified pending/active/norms layout |
| `apps/frontend/src/components/BrowseFeed.tsx` | Post-offer confirmation message with CommitmentsTab link |
| `apps/frontend/src/components/BrowseModeControl.tsx` | Amber active-chip color when browseMode === 'provider' |
| `apps/frontend/src/pages/dashboard.tsx` | On-duty badge; CommitmentsTab refetch on tab switch |
| `services/request-service/src/routes/matches.ts` | Verification only — confirm status='matched' in all acceptance paths |

---

## User Guide & Doc Updates

- **Community management guide** (`apps/landing/src/data/docs/guides/community-management.json`): Update "Managing Members" section to reflect unified people tab (no sub-tabs)
- **Provider mode guide** (`apps/landing/src/data/docs/guides/provider-mode.json`): Add note about amber visual language and on-duty badge
- No new ADR — these are UX refinements, not architectural decisions

---

## Critical Implementation Notes

1. **ActiveTab norms in an accordion** — use a `<details>/<summary>` element or a simple `useState` open/closed toggle. Do not use a library component. Keep it simple.

2. **Pending section guard** — only render the pending section when `isAdminOrMod && pendingCount > 0`. Non-admins and admins with no pending requests see a clean single-section list.

3. **BrowseModeControl color change is prop-driven** — the component receives `browseMode` already. Change the active class from `bg-primary text-white border-primary` to conditionally use amber when `browseMode === 'provider'`. The `BrowseMode` type lives in `BrowseModeControl.tsx` — don't move it.

4. **On-duty badge in dashboard.tsx** — the `isOnDuty` flag is already computed as `hasProviderProfile && isAvailable` (line 491 approx). Use this directly; do not add a new state variable.

5. **Feed coherence is mostly verification** — if the match acceptance endpoint already correctly sets `status = 'matched'`, the browse feed already excludes matched requests. The main frontend work is the post-offer UX (confirmation + link) and CommitmentsTab refetch trigger.

6. **CommitmentsTab tab id is `'helping'`** — the `id` for the Active/Commitments tab is `'helping'` for URL routing. The label is "Active". Do not change the id. Deep-link with `?tab=helping`.

7. **No new tests for provider color tokens** — color class changes don't need unit tests. TDD tests cover the structural changes in ActiveTab (unified member list rendering) and the post-offer confirmation appearing after a successful match creation.
