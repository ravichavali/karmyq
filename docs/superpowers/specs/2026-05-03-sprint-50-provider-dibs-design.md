# Sprint 50: Provider Mode + Dibs — Design Spec

**Date**: 2026-05-03
**Status**: Approved
**Version**: v9.15.0 → v9.16.0
**Sprint Branch**: `feature/sprint-50-provider-dibs`

---

## Overview

Sprints 27–42 built a comprehensive provider and dibs infrastructure: provider profiles, availability toggle, dibs table, scoring service, cleanup job, `DibsPrompt` UI, `CommitmentsTab` pending dibs display, and the `RequestWizard` post-creation dibs flow. The infrastructure is largely complete, but three artificial restrictions and one wiring gap prevent it from working end-to-end:

1. The provider mode toggle writes to localStorage only — it never calls `PATCH /providers/:id/availability`, so the backend availability state never changes.
2. Dibs is restricted to scheduled requests in both the backend (two guards in `dibs.ts`) and the frontend (`RequestWizard.tsx` checks `scheduled_for`).
3. The dibs candidate query joins `provider_profiles`, so non-providers with prior match history are invisible to dibs for mutual aid requests.
4. No off-duty confirmation exists, leaving providers unaware their commitments survive the toggle.

Sprint 50 closes all four gaps. No new tables. No new routes (only a small addition to the dibs-candidate query signature). The work is targeted modifications to six files.

### Core Principle: Close the Loop

Don't add new features — make the existing ones work. Every change in this sprint connects something that was already built but disconnected.

---

## Multi-Sprint Arc

| Sprint | Theme | Status |
|--------|-------|--------|
| Sprint 37–42 | Provider profiles, rate cards, offers, dibs infrastructure | ✅ Complete |
| **Sprint 50** | **Wire the toggle + lift the scheduled-only restriction** | 🔵 This sprint |
| Sprint 51 | Trust-score-integrated matching | ⬜ Upcoming |

---

## Data Model

No migrations needed. All required columns already exist:
- `requests.provider_profiles.is_available` (Boolean) — toggled by availability endpoint
- `requests.dibs` table — fully provisioned with status, expires_at
- `requests.help_requests.status` — already supports `'dibs_pending'`

---

## API Endpoints

| Method | Path | Change | Description |
|--------|------|--------|-------------|
| `GET` | `/requests/:id/dibs-candidate` | Add `?type=` param | Switches between provider candidates (service requests) and mutual aid candidates (all other types) |
| `PATCH` | `/requests/providers/:id/availability` | Unchanged | Already exists; frontend was not calling it |

All other endpoints unchanged.

---

## Backend Changes

### 1. `services/request-service/src/routes/dibs.ts`

**Remove `scheduled_for` guard** from both routes:
- `GET /:id/dibs-candidate` — remove the `if (!request.scheduled_for)` block (lines 41–45)
- `POST /:id/dibs` — remove the `if (!request.scheduled_for)` block (lines 107–113)

**Fix expiry calculation** in `POST /:id/dibs`:
```typescript
// Before: only worked for scheduled requests
const leadTime = scheduledFor.getTime() - now.getTime();
const expiresAt = new Date(now.getTime() + leadTime * 0.20);

// After: use lead time if scheduled, 24h fixed window otherwise
const DIBS_FIXED_WINDOW_MS = 24 * 60 * 60 * 1000;
const expiresAt = request.scheduled_for
  ? new Date(now.getTime() + (new Date(request.scheduled_for).getTime() - now.getTime()) * 0.20)
  : new Date(now.getTime() + DIBS_FIXED_WINDOW_MS);
```

**Update `GET /:id/dibs-candidate`** to accept `?type=` query param and route to appropriate candidate function.

### 2. `services/request-service/src/db/dibsDb.ts`

**Add `getMutualAidCandidates(requesterId, communityIds)`**:
- Joins `auth.users` directly (not `provider_profiles`)
- Counts prior completed matches between requester and candidate
- Filters: `priorInteractions >= 1`, `candidate != requester`, community membership
- Returns same `RawCandidate` shape (with `trustScore` defaulting to 50, `isAvailable` defaulting to `true` for non-providers)

```sql
SELECT
  u.id                       AS "providerId",
  u.id                       AS "providerUserId",
  u.name                     AS "displayName",
  COALESCE(pts.trust_score, 50) AS "trustScore",
  prior.interaction_count    AS "priorInteractions",
  COALESCE(CASE sg.type
    WHEN 'exchange'  THEN 'direct'
    WHEN 'community' THEN 'indirect'
    ELSE 'none'
  END, 'none')               AS "trustGraphConnection",
  true                       AS "isAvailable"
FROM auth.users u
JOIN ( [prior matches subquery identical to getEligibleCandidates] ) prior ON prior.provider_user_id = u.id
LEFT JOIN reputation.provider_trust_scores pts ON pts.provider_id = ... -- skip for non-providers, use 50
LEFT JOIN social_graph.connections sg ON ...
WHERE prior.interaction_count >= 1
  AND u.id != $1
  AND u.id IN (SELECT user_id FROM communities.members WHERE community_id = ANY($2))
ORDER BY prior.interaction_count DESC, "trustScore" DESC
LIMIT 5
```

