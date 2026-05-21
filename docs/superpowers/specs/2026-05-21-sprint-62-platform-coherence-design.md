# Sprint 62: Platform Coherence — Design Spec

**Date**: 2026-05-21
**Status**: Approved
**Version**: v9.28.0 → v9.29.0
**Sprint Branch**: `feature/sprint-62-platform-coherence`

---

## Overview

Five coherence gaps have accumulated across the platform where configuration exists but is never read, or where backend guards don't match the intended UX. This sprint closes all five.

The work spans two layers: backend route guards and logic (request-service, reputation-service) and frontend navigation and UI (Layout, CommitmentsTab, BrowseFeed). Each fix is narrow and self-contained. Together they ensure the platform behaves as designed rather than silently ignoring admin configuration.

### Core Principle: Config Should Drive Behavior

Every community-configured setting — enabled request types, karma multipliers, community type — should actually change how the platform behaves. Silent no-ops erode admin trust and create invisible gaps between the documented capabilities and the running system.

---

## Multi-Sprint Arc

| Sprint | Theme | Status |
|--------|-------|--------|
| Sprint 58 | karmyq.org rebuild — 3-layer content, deeper sections | ✅ Complete + deployed |
| Sprint 59 | Dashboard UX Simplification (3 tabs, provider re-entry, feed fix) | ✅ Complete + deployed |
| Sprint 60 | Provider Browse Fork + Communities Polish | ✅ Complete + deployed |
| Sprint 61 | On-Duty Browse Refinement (segmented control + card accents) | ✅ Complete + deployed |
| **Sprint 62** | **Platform Coherence — close 5 backlog gaps** | 🔲 This sprint |
| Sprint 63 | Fit-for-purpose feeds redesign | 🔲 Planned |

---

## New Concepts

None — this sprint closes gaps in existing concepts, not introducing new ones.

---

## Data Model

No schema changes required. All relevant columns already exist:

- `communities.community_type` — `'mutual_aid' | 'group'` — stored but not branched on in most code paths
- `community_configs.config` (JSONB) — stores `enabled_request_types[]` with per-type `karma_multiplier`
- `requests.matches.requester_id` + `matches.responder_id` — both stored; only requester_id used in reject guard

**Example community_configs.config shape** (already in DB):
```json
{
  "enabled_request_types": [
    { "name": "meal_share", "karma_multiplier": 1.2 },
    { "name": "ride_share", "karma_multiplier": 1.0 },
    { "name": "emotional_support", "karma_multiplier": 1.5 }
  ],
  "base_karma_pool_per_request": 100
}
```

---

## API Endpoints

### Modified: `PUT /matches/:id/reject`

**File**: `services/request-service/src/routes/matches.ts` (~line 429)

**Current**: Only `match.requester_id === user_id` is permitted. Responders get 403 "Only the requester can reject this match."

**Fixed**: Either party can call this endpoint. The action is contextually named:
- Requester calling it → "reject offer" (declines a proposed helper)
- Responder calling it → "withdraw offer" (retracts their own proposed help)

Both paths set match status to `'cancelled'`.

Guard change:
```typescript
// BEFORE
if (match.requester_id !== user_id) {
  return res.status(403).json({ success: false, message: 'Only the requester can reject this match.' });
}

// AFTER
if (match.requester_id !== user_id && match.responder_id !== user_id) {
  return res.status(403).json({ success: false, message: 'Only match participants can reject or withdraw.' });
}
```

### Modified: `POST /requests` — request type enforcement

**File**: `services/request-service/src/routes/requests.ts` (~line 819)

**Added**: Validate `request_type` against the community's `enabled_request_types` config before inserting.

Query pattern (add to existing community settings fetch):
```sql
SELECT
  cs.max_ttl_hours,
  cs.default_scope,
  cc.config->'enabled_request_types' AS enabled_request_types
FROM community.community_settings cs
LEFT JOIN community.community_configs cc ON cc.community_id = cs.community_id
WHERE cs.community_id = $1
```

Validation logic:
```typescript
const enabledTypes = settings.enabled_request_types;
if (enabledTypes && enabledTypes.length > 0) {
  const allowed = enabledTypes.map((t: any) => t.name);
  if (!allowed.includes(request_type)) {
    return res.status(400).json({
      success: false,
      message: `Request type '${request_type}' is not enabled in this community.`,
      error: 'REQUEST_TYPE_NOT_ENABLED'
    });
  }
}
```

**Backward compatible**: If `enabled_request_types` is null, empty, or not set, all request types remain allowed.

### Modified: Karma allocation — internal event handler

**Files**: `services/reputation-service/src/services/karmaAllocation.ts` + caller in event handler

**Current**: `allocateKarma(configs, totalPool)` — `totalPool` is fixed at 100 regardless of request type.

