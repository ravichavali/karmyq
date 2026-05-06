# Trust-Path Visibility Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Surface the trust-graph path with real names in DibsPrompt and verify feed card compact badges — giving requesters social proof ("You → Jordan → Alice") that builds confidence to ask.

**Architecture:** The path computation engine, API, frontend component, and hooks are already built in social-graph-service. The sprint wires them into the dibs candidate API response and DibsPrompt modal; feed card badges get verified.

**Tech Stack:** Node.js/Express/TypeScript, Next.js 14, PostgreSQL 15, Bull queue.

---

## File Map

### New files to create
| File | Responsibility |
|------|---------------|
| `services/request-service/tests/tdd/sprint-52-trust-path.test.ts` | Integration test seeding real exchange graph data, verifying trust path in dibs-candidate response |

### Existing files to modify
| File | Change |
|------|--------|
| `services/social-graph-service/src/services/pathComputation.ts` | `MAX_DEPTH` 4 → 3 in `computeShortestPath` |
| `services/request-service/src/routes/dibs.ts` | After selecting best candidate, fetch trust path from social-graph; attach `trustPath` to response |
| `apps/frontend/src/components/requests/DibsPrompt.tsx` | Add `trustPath: TrustPath \| null` to `DibsCandidate`; render `TrustPathBadge` (full) |
| `apps/frontend/src/components/BrowseFeed.tsx` | Verify compact badge renders on request cards; fix gap if found |
| `apps/frontend/src/components/Feed/FeedItem.tsx` | Verify compact badge renders on `open_request` items; fix gap if found |
| `docs/guides/provider-dibs-guide.md` | Add "Trust path" section |
| `services/request-service/CONTEXT.md` | Document updated dibs-candidate response shape |
| `services/registry.json` | Bump `updated` date |

---

## ⚠️ Critical Implementation Notes (read before Task 2)

1. **Internal social-graph URL**: `http://social-graph-service:3010/social-graph/paths/:userId` — the service mounts under `/social-graph`; nginx strips `/api` but not the service prefix.

2. **Forward Authorization header**: The social-graph paths route reads `req.user?.userId` for the path source. Pass `{ headers: { Authorization: req.headers.authorization || '' } }` — exactly as `requests.ts` does for reputation-service.

3. **Non-fatal only**: Wrap the trust path fetch in try/catch with a 3-second AbortController timeout. Default `trustPath: null` on any error. DibsPrompt must render correctly with `trustPath: null`.

4. **Only `computeShortestPath` changes depth**: `MAX_DEPTH` lives inside `computeShortestPath`. `computeCommunityPath` and `computeInvitationPath` have separate limits — don't touch them.

5. **Pre-existing TDD failures**: `sprint-39-provider-ux`, `sprint-43-feed-ranking`, and schema tests fail before this sprint. Do NOT fix. New test goes in `services/request-service/tests/tdd/`.

---

## Task 1: Branch + Depth Cap

**Files:**
- Create branch: `feature/sprint-52-trust-path-visibility`
- Modify: `services/social-graph-service/src/services/pathComputation.ts`

- [ ] **Create feature branch**

```bash
git checkout -b feature/sprint-52-trust-path-visibility
```

- [ ] **Cap `MAX_DEPTH` at 3 in `computeShortestPath`**

In `pathComputation.ts`, change:
```typescript
const MAX_DEPTH = 4;
```
to:
```typescript
const MAX_DEPTH = 3;
```

- [ ] **Verify `TrustPathBadge` is already consistent with 3-hop cap**

Confirm this line exists in `TrustPathBadge.tsx` (it does — no change needed):
```typescript
if (degrees_of_separation > 3) {
  return null;
}
```

---

## Task 2: Dibs Candidate API — Attach Trust Path

**Files:**
- Modify: `services/request-service/src/routes/dibs.ts`

- [ ] **After selecting the best candidate, fetch trust path from social-graph**

In `GET /:id/dibs-candidate`, after `const candidate = ... await getMutualAidBestCandidate(...)`:

