# Sprint 2: Feed UX Redesign

## Context
**Current Version**: v9.1.0
**Status**: COMPLETE ✅ (implemented 2026-02-24)

Sprint 1 is complete (invitation URL fix, karma guide language, trust score on profile). Sprint 2 focuses on making the feed actionable — separating items that need attention from accepted commitments.

---

## What Needs to Be Built

### 1. Collapsible "Upcoming Commitments" section (above feed)
- Shows accepted matches where the user is helper OR requester
- Expanded by default when active matches exist, collapsible
- Each item shows: request title, other party's name, scheduled time (for rides), FulfillmentPanel-style summary
- When no active matches: section is hidden entirely

### 2. Feed = action-required items only
Current feed mixes accepted matches with pending items. After this sprint:
- **Show**: Pending offers on your requests (needs accept/decline), pending offers you made (awaiting response), community requests you haven't responded to
- **Remove from main feed**: Accepted matches (they move to Upcoming Commitments)

### 3. Wire the Filter button (currently a stub)
- Trust level filter: Direct / 2nd degree / Community / All
- Request type filter: ride / service / event / borrow / generic
- Server-side `/requests/curated` already supports `feed_weight_trust_distance` — just needs params passed through

---

## Key Files

### Dashboard (main file to change)
- `apps/frontend/src/pages/dashboard.tsx` — lines 241–362 contain the 5-tier priority sort logic. This needs to be split: accepted matches → UpcomingPanel, rest stays in feed.

### New component to create
- `apps/frontend/src/components/UpcomingPanel.tsx` — collapsible section showing accepted matches

### API
- `apps/frontend/src/lib/api.ts` — `requestService.getCurated()` needs optional `trust_distance` and `request_type` filter params

### Existing components to reuse
- `apps/frontend/src/components/FulfillmentPanel.tsx` — can be used inside UpcomingPanel for ride details
- `apps/frontend/src/components/TrustPathBadge.tsx` — already used inline, reuse in UpcomingPanel

---

## Decisions Already Made

1. **Layout**: Collapsible "Upcoming Commitments" section sits **above** the feed. Expanded by default when matches exist, collapses when dismissed (use localStorage to persist collapsed state).
2. **Feed content**: Only action-required items. Accepted matches are NOT in the main feed.
3. **Filter UI**: Wire existing Filter button stub to a dropdown/panel with trust level + request type options.

---

## Tests Required (per CLAUDE.md checklist)
- `UpcomingPanel` renders with matches, empty state when none
- Collapses/expands correctly
- Feed no longer shows `status === 'matched'` items
- Filter params are passed to curated API call

---

## Quick Start

```bash
# Read local frontend context first
cat apps/frontend/.claude/README.md

# Check current dashboard sort logic
# Lines 241-362 in apps/frontend/src/pages/dashboard.tsx

# Run existing tests to make sure baseline passes
cd apps/frontend && npx jest tests/tdd/
```