### 3. Route logic in `GET /:id/dibs-candidate`

```typescript
const requestType = req.query.type as string | undefined;
const candidate = requestType === 'service'
  ? await getBestCandidate(userId, communityIds)          // existing: joins provider_profiles
  : await getMutualAidBestCandidate(userId, communityIds); // new: joins auth.users
```

`getMutualAidBestCandidate` is a thin wrapper in `dibsScoringService.ts` that calls `getMutualAidCandidates` → runs it through `selectTopCandidate`.

---

## Frontend Changes

### 1. `apps/frontend/src/contexts/ProviderContext.tsx`

**Wire `setProviderMode` to the availability API:**

```typescript
const setProviderMode = async (mode: 'member' | 'provider') => {
  setProviderModeState(mode)
  localStorage.setItem('karmyq_provider_mode', mode)
  const isAvailable = mode === 'provider'
  for (const profile of providerProfiles) {
    try {
      await providerService.updateAvailability(profile.id, isAvailable)
      updateProviderAvailability(profile.id, isAvailable)
    } catch {
      // best-effort — local state already updated
    }
  }
}
```

Add `updateAvailability(profileId, isAvailable)` to the `providerService` API client if not present.

### 2. `apps/frontend/src/components/ProviderModeSwitcher.tsx`

**Add off-duty confirmation:** When switching member → provider is straightforward; provider → member should show an inline confirmation:

```
"Going off-duty won't affect your active commitments — you'll still see and fulfill them."
[Go off-duty]  [Stay on]
```

Implement as local `showConfirm` state. No modal library needed — an inline conditional renders below the toggle buttons.

### 3. `apps/frontend/src/components/RequestWizard.tsx`

**Remove `scheduled_for` check** (line 166):
```typescript
// Before
if (createdRequest?.scheduled_for && createdRequest?.id) {

// After
if (createdRequest?.id) {
```

**Pass request type** to `dibsService.getDibsCandidate`:
```typescript
const candidateRes = await dibsService.getDibsCandidate(createdRequest.id, requestType)
```

**Update expiry display** for non-scheduled: show "24 hours" as the window instead of computing from `scheduled_for`.

Add `requestType` to the `getDibsCandidate` API client call signature to append `?type=`.

---

## User Guide & Doc Updates

**Required every sprint:**

| Document | Change |
|----------|--------|
| `docs/guides/provider-guide.md` | Add "Going On/Off Duty" section explaining toggle behavior and commitment persistence. Add "Dibs" section: what it is, how the request is routed, how to accept/decline in CommitmentsTab. |
| `apps/landing/src/data/docs/guides/provider.json` | Regenerate via `npm run generate-docs` |

---

## Critical Implementation Notes

1. **`setProviderMode` is currently synchronous** — making it `async` changes the return type. `ProviderModeSwitcher.tsx` calls it directly; make sure the click handler is async-safe (fire-and-forget is fine — the toggle doesn't need to await the API call to update the UI).

2. **`getMutualAidCandidates` must return the same `RawCandidate` shape** as `getEligibleCandidates` so `selectTopCandidate` / `rankCandidates` in `dibsScoringService.ts` can process both without changes. Set `isAvailable: true` for all mutual aid candidates (they don't have a provider availability field).

3. **`GET /:id/dibs-candidate` must still read `scheduled_for` from the DB** — not for the eligibility gate (which is removed), but the response may include it for display. Keep the SELECT; remove only the guard.

4. **Off-duty toggle with pending dibs**: A provider going off-duty who has a `pending` dibs record should still be able to respond to it. The toggle only affects new candidate selection — it must not auto-decline existing dibs.

5. **`PATCH /providers/:id/availability` returns `{ id, is_available }`** (confirmed from route source). The API client call should read `res.data.is_available` to confirm success.

6. **Expiry for non-scheduled requests is 24h fixed.** Do not compute from `created_at` + any variable — hardcode `24 * 60 * 60 * 1000` ms. The existing cleanup job (`expireDibs` in cleanup-service) already handles expiry correctly regardless of the window size.

7. **Do not modify the `requests.dibs` UNIQUE constraint** on `request_id`. It enforces one dibs per request, which is correct. The `POST /:id/dibs` already checks for existing dibs and returns `DIBS_ALREADY_SENT`.

8. **Provider guide (`docs/guides/provider-guide.md`) may not exist yet** — check before writing. If it doesn't exist, create it. If it does, append the new sections.