```typescript
let trustPath: object | null = null;

if (candidate) {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    const pathRes = await fetch(
      `${process.env.SOCIAL_GRAPH_API_URL || 'http://social-graph-service:3010'}/social-graph/paths/${candidate.providerUserId}`,
      {
        headers: { Authorization: req.headers.authorization || '' },
        signal: controller.signal,
      }
    );
    clearTimeout(timeout);
    if (pathRes.ok) {
      const pathData = await pathRes.json() as { success: boolean; data?: object };
      if (pathData.success && pathData.data) {
        trustPath = pathData.data;
      }
    }
  } catch {
    // Non-fatal — trust path is enhancement only
  }
}

return res.json({ success: true, data: candidate ? { ...candidate, trustPath } : null });
```

- [ ] **Verify the existing `return res.json({ success: true, data: candidate })` is replaced** — there must be exactly one return for the happy path.

---

## Task 3: Frontend — DibsPrompt Trust Path Badge

**Files:**
- Modify: `apps/frontend/src/components/requests/DibsPrompt.tsx`

- [ ] **Add `trustPath` to `DibsCandidate` interface**

```typescript
import TrustPathBadge, { TrustPath } from '../TrustPathBadge'

export interface DibsCandidate {
  providerUserId: string
  displayName: string
  score: number
  trustScore: number
  priorInteractions: number
  trustGraphConnection: 'direct' | 'indirect' | 'none'
  trustPath: TrustPath | null
}
```

- [ ] **Replace `trustContextSummary()` subtitle with `TrustPathBadge` (full)**

In the candidate card section, replace:
```tsx
<p className="text-xs text-text-muted">
  {trustContextSummary(candidate.priorInteractions, candidate.trustGraphConnection)}
</p>
```

with:
```tsx
{candidate.trustPath ? (
  <TrustPathBadge trustPath={candidate.trustPath} className="mt-2" />
) : (
  <p className="text-xs text-text-muted">
    {trustContextSummary(candidate.priorInteractions, candidate.trustGraphConnection)}
  </p>
)}
```

- [ ] **Verify `trustContextSummary` is still defined** — keep the function; it's the fallback when `trustPath` is null.

---

## Task 4: Frontend — Verify Feed Card Compact Badges

**Files:**
- Modify: `apps/frontend/src/components/BrowseFeed.tsx` (if gaps found)
- Modify: `apps/frontend/src/components/Feed/FeedItem.tsx` (if gaps found)

- [ ] **Read BrowseFeed.tsx** — verify the request card sub-component calls `useTrustPath(requester.id)` and renders `<TrustPathBadge trustPath={trustPath} compact />`. If missing, add it alongside the requester's name.

- [ ] **Read Feed/FeedItem.tsx** — verify `OpenRequestItem` renders `<TrustPathBadge trustPath={trustPath} compact />`. Confirm loading state uses `<TrustPathBadgeSkeleton compact />`.

- [ ] **If either badge is missing entirely**, wire it following this pattern:
```tsx
const { trustPath, loading: pathLoading } = useTrustPath(data.requester_id)
// In render:
{pathLoading ? <TrustPathBadgeSkeleton compact /> : trustPath ? <TrustPathBadge trustPath={trustPath} compact /> : null}
```

---

## Task 5: User Guide + Landing Page Docs

**Files:**
- Modify: `docs/guides/provider-dibs-guide.md`
- Run: `cd apps/landing && npm run generate-docs`

- [ ] **Add "Trust path" section to provider-dibs-guide.md** after the "Trust context" section:

```markdown
## Trust path

When reviewing a dibs candidate, you'll see how you're connected to them through your exchange network. For example, "You → Jordan → Alice" means Jordan has exchanged help with both you and Alice — Alice comes recommended through a shared connection, not as a stranger.

- **Direct connection**: You and this person have exchanged help before.
- **2° connection**: You share a mutual exchange partner.
- **3° connection**: You are three exchanges apart in the network.

The path updates as your network grows. If no path is shown, the candidate was selected through a direct social-graph connection even without prior exchanges.
```

- [ ] **Regenerate landing site docs**

```bash
cd apps/landing && npm run generate-docs
```

- [ ] **Verify the guide appears in the landing site nav** by checking `apps/landing/src/data/docs/guides/provider-dibs-guide.json` was regenerated.

---

## Task 6: CONTEXT.md + Registry

**Files:**
- Modify: `services/request-service/CONTEXT.md`
- Modify: `services/registry.json`

- [ ] **Update `services/request-service/CONTEXT.md`** — in the "API Endpoints" section, update `GET /requests/:id/dibs-candidate`:

