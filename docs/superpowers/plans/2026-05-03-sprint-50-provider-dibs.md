# Sprint 50: Provider Mode + Dibs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Wire the provider availability toggle to the API and lift the scheduled-only restriction from dibs, making both features work end-to-end for all request types.

**Architecture:** No new tables or routes — six targeted file modifications close the gaps between existing infrastructure components. The dibs scoring, cleanup job, CommitmentsTab UI, and DibsPrompt UI are all production-ready and unchanged.

**Tech Stack:** Node.js/Express/TypeScript, Next.js 14, PostgreSQL 15, Bull queue.

---

## File Map

### New files to create
| File | Responsibility |
|------|---------------|
| `docs/guides/provider-dibs-guide.md` | New guide: dibs routing, on/off duty, commitment persistence |

### Existing files to modify
| File | Change |
|------|--------|
| `services/request-service/src/routes/dibs.ts` | Remove `scheduled_for` guards; fix expiry to 24h for non-scheduled; add `?type` routing in candidate route |
| `services/request-service/src/db/dibsDb.ts` | Add `getMutualAidCandidates()` |
| `services/request-service/src/services/dibsScoringService.ts` | Add `getMutualAidBestCandidate()` wrapper |
| `apps/frontend/src/contexts/ProviderContext.tsx` | Wire `setProviderMode` to call `updateAvailability` API for each active profile |
| `apps/frontend/src/components/ProviderModeSwitcher.tsx` | Add off-duty confirmation step |
| `apps/frontend/src/components/RequestWizard.tsx` | Remove `scheduled_for` check; pass `?type` to dibs candidate fetch; fix expiry display |
| `apps/frontend/src/lib/api.ts` | Add `type` param to `dibsService.getDibsCandidate` |
| `docs/guides/provider-mode-guide.md` | Add off-duty/commitment-persistence section |
| `docs/guides/using-service-providers-guide.md` | Add dibs section from requester perspective |

---

## ⚠️ Critical Implementation Notes (read before Task 2)

1. **`setProviderMode` → async**: Making it async is safe — `ProviderModeSwitcher.tsx` calls it as `onClick={() => setProviderMode(…)}` which fires-and-forgets. No await needed at the call site. The UI update (`setProviderModeState`) happens synchronously before the API calls.

