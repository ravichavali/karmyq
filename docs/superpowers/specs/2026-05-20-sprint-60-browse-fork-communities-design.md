# Sprint 60: Provider Browse Fork + Communities Page Polish — Design Spec

**Date**: 2026-05-20
**Status**: Approved
**Version**: v9.26.0 → v9.27.0
**Sprint Branch**: `feature/sprint-60-browse-fork-communities`

---

## Overview

Sprint 60 ships two independent tracks. Track A completes the provider availability toggle: the existing pill (Available / Off duty) in the nav now forks what the Browse tab shows — on-duty providers see only requests matching their service types, off-duty providers see the normal community feed. No new UI is introduced; the toggle already exists and the `BrowseFeed` component already accepts a `serviceTypeFilter` prop.

Track B polishes the Discover Communities page. The page currently has three UX gaps: a duplicate "Discover Communities" heading rendered by both `<Layout>` and the page itself, a Community Configuration banner that belongs in the creation flow (not on a search page), and a dumb default sort that surfaces newest-first regardless of activity. The fix introduces a "Your Communities" strip at the top (zero extra API calls — uses the JWT), filters already-joined communities out of the discover grid, and adds an `activity` sort option to the backend so the default shows thriving communities first.

### Core Principle: Right Information at the Right Moment

Community configuration belongs in the creation flow, not on the discovery page. Browse forks belong to the availability toggle, not to a new UI element.

---

## Multi-Sprint Arc

### Sprint 59 — Dashboard UX Simplification (complete)
3-tab dashboard, provider re-entry link, feed bug fix.

### Sprint 60 — Provider Browse Fork + Communities Polish (this sprint)
Availability toggle forks Browse. Communities page: deduplication, smarter load, config banner moved.

### Sprint 61 — TBD (upcoming)

---

## New Concepts

None.

---

## Data Model

No schema changes.

---

## API Endpoints

### Modified

| Method | Path | Change |
|--------|------|--------|
| GET | /communities | Add `sort=activity` option → orders by `inner_circle_count DESC, active_community_count DESC, current_members DESC` |

No new endpoints.

---

## Frontend Changes

### Track A: Provider Browse Fork

| File | Change |
|------|--------|
| `apps/frontend/src/pages/dashboard.tsx` | Pass `serviceTypeFilter={providerServiceTypes}` to `<BrowseFeed>` when `isAvailable && providerServiceTypes.length > 0` |
| `apps/frontend/src/components/BrowseFeed.tsx` | Confirm `serviceTypeFilter` prop is already wired; add label "Showing provider requests" when filter is active |

### Track B: Communities Page Polish

| File | Change |
|------|--------|
| `apps/frontend/src/pages/communities/index.tsx` | Remove `title="Discover Communities"` from `<Layout>` (dedup heading). Remove non-welcome config banner (lines 389–417). Add "Your Communities" strip using `user.communities` from JWT. Filter joined communities from discover grid. Change default `sortBy` from `'newest'` to `'activity'`. |
| `apps/frontend/src/pages/communities/new.tsx` | Add a "Browse Templates" inline link in the Basic Info step subtitle, before the form fields. |

---

## Backend Changes

### Community Service

**File**: `services/community-service/src/routes/communities.ts`

Add `activity` as a valid `sort` value in the default query branch (around line 184):

```typescript
} else if (sort === 'activity') {
  orderBy = 'inner_circle_count DESC, active_community_count DESC, c.current_members DESC, c.created_at DESC';
```

The `inner_circle_count` and `active_community_count` aliases are already in the SELECT of the default query branch — PostgreSQL allows ORDER BY to reference SELECT aliases.

---

## User Guide & Doc Updates

- **User Guide**: Update `docs/guides/communities.md` → add "Your Communities" section description + note about activity-based discovery sort.
- **Landing page**: Regenerate via `cd apps/landing && npm run generate-docs` after updating `docs/guides/communities.md`.
- No new concept pages or ADRs needed.

---

## Critical Implementation Notes

1. **Provider Browse Fork — only fork for providers**: `isAvailable` alone isn't enough. Only pass `serviceTypeFilter` when the user has a provider profile AND `providerServiceTypes.length > 0`. Non-providers and providers with no service types configured should always see the normal community feed.

2. **BrowseFeed `serviceTypeFilter` existing wiring**: The prop already exists on the component. Verify it's actually filtering in the API call, not just in client-side display, before marking the task done.

3. **"Your Communities" zero API calls**: Use `user.communities` directly from the parsed JWT in localStorage. Shape is `Array<{id, name, role}>`. No fetch needed.

4. **Activity sort alias reference**: PostgreSQL allows `ORDER BY inner_circle_count DESC` when `inner_circle_count` is a SELECT alias from the lateral subquery. Confirm the default query branch (the `else` path with conditions/pagination) uses the alias correctly. The geography and interests fast-paths have their own `ORDER BY` and don't need changing.

5. **Filter joined communities client-side**: Build a `Set` from `user.communities.map(c => c.id)` on mount. In the render, filter the `communities` array before mapping to cards: `communities.filter(c => !joinedIds.has(c.id))`. Don't filter in state — keep the full list so "Load More" offsets remain correct.

6. **Default sort change**: Changing `useState('newest')` to `useState('activity')` triggers a re-fetch on mount via the existing filter-change effect. Confirm `initialized` guard prevents double-fetch on first render.

7. **Browse Templates link placement in new.tsx**: Add it as a small note below the step title in the `basic` step, before the first form field. Keep it subtle — `text-sm text-text-muted` with a `text-primary` link.

8. **No DiscoveryToggle change needed**: The toggle (Geography / Interests) stays as-is. The "Your Communities" strip and the filter are independent of discovery mode.