```
GET /requests/:id/dibs-candidate
  Returns top-scored dibs candidate for the request.
  Response: { providerId, providerUserId, displayName, score, trustScore,
              priorInteractions, trustGraphConnection, trustPath }
  trustPath: TrustPath | null — fetched from social-graph-service; null if
             no path found or social-graph unavailable. Non-fatal degradation.
```

- [ ] **Bump `updated` date in `services/registry.json`** to 2026-05-06.

---

## Task 7: Integration Test with Real Graph Data

**Files:**
- Create: `services/request-service/tests/tdd/sprint-52-trust-path.test.ts`

- [ ] **Write integration test that seeds real exchange data and verifies trust path in dibs-candidate response**

The test must:
1. Seed `auth.users` — requester, intermediate user ("Jordan"), candidate
2. Seed `requests.help_requests` + `requests.matches` (status: `completed`) to create exchange edges:
   - Requester ↔ Jordan (prior exchange)
   - Jordan ↔ Candidate (prior exchange)
3. Seed `requests.provider_profiles` for the candidate (is_available: true)
4. Call `GET /requests/:requestId/dibs-candidate` as the requester
5. Assert response includes `trustPath` with:
   - `degrees_of_separation: 2`
   - `path[0].name` = requester's name (or "You")
   - `path[1].name` = "Jordan"
   - `path[2].name` = candidate's display name

Reference pattern: `services/social-graph-service/tests/integration/paths.test.ts`

```typescript
describe('Sprint 52 — Trust Path in Dibs Candidate', () => {
  it('returns 2-degree trust path when requester and candidate share a mutual exchange', async () => {
    // Seed users, exchanges, provider profile
    // Call GET /requests/:id/dibs-candidate
    // Assert trustPath.degrees_of_separation === 2
    // Assert trustPath.path[1].name === 'Jordan'
  });

  it('returns 1-degree trust path for explore-tier direct connection', async () => {
    // Seed direct exchange between requester and candidate
    // Seed social_graph.connections type='exchange'
    // Assert trustPath.degrees_of_separation === 1
  });

  it('returns trustPath: null gracefully when social-graph is unreachable', async () => {
    // Mock social-graph fetch to throw
    // Assert response still has candidate data with trustPath: null
  });
});
```

- [ ] **Run the test**

```bash
cd services/request-service && npm run test:tdd
```

---

## Task 8: Type Check + Pre-Push Verification

**Files:** None

- [ ] **TypeScript check for both changed services**

```bash
cd services/request-service && npx tsc --noEmit
cd services/social-graph-service && npx tsc --noEmit
cd apps/frontend && npx tsc --noEmit
```

- [ ] **Run unit + regression tests**

```bash
npm test
```

- [ ] **Run TDD tests**

```bash
npm run test:tdd
```

- [ ] **Run feedback check**

```bash
npm run feedback:check
```

- [ ] **Confirm no new test failures** (pre-existing failures in sprint-39, sprint-43, schema tests are expected)

---

## Task 9: Merge + Deploy

- [ ] **Run pre-commit check skill** (`/pre-commit-check`)
- [ ] **Commit all changes**

```bash
git add services/social-graph-service/src/services/pathComputation.ts
git add services/request-service/src/routes/dibs.ts
git add apps/frontend/src/components/requests/DibsPrompt.tsx
git add apps/frontend/src/components/BrowseFeed.tsx
git add apps/frontend/src/components/Feed/FeedItem.tsx
git add services/request-service/tests/tdd/sprint-52-trust-path.test.ts
git add docs/guides/provider-dibs-guide.md
git add apps/landing/src/data/docs/
git add services/request-service/CONTEXT.md
git add services/registry.json
git commit -m "feat(dibs): Sprint 52 — trust-path visibility in DibsPrompt + feed cards"
```

- [ ] **Merge to master and push**

```bash
git checkout master
git merge feature/sprint-52-trust-path-visibility
git push origin master
```

- [ ] **Monitor GitHub Actions** — deployment to karmyq.com is automatic on push to master
- [ ] **Verify on demo**: Create a scheduled request, confirm DibsPrompt shows trust path with names; browse feed and confirm compact path badges appear on request cards
- [ ] **Update handoff** with sprint complete status and Sprint 53 candidates