2. **`getMutualAidCandidates` must return `RawCandidate[]`** — same shape as `getEligibleCandidates`. Set `isAvailable: true` for all rows (mutual aid candidates don't have a provider availability field). This lets `selectTopCandidate` / `rankCandidates` process both without changes.

3. **Remove only the guard, not the `scheduled_for` SELECT** in the candidate route — the `scheduled_for` column is still needed for the expiry calculation when it exists.

4. **Expiry for non-scheduled = `NOW() + 24h` hardcoded** — `24 * 60 * 60 * 1000` ms. The cleanup-service `expireDibs` job handles expiry correctly regardless of the window.

5. **Off-duty toggle must NOT auto-decline existing pending dibs** — the toggle only affects new candidate selection. A provider going off-duty who has a pending dibs invite must still be able to respond to it.

6. **Provider guide check**: `docs/guides/provider-mode-guide.md` and `docs/guides/using-service-providers-guide.md` both exist. Append sections; do not rewrite from scratch.

7. **`?type=` param in candidate route**: If `type` is `'service'`, use `getBestCandidate` (joins `provider_profiles`). For any other value or missing param, use `getMutualAidBestCandidate` (joins `auth.users`). This keeps service requests provider-only.

---

## Task 1: Feature Branch

- [ ] **Create the sprint branch**

```bash
git checkout -b feature/sprint-50-provider-dibs
```

- [ ] **Verify starting point**

```bash
git log --oneline -3
```

---

## Task 2: Backend — Remove `scheduled_for` Restriction + Fix Expiry

**Files:**
- Modify: `services/request-service/src/routes/dibs.ts`

- [ ] **In `GET /:id/dibs-candidate` — remove the `scheduled_for` guard**

Remove lines 41–45 (the block that returns `400 ASAP_NOT_ELIGIBLE`). Keep the `SELECT` that fetches `scheduled_for` — it's still referenced for expiry.

- [ ] **In `POST /:id/dibs` — remove the `scheduled_for` guard**

Remove lines 107–113 (the block that returns `400 ASAP_NOT_ELIGIBLE`).

- [ ] **Fix expiry calculation in `POST /:id/dibs`**

Replace the current lead-time-only calculation:

```typescript
const DIBS_FIXED_WINDOW_MS = 24 * 60 * 60 * 1000;
const expiresAt = request.scheduled_for
  ? (() => {
      const scheduledFor = new Date(request.scheduled_for);
      const leadTime = scheduledFor.getTime() - now.getTime();
      if (leadTime <= 0) {
        return res.status(400).json({
          success: false,
          message: 'scheduled_for must be in the future',
          error: 'SCHEDULED_FOR_IN_PAST',
        });
      }
      return new Date(now.getTime() + leadTime * 0.20);
    })()
  : new Date(now.getTime() + DIBS_FIXED_WINDOW_MS);
```

Note: the `leadTime <= 0` guard only applies when `scheduled_for` exists. Extract it cleanly:

```typescript
const DIBS_FIXED_WINDOW_MS = 24 * 60 * 60 * 1000;
let expiresAt: Date;
if (request.scheduled_for) {
  const scheduledFor = new Date(request.scheduled_for);
  const leadTime = scheduledFor.getTime() - now.getTime();
  if (leadTime <= 0) {
    return res.status(400).json({ success: false, message: 'scheduled_for must be in the future', error: 'SCHEDULED_FOR_IN_PAST' });
  }
  expiresAt = new Date(now.getTime() + leadTime * 0.20);
} else {
  expiresAt = new Date(now.getTime() + DIBS_FIXED_WINDOW_MS);
}
```

- [ ] **Verify TypeScript compiles**

```bash
cd services/request-service && npx tsc --noEmit
```

---

## Task 3: Backend — Mutual Aid Candidate Query

**Files:**
- Modify: `services/request-service/src/db/dibsDb.ts`
- Modify: `services/request-service/src/services/dibsScoringService.ts`

- [ ] **Add `getMutualAidCandidates` to `dibsDb.ts`**

```typescript
export async function getMutualAidCandidates(
  requesterId: string,
  communityIds: string[]
): Promise<RawCandidate[]> {
  const result = await query(
    `SELECT
       u.id                                AS "providerId",
       u.id                                AS "providerUserId",
       u.name                              AS "displayName",
       50                                  AS "trustScore",
       prior.interaction_count             AS "priorInteractions",
       COALESCE(
         CASE sg.type
           WHEN 'exchange'  THEN 'direct'
           WHEN 'community' THEN 'indirect'
           ELSE 'none'
         END,
         'none'
       )                                   AS "trustGraphConnection",
       true                                AS "isAvailable"
     FROM auth.users u

     JOIN (
       SELECT
         CASE
           WHEN hr.requester_id = $1 THEN m.responder_id
           ELSE hr.requester_id
         END AS provider_user_id,
         COUNT(*) AS interaction_count
       FROM requests.matches m
       JOIN requests.help_requests hr ON hr.id = m.request_id
       WHERE m.status = 'completed'
         AND (
           (hr.requester_id = $1 AND m.responder_id != $1)
           OR (m.responder_id = $1 AND hr.requester_id != $1)
         )
       GROUP BY
         CASE
           WHEN hr.requester_id = $1 THEN m.responder_id
           ELSE hr.requester_id
         END
     ) prior ON prior.provider_user_id = u.id

     LEFT JOIN social_graph.connections sg ON (
       (sg.user_a_id = $1 AND sg.user_b_id = u.id)
       OR (sg.user_b_id = $1 AND sg.user_a_id = u.id)
     )

     WHERE prior.interaction_count >= 1
       AND u.id != $1
       AND u.id IN (
         SELECT DISTINCT cm.user_id
         FROM communities.members cm
         WHERE cm.community_id = ANY($2)
       )`,
    [requesterId, communityIds]
  );

  return result.rows.map((row: any) => ({
    providerId: row.providerId,
    providerUserId: row.providerUserId,
    displayName: row.displayName ?? '',
    trustScore: 50,
    priorInteractions: Number(row.priorInteractions),
    trustGraphConnection: row.trustGraphConnection as 'direct' | 'indirect' | 'none',
    isAvailable: true,
  }));
}
```

- [ ] **Add `getMutualAidBestCandidate` to `dibsScoringService.ts`**

```typescript
export async function getMutualAidBestCandidate(
  requesterId: string,
  communityIds: string[]
): Promise<ScoredCandidate | null> {
  const candidates = await getMutualAidCandidates(requesterId, communityIds);
  if (candidates.length === 0) return null;
  const ranked = rankCandidates(candidates);
  return ranked[0] ?? null;
}
```

Import `getMutualAidCandidates` from `../db/dibsDb` at the top of `dibsScoringService.ts`.

- [ ] **Update `GET /:id/dibs-candidate` in `dibs.ts` to use `?type` routing**

```typescript
const requestType = req.query.type as string | undefined;
const candidate = requestType === 'service'
  ? await getBestCandidate(userId, communityIds)
  : await getMutualAidBestCandidate(userId, communityIds);
```

Import `getMutualAidBestCandidate` from `../services/dibsScoringService`.

- [ ] **Verify TypeScript compiles**

```bash
cd services/request-service && npx tsc --noEmit
```

---

## Task 4: Frontend — Wire Provider Mode Toggle to API

**Files:**
- Modify: `apps/frontend/src/contexts/ProviderContext.tsx`

- [ ] **Make `setProviderMode` call `updateAvailability` for each active profile**

Replace the current synchronous `setProviderMode`:

```typescript
const setProviderMode = async (mode: 'member' | 'provider') => {
  setProviderModeState(mode)
  if (typeof window !== 'undefined') {
    localStorage.setItem('karmyq_provider_mode', mode)
  }
  const isAvailable = mode === 'provider'
  for (const profile of providerProfiles) {
    try {
      await providerService.updateAvailability(profile.id, isAvailable)
      updateProviderAvailability(profile.id, isAvailable)
    } catch {
      // best-effort — local state already reflects the new mode
    }
  }
}
```

- [ ] **Update the `ProviderContextValue` interface** to reflect async signature:

```typescript
setProviderMode: (mode: 'member' | 'provider') => void | Promise<void>
```

- [ ] **Verify no call sites break** — `ProviderModeSwitcher.tsx` uses `onClick={() => setProviderMode(…)}` which handles both sync and async correctly (fire-and-forget).

---

## Task 5: Frontend — Off-Duty Confirmation

**Files:**
- Modify: `apps/frontend/src/components/ProviderModeSwitcher.tsx`

- [ ] **Add `showConfirm` state and confirmation UI**

```typescript
const [showConfirm, setShowConfirm] = useState(false)

const handleMemberClick = () => {
  if (providerMode === 'provider') {
    setShowConfirm(true)
  } else {
    setProviderMode('member')
  }
}

const confirmOffDuty = () => {
  setShowConfirm(false)
  setProviderMode('member')
}
```

- [ ] **Replace the "Member" button's onClick** with `handleMemberClick`.

- [ ] **Add inline confirmation below the toggle** (only when `showConfirm`):

```tsx
{showConfirm && (
  <div className="off-duty-confirm" style={{ marginTop: 8, fontSize: 12, color: 'rgb(var(--color-text-muted))' }}>
    <p style={{ margin: '0 0 6px' }}>
      Active commitments won't be affected — you'll still fulfil them off-duty.
    </p>
    <div style={{ display: 'flex', gap: 8 }}>
      <button onClick={confirmOffDuty} className="mode-btn" style={{ background: 'rgb(var(--color-primary))', color: 'white', padding: '3px 10px', fontSize: 12 }}>
        Go off-duty
      </button>
      <button onClick={() => setShowConfirm(false)} className="mode-btn" style={{ padding: '3px 10px', fontSize: 12 }}>
        Stay on
      </button>
    </div>
  </div>
)}
```

- [ ] **Verify**: Toggle to Member → confirmation appears. "Go off-duty" confirms. "Stay on" dismisses. "Provider" button still works without confirmation.

---

## Task 6: Frontend — Lift `scheduled_for` Restriction in RequestWizard

**Files:**
- Modify: `apps/frontend/src/components/RequestWizard.tsx`
- Modify: `apps/frontend/src/lib/api.ts`

- [ ] **Remove `scheduled_for` check in `RequestWizard.tsx` (around line 166)**

```typescript
// Before
if (createdRequest?.scheduled_for && createdRequest?.id) {

// After
if (createdRequest?.id) {
```

- [ ] **Pass `requestType` to the dibs candidate fetch**

```typescript
const candidateRes = await dibsService.getDibsCandidate(createdRequest.id, requestType)
```

- [ ] **Update expiry display for non-scheduled requests**

```typescript
let expiresAt: string;
if (createdRequest.scheduled_for) {
  const scheduledMs = new Date(createdRequest.scheduled_for).getTime();
  const leadTimeMs = scheduledMs - Date.now();
  expiresAt = new Date(Date.now() + leadTimeMs * 0.20).toISOString();
} else {
  expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
}
setDibsExpiresAt(expiresAt)
```

- [ ] **Update `getDibsCandidate` in `apps/frontend/src/lib/api.ts`** to accept and append `type` param:

```typescript
getDibsCandidate: (requestId: string, requestType?: string) =>
  api.get(`/requests/${requestId}/dibs-candidate${requestType ? `?type=${requestType}` : ''}`)
```

- [ ] **Verify TypeScript compiles**

```bash
cd apps/frontend && npx tsc --noEmit
```

---

## Task 7: User Guide + Landing Page Docs

**Files:**
- Create: `docs/guides/provider-dibs-guide.md`
- Modify: `docs/guides/provider-mode-guide.md`
- Modify: `docs/guides/using-service-providers-guide.md`
- Modify: `scripts/generate-docs.ts` (add new guide to arrays)
- Run: `cd apps/landing && npm run generate-docs`

- [ ] **Create `docs/guides/provider-dibs-guide.md`** covering:
  - What dibs is: a trusted first-ask before broadcasting
  - How a request gets routed: created → suggestion shown → provider notified → accept/decline → broadcasts if not accepted
  - Where to respond: CommitmentsTab → "Dibs Invitations" section
  - Dibs window: 20% of lead time for scheduled requests, 24 hours for all others

- [ ] **Append to `docs/guides/provider-mode-guide.md`**:
  - "Going Off-Duty" section: what changes (no new requests, no new dibs suggestions), what doesn't (active commitments persist, pending dibs can still be answered)
  - Off-duty confirmation UI: explain the banner that appears

- [ ] **Append to `docs/guides/using-service-providers-guide.md`**:
  - Requester perspective on dibs: after creating any request, if you've worked with someone before, you can send them first dibs
  - How to send: accept the suggestion in the post-creation prompt or skip to broadcast immediately

- [ ] **Add new guide to `scripts/generate-docs.ts`** in `GUIDE_ORDER`, `GUIDE_LABELS`, and `GUIDE_SLUGS` arrays

- [ ] **Regenerate landing docs**

```bash
cd apps/landing && npm run generate-docs
```

- [ ] **Stage new/updated generated files**

```bash
git add -u apps/landing/src/data/docs/
git add -f apps/landing/src/data/docs/guides/provider-dibs.json
```

---

## Task 8: CONTEXT.md + Registry + TDD Test

**Files:**
- Modify: `services/request-service/CONTEXT.md`
- Modify: `services/registry.json`
- Create: `tests/tdd/sprint-50-provider-dibs.test.ts`

- [ ] **Update `services/request-service/CONTEXT.md`** — in the API Endpoints section, note that `GET /requests/:id/dibs-candidate` now accepts `?type=` and `POST /requests/:id/dibs` now works for all request types (not just scheduled).

- [ ] **Update `services/registry.json`** — no new endpoints, but update the description for the dibs candidate endpoint if it mentions "scheduled only".

- [ ] **Create `tests/tdd/sprint-50-provider-dibs.test.ts`**:

```typescript
// Tests for Sprint 50: provider mode + dibs for all request types
// Uses real DB — requires running postgres

describe('Sprint 50 — Provider Mode + Dibs', () => {
  describe('Provider availability sync', () => {
    it('setProviderMode → calls PATCH /providers/:id/availability with is_available=true when switching to provider')
    it('setProviderMode → calls PATCH /providers/:id/availability with is_available=false when switching to member')
  })

  describe('Dibs — all request types', () => {
    it('GET /requests/:id/dibs-candidate returns a candidate for a non-scheduled request')
    it('POST /requests/:id/dibs succeeds for a non-scheduled (ASAP) request')
    it('POST /requests/:id/dibs sets expires_at to ~24h from now for non-scheduled requests')
    it('POST /requests/:id/dibs sets expires_at to 20% of lead time for scheduled requests')
  })

  describe('Mutual aid candidates', () => {
    it('GET /requests/:id/dibs-candidate?type=generic returns a non-provider with prior match history')
    it('GET /requests/:id/dibs-candidate?type=service returns only provider-profile users')
    it('returns null when requester has no prior interactions')
  })

  describe('Off-duty commitment persistence', () => {
    it('toggling provider mode to member does not change status of existing pending dibs')
    it('toggling provider mode to member does not cancel matched requests')
  })
})
```

- [ ] **Run TDD tests** (failures are expected and acceptable in `tests/tdd/`)

```bash
npm run test:tdd -- --testPathPattern=sprint-50
```

---

## Task 9: Verification

- [ ] **Full test suite must pass**

```bash
npm test
```

- [ ] **TDD tests pass**

```bash
npm run test:tdd -- --testPathPattern=sprint-50
```

- [ ] **TypeScript clean across all changed services**

```bash
cd services/request-service && npx tsc --noEmit
cd apps/frontend && npx tsc --noEmit
```

- [ ] **Feedback check passes**

```bash
npm run feedback:check
```

- [ ] **Manual smoke test**:
  - Toggle provider mode on → check network tab shows `PATCH /providers/:id/availability` with `is_available: true`
  - Toggle provider mode off → confirmation appears → confirm → check `is_available: false` in network
  - Create a non-scheduled request → dibs suggestion appears → send dibs → check `requests.dibs` row created with `expires_at ≈ now + 24h`
  - Provider logs in → CommitmentsTab shows the dibs invite → Accept → request moves to matched

---

## Task 10: Merge + Deploy

**Use the `/deploy` skill.**

- [ ] **Commit all changes**

```bash
git add services/request-service/src/routes/dibs.ts \
        services/request-service/src/db/dibsDb.ts \
        services/request-service/src/services/dibsScoringService.ts \
        apps/frontend/src/contexts/ProviderContext.tsx \
        apps/frontend/src/components/ProviderModeSwitcher.tsx \
        apps/frontend/src/components/RequestWizard.tsx \
        apps/frontend/src/lib/api.ts \
        docs/guides/ \
        scripts/generate-docs.ts \
        services/request-service/CONTEXT.md \
        services/registry.json \
        tests/tdd/sprint-50-provider-dibs.test.ts
git add -u apps/landing/src/data/docs/
git commit -m "feat(provider): Sprint 50 — provider on/off duty API sync + dibs for all request types"
```

- [ ] **Merge to master and push**

```bash
git checkout master
git merge feature/sprint-50-provider-dibs
git push origin master
```

- [ ] **Monitor GitHub Actions** — watch for green on all 8 Docker builds + health checks

- [ ] **Verify on karmyq.com** — toggle provider mode, create a non-scheduled request, confirm dibs suggestion appears
