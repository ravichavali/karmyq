# Sprint 61: On-Duty Browse Refinement — Design Spec

**Date**: 2026-05-20
**Status**: Approved
**Version**: v9.27.0 → v9.28.0
**Sprint Branch**: `feature/sprint-61-on-duty-browse`

---

## Overview

Sprint 60 forked the browse feed by provider availability: when a provider is on-duty, `BrowseFeed` silently receives a `serviceTypeFilter` and shows only matching requests. This is effective but blunt — providers lose visibility into community requests while on-duty and have no way to choose. The fork is also invisible: users see no UI signal that filtering is happening, just fewer cards.

Sprint 61 replaces the binary fork with a **3-chip segmented control** visible only when the user is on-duty. The three modes — Community, Provider, Both — give providers explicit control over what they see. Color-coded left-border accents make it easy to distinguish provider-opportunity requests from community requests in the combined view.

The entire change is frontend-only. No backend modifications, no schema changes, no new API calls.

### Core Principle: Explicit Mode, Visible Signal

Providers should know exactly what filter is active and be able to change it. The segmented control is the filter. Card accents are the signal.

---

## Multi-Sprint Arc

| Sprint | Theme | Status |
|--------|-------|--------|
| Sprint 59 | Dashboard UX Simplification | ✅ Complete |
| Sprint 60 | Provider Browse Fork + Communities Polish | ✅ Complete |
| **Sprint 61** | **On-Duty Browse Refinement** | 🔲 This sprint |

---

## New Concepts

**`browseMode`**: `'community' | 'provider' | 'both'`
- Controls filtering and visual language of `BrowseFeed` when a provider is on-duty.
- Persisted in `localStorage` at key `karmyq_browse_mode`.
- Default when on-duty and no saved value: `'provider'`.
- Off-duty (or non-provider): no mode state, no control shown.

**Provider-match card**: A request whose `request_type` matches one of the provider's `providerServiceTypes`. Gets an amber left-border accent and a "Provider match" badge in both `'provider'` and `'both'` modes.

---

## Data Model

No schema changes. No new tables or columns.

---

## API Endpoints

No new or modified endpoints.

---

## Frontend Changes

### `apps/frontend/src/components/BrowseFeed.tsx`

**Props change (breaking, safe — only called from dashboard.tsx):**
- Remove: `serviceTypeFilter?: string[]`
- Add: `isOnDuty?: boolean`, `providerServiceTypes?: string[]`

**New state:**
- `browseMode: 'community' | 'provider' | 'both'` — initialized from `localStorage.getItem('karmyq_browse_mode')` or defaults to `'provider'` when on-duty.

**Segmented control UI (renders only when `isOnDuty`):**
- 3 chips above the existing `FilterChipRow`: Community | Provider | Both
- Active chip: filled primary-style background
- Inactive chip: bordered, muted text
- Clicking a chip sets `browseMode` and writes to `localStorage`

**Filter logic:**
| `browseMode` | Filter applied |
|---|---|
| `'community'` | No service type filter — full community feed |
| `'provider'` | Filter requests to `providerServiceTypes` only |
| `'both'` | No filter — all requests shown |

**Card visual accent (request cards):**
- In `'provider'` or `'both'` mode: cards where `providerServiceTypes.includes(request.request_type)` get `border-l-4 border-amber-400` left-border accent + small "Provider match" text badge (amber, below title).
- In `'community'` mode: no accents (plain community card appearance).
- Accent is derived client-side from existing request data — no new API fields needed.

**Label change:**
- Remove the `"Showing requests matching your service types"` static label (replaced by the segmented control).

### `apps/frontend/src/pages/dashboard.tsx`

Replace the `serviceTypeFilter` prop on `<BrowseFeed>`:

```tsx
// Before (Sprint 60):
<BrowseFeed
  communityId={...}
  serviceTypeFilter={
    hasProviderProfile && isAvailable && (providerServiceTypes?.length ?? 0) > 0
      ? providerServiceTypes
      : undefined
  }
  noCommunities={...}
/>

// After (Sprint 61):
<BrowseFeed
  communityId={...}
  isOnDuty={hasProviderProfile && isAvailable}
  providerServiceTypes={providerServiceTypes ?? []}
  noCommunities={...}
/>
```

---

## User Guide & Doc Updates

**Mandatory every sprint:**

| File | Change |
|---|---|
| `docs/guides/provider-mode-guide.md` | Update "What Changes in Provider Mode" section — replace stale Member/Provider pill toggle references with current on-duty toggle. Add new "Feed Modes" section describing Community / Provider / Both chips and card accents. |
| `apps/landing/src/data/docs/guides/provider-mode-guide.json` (generated) | Regenerated via `npm run generate-docs` |

---

## Critical Implementation Notes

1. **localStorage key is `karmyq_browse_mode`** — not user-scoped. One device, one preference. This is intentional (same pattern as other feed preferences in the app).
2. **Default on first on-duty is `'provider'`** — not `'community'`. Providers who just went on-duty should see their relevant requests, not the full unfiltered feed.
3. **Off-duty = no segmented control** — when `isOnDuty` is false (or undefined), `browseMode` state is still initialized but the control is not rendered and no filtering or accents are applied. The feed behaves exactly as it did pre-Sprint 60.
4. **`'both'` mode is unfiltered** — all requests are fetched and shown. The amber accent is derived from `request.request_type` matching `providerServiceTypes`. Do not filter the list.
5. **Prop rename is a breaking change to BrowseFeed's interface** — `serviceTypeFilter` → `isOnDuty` + `providerServiceTypes`. Only one callsite (dashboard.tsx), so this is safe. Update both files in the same task to avoid a build gap.
6. **TDD tests written before implementation** — follow TDD: write the test file first, then implement until tests pass.
7. **Amber color token** — use Tailwind `border-amber-400` and `text-amber-600 bg-amber-50` (already used for `urgency: 'medium'` in the component — consistent with existing palette).