**Fixed**: Add `requestType` parameter. The caller (match_completed event handler) fetches the community's `karma_multiplier` for the given request type and passes a multiplied pool.

```typescript
// karmaAllocation.ts — new signature
export function allocateKarma(
  configs: CommunityKarmaConfig[],
  totalPool: number,
  requestType?: string  // used to look up multiplier from config
): CommunityAllocation[]

// Caller (event handler) — before calling allocateKarma
const multiplier = getKarmaMultiplier(communityConfig, requestType); // default 1.0
const adjustedPool = basePool * multiplier;
allocateKarma(configs, adjustedPool);
```

The multiplier lookup is a pure helper function — no new DB query in the allocator itself. The caller fetches the full community config when processing the event.

---

## Frontend Changes

### `CommitmentsTab.tsx` — Withdraw Offer (no change needed)

The existing `handleDecline` call uses the same `PUT /matches/:id/reject` endpoint. After the backend guard fix, this works correctly for both requester (reject) and responder (withdraw). No frontend logic change required.

However: verify there's a loading/disabled state on the "Withdraw Offer" button during the request. If not, add one to prevent double-submission.

### `Layout.tsx` — Provider Mode Re-entry

**Investigation required in Task 3**: Check what provider profile management pages exist before linking. Look for `/providers/[id]`, `/providers/me`, or a provider settings tab.

If a management page exists: add a "Manage profile" secondary link/button in the Layout provider nav section (next to the existing availability toggle) when `hasProviderProfile === true`.

If no management page exists: add a "Profile" link pointing to the provider's profile page using their provider ID from context.

### `BrowseFeed.tsx` — Community Type Differentiation

**Investigation required in Task 6**: Confirm `community_type` is available in the component's data context (likely via `dashboard.tsx` state or community data fetch).

**Planned change**: When `community_type === 'group'`:
- Replace the default empty state message with group-appropriate copy: "This group uses the Activities tab for coordination. Browse requests from your group members below."
- Show a soft notice banner at the top of the feed linking to the Activities tab
- The help request feed itself still renders (groups can still post requests)

When `community_type === 'mutual_aid'` (or unset): current behavior unchanged.

This is the highest-impact, lowest-disruption branch point: visual differentiation without changing the underlying data flow. A `group` community member still sees help requests but gets contextual framing that Activities is the primary coordination tool.

---

## User Guide & Doc Updates

MANDATORY — every sprint ships doc updates. These are not optional.

| Change | Doc to update |
|--------|--------------|
| Withdraw Offer fix | Update `docs/guides/provider-mode.md` — add note that providers can withdraw offers from the Active tab |
| Request type enforcement | Update `docs/guides/community-settings.md` — add section on enabling/disabling request types |
| Karma multipliers | Update `docs/guides/community-settings.md` — add section on per-type karma multipliers |
| Community type behavior | Create or update `docs/guides/community-types.md` — explain mutual_aid vs group differences |

Landing page updates (regenerated via `npm run generate-docs`):
- `apps/landing/src/data/docs/guides/provider-mode-guide.json` — updated
- `apps/landing/src/data/docs/guides/community-settings.json` — updated (or created if missing)
- `apps/landing/src/data/docs/concepts/community-types.json` — updated (concept page)

---

## Critical Implementation Notes

1. **Withdraw Offer guard change is one line**: Change `requester_id !== user_id` to `requester_id !== user_id && responder_id !== user_id` in `matches.ts`. Match status after responder withdrawal should be `'cancelled'` — verify the frontend handles `cancelled` vs `rejected` statuses correctly before merging.

2. **Request type enforcement is opt-in**: If `enabled_request_types` is null, empty, or missing from community config, ALL request types remain allowed. Never break communities that haven't configured this setting.

3. **Karma multiplier default is 1.0**: If no multiplier is configured for a request type, multiply by 1.0 (no-op). Never fail or return 0 if config is missing — fall through gracefully.

4. **Provider Mode Re-entry — investigate first**: Before adding a nav link, check what pages exist for provider profile management. Adding a link to a 404 is worse than having no link.

5. **Community type data availability**: `community_type` is likely already in the community object fetched by `dashboard.tsx`. Check before adding a new API call — don't over-fetch.

6. **Pre-existing TDD failures are not this sprint's problem**: `sprint-39-provider-ux` (7 tests), `sprint-43-feed-ranking` (crashes). These were pre-existing when Sprint 62 starts. Do NOT fix them, just ignore them in test output.

7. **`git add` on Windows**: `CLAUDE.md` is tracked as lowercase `claude.md` — always `git add claude.md`.

8. **community_configs table** is in the `community` schema (not `communities`) — queries should use `community.community_configs`.
