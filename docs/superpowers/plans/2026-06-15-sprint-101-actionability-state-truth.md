# Actionability + State Truth Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make every request surface state the lifecycle truth and offer the next real action for the
current member.

**Architecture:** Extend the existing request-service read models instead of adding a new service:
Home feed returns a small per-item pending-offer preview, and `/requests/:id` becomes the canonical
viewer-aware request detail read. The frontend keeps the canonical `RequestCard`, adds a request
detail action page, and makes Asks/Community copy state-aware.

**Tech Stack:** Node.js/Express/TypeScript, Next.js 14/15 Pages Router, PostgreSQL 15, Bull queue.

---

## File Map

### New files to create

| File | Responsibility |
|---|---|
| `apps/frontend/src/components/Feed/OfferedAwaitingPanel.tsx` | Compact Home preview of open asks the member has already offered to help on |
| `apps/frontend/tests/tdd/sprint-101-offered-awaiting-items.test.tsx` | Frontend TDD for per-item Home preview |
| `apps/frontend/tests/tdd/sprint-101-request-detail-action.test.tsx` | Frontend TDD for actionable `/requests/[id]` detail |
| `apps/frontend/tests/tdd/sprint-101-asks-state-copy.test.tsx` | Frontend TDD for lifecycle-aware Asks expansion copy |
| `services/request-service/tests/tdd/sprint-101-actionability-state.test.ts` | Request-service TDD for `offeredAwaitingItems` and request detail viewer relation |

### Existing files to modify

| File | Change |
|---|---|
| `package.json` | Version bump `11.9.0` -> `11.10.0` |
| `services/request-service/src/routes/requests.ts` | Add pending-offer item read model and viewer relation on `GET /requests/:id` |
| `services/request-service/CONTEXT.md` | Document Sprint 101 API contract updates |
| `services/registry.json` | Update request-service endpoint descriptions if contract wording changes |
| `apps/frontend/src/types/unified-feed.ts` | Add `OfferedAwaitingItem` / response typing |
| `apps/frontend/src/components/Feed/UnifiedFeed.tsx` | Render `OfferedAwaitingPanel` instead of count-only band |
| `apps/frontend/src/pages/requests/[id].tsx` | Replace redirect with real detail/action page |
| `apps/frontend/src/pages/communities/[id]/open-asks.tsx` | Clarify that opening an ask is the action path; remove misleading read-only implication |
| `apps/frontend/src/components/community/tabs/BrowseTab.tsx` | Replace unclear "calm queue" copy with literal open-ask copy |
| `apps/frontend/src/components/MyRequestsTab.tsx` | State-aware expanded copy |
| `apps/frontend/src/lib/onboarding/workflows.ts` | Update feed/community/request workflow copy |
| `apps/frontend/CONTEXT.md` | Record Sprint 101 frontend behavior |
| `apps/frontend/src/components/graphs/CommunityDepthGraph.tsx` | Bounded deterministic ordering spike if simple |
| `apps/landing/src/data/docs/guides/*.json` | Update affected user guides |

---

## Critical Implementation Notes

1. **Do not scatter router mocks.** `RequestCard` and `/requests/[id]` use Next routing. The global
   `apps/frontend/jest.setup.js` `next/router` mock already exists; preserve it and use per-file mocks
   only when a test needs a custom `push`/`replace` spy.
2. **Keep keyboard navigation guarded.** Click `stopPropagation` is not enough: `RequestCard`
   `onKeyDown` must keep `e.target === e.currentTarget` so Enter/Space on inner controls does not
   also navigate.
3. **Request detail is the action surface.** Do not send community open-ask clicks to Asks/Helping as
   a substitute for detail. `/requests/[id]` should show the ask and the next valid action.
4. **Pending responder offers are not decisions.** They await the requester. Surface them as "offered
   awaiting" items, not in the "Needs your response" decision band.
5. **Count and items must agree.** `offeredAwaiting` should count distinct open asks; preview items
   should be selected from the same predicate and deduped by request.
6. **State copy must be lifecycle-aware.** "No offers yet" is valid only for an open ask. Completed,
   matched, cancelled, or expired asks need different copy.
7. **Open-asks semantics stay community-wide.** The pulse/open-asks page includes own asks and
   already-offered asks for count reachability; action eligibility is handled by the detail page.
8. **No client-side truth workaround for server state.** Viewer relation (`own_request`,
   `already_offered`, `can_offer`, `not_actionable`) must be derived server-side for request detail.
   `can_offer` means the ask is open, unexpired, not the viewer's own request, the viewer has no live
   proposed/matched responder match, and the viewer is an active member of at least one request
   community. Expired or non-member open asks are `not_actionable`, not optimistic buttons that 403.
9. **Graph layout is bounded.** Try deterministic ordering only if it is simple and formulaic. Do not
   hand-place nodes or invent a tedious pattern.
10. **Docs are part of done.** User guides, onboarding copy, frontend context, and API docs (if
    contracts change) ship with the sprint.
11. **Moderate dependency advisories remain secondary.** Clean them only if low-risk and not at the
    expense of the product truth work; high/critical audit gate still blocks per ADR-059.

---

## Task 1: Branch, Baseline, and Version

**Files:**
- Modify: `package.json`

- [ ] Create the sprint branch.

```powershell
git checkout -b feature/sprint-101-actionability-state-truth
```

- [ ] Confirm the working tree before edits.

```powershell
git status --short
```

Expected: only known planning/handoff files should be dirty at sprint start.

- [ ] Bump root version.

In `package.json`, change:

```json
"version": "11.9.0"
```

to:

```json
"version": "11.10.0"
```

- [ ] Run a baseline frontend TDD sample that already mounts `RequestCard` to confirm the global
router mock remains healthy.

```powershell
cd apps/frontend
npx jest tests/tdd/sprint-100-request-card-clickable.test.tsx --runInBand
```

Expected: passes before Sprint 101 changes.

- [ ] Commit.

```powershell
git add package.json
git commit -m "chore: start Sprint 101 actionability state truth"
```

---

## Task 2: Request-Service TDD for Pending Offer Items and Detail Viewer State

**Files:**
- Create: `services/request-service/tests/tdd/sprint-101-actionability-state.test.ts`
- Modify: `services/request-service/src/routes/requests.ts`

- [ ] Write the failing test for `GET /requests/curated?view=home`.

Test shape:

```ts
it('returns offeredAwaitingItems from the same distinct-open-ask predicate as offeredAwaiting', async () => {
  const res = await request(appAs(helperId)).get('/requests/curated').query({ view: 'home', minScore: 0 });

  expect(res.status).toBe(200);
  expect(res.body.data.offeredAwaiting).toBe(1);
  expect(res.body.data.offeredAwaitingItems).toHaveLength(1);
  expect(res.body.data.offeredAwaitingItems[0]).toEqual(expect.objectContaining({
    request_id: awaitingRequestId,
    match_id: expect.any(String),
    status: 'proposed',
    title: 'Ceiling fan install',
  }));
});
```

Seed two `requests.matches` rows for the same helper/request if possible to prove the count is
distinct by `request_id` and the preview dedupes to one item.

- [ ] Write the failing test for `GET /requests/:id` viewer relation.

Test cases:

```ts
expect(own.body.data.viewer_relation).toBe('own_request');
expect(alreadyOffered.body.data.viewer_relation).toBe('already_offered');
expect(canOffer.body.data.viewer_relation).toBe('can_offer');
expect(completed.body.data.viewer_relation).toBe('not_actionable');
expect(expiredOpen.body.data.viewer_relation).toBe('not_actionable');
expect(nonMemberOpen.body.data.viewer_relation).toBe('not_actionable');
```

Also assert `viewer_match` is present for `already_offered` with `{ id, status: 'proposed' }`.
Seed the `can_offer` viewer as an active member of at least one `request_communities` community, and
seed the `nonMemberOpen` case without that membership so the server proves eligibility instead of
letting the UI discover a 403 after click.

- [ ] Run the new test and verify it fails.

```powershell
cd services/request-service
npx jest tests/tdd/sprint-101-actionability-state.test.ts --runInBand
```

Expected: fails because `offeredAwaitingItems` and `viewer_relation` do not exist yet.

---

## Task 3: Implement Request-Service Read Models

**Files:**
- Modify: `services/request-service/src/routes/requests.ts`
- Modify: `services/request-service/tests/tdd/sprint-101-actionability-state.test.ts`

- [ ] Replace `countOfferedAwaiting(userId)` with a shared read helper.

Add an internal return type:

```ts
interface OfferedAwaitingItem {
  match_id: string;
  request_id: string;
  title: string;
  description: string;
  author_name: string;
  community_id?: string;
  community_name?: string;
  urgency?: string;
  request_type?: string;
  payload_type?: string;
  payload?: unknown;
  requirements?: unknown;
  status: 'proposed';
  offered_at: string;
}
```

Implement:

```ts
async function fetchOfferedAwaiting(userId: string, previewLimit = 3): Promise<{ count: number; items: OfferedAwaitingItem[] }> {
  const countResult = await query(/* same DISTINCT m.request_id predicate */, [userId]);
  const itemResult = await query(/* DISTINCT ON (m.request_id), ORDER BY m.request_id, m.created_at DESC */, [userId, previewLimit]);
  return { count: Number(countResult.rows[0]?.n) || 0, items: itemResult.rows.map(mapOfferedAwaitingRow) };
}
```

Predicate must stay:

```sql
m.responder_id = $1
AND m.status = 'proposed'
AND hr.status = 'open'
AND hr.expired = FALSE
```

- [ ] Update `respondHomeFeed`.

```ts
const [decisionItems, offeredAwaiting] = await Promise.all([
  fetchDecisions(req, userId),
  fetchOfferedAwaiting(userId),
]);

sendSuccess(res, {
  items,
  count: items.length,
  offeredAwaiting: offeredAwaiting.count,
  offeredAwaitingItems: offeredAwaiting.items,
}, HTTP_STATUS.OK, { requestId: (req as any).id });
```

- [ ] Enrich `GET /requests/:id`.

Add a viewer relation helper:

```ts
type ViewerRelation = 'own_request' | 'already_offered' | 'can_offer' | 'not_actionable';
```

For authenticated `req.user.userId`:

```sql
LEFT JOIN LATERAL (
  SELECT id, status, created_at
  FROM requests.matches
  WHERE request_id = r.id
    AND responder_id = $2
    AND status IN ('proposed', 'matched')
  ORDER BY created_at DESC
  LIMIT 1
) viewer_match ON TRUE
LEFT JOIN LATERAL (
  SELECT TRUE AS is_active_member
  FROM requests.request_communities rc2
  JOIN communities.members cm
    ON cm.community_id = rc2.community_id
   AND cm.user_id = $2
   AND cm.status = 'active'
  WHERE rc2.request_id = r.id
  LIMIT 1
) viewer_membership ON TRUE
```

Derive:

```ts
const isOpenAndUnexpired = row.status === 'open' && row.expired === false;
const isEligibleCommunityMember = row.is_active_member === true;
const relation =
  row.requester_id === userId ? 'own_request'
  : row.viewer_match_id ? 'already_offered'
  : isOpenAndUnexpired && isEligibleCommunityMember ? 'can_offer'
  : 'not_actionable';
```

The detail query must select `r.expired` so open-but-expired asks never show an Offer button.

- [ ] Run the service TDD test.

```powershell
cd services/request-service
npx jest tests/tdd/sprint-101-actionability-state.test.ts --runInBand
```

Expected: passes.

- [ ] Commit.

```powershell
git add services/request-service/src/routes/requests.ts services/request-service/tests/tdd/sprint-101-actionability-state.test.ts
git commit -m "feat(requests): surface pending offer items and viewer state"
```

---

## Task 4: Frontend TDD for Home Offered-Awaiting Preview

**Files:**
- Create: `apps/frontend/tests/tdd/sprint-101-offered-awaiting-items.test.tsx`
- Create: `apps/frontend/src/components/Feed/OfferedAwaitingPanel.tsx`
- Modify: `apps/frontend/src/components/Feed/UnifiedFeed.tsx`
- Modify: `apps/frontend/src/types/unified-feed.ts`

- [ ] Write the failing test.

```tsx
it('renders the offered-awaiting preview items and links to each request detail', async () => {
  getCuratedRequests.mockResolvedValue({
    data: {
      items: [],
      offeredAwaiting: 4,
      offeredAwaitingItems: [
        { request_id: 'r1', match_id: 'm1', title: 'Hang a ceiling fan', community_name: 'North Portland', status: 'proposed', offered_at: '2026-06-15T12:00:00Z' },
        { request_id: 'r2', match_id: 'm2', title: 'Ride to appointment', community_name: 'Hawthorne', status: 'proposed', offered_at: '2026-06-15T13:00:00Z' },
      ],
    },
  });

  render(<UnifiedFeed view="home" />);

  expect(await screen.findByText(/You've offered to help on 4 open asks/i)).toBeInTheDocument();
  expect(screen.getByRole('link', { name: /Hang a ceiling fan/i })).toHaveAttribute('href', '/requests/r1');
  expect(screen.getByRole('link', { name: /Ride to appointment/i })).toHaveAttribute('href', '/requests/r2');
  expect(screen.getByText(/View all in Helping/i).closest('a')).toHaveAttribute('href', '/dashboard?tab=helping');
});
```

- [ ] Add a regression assertion that no per-file router mock is required for the default render path.

Use the global `apps/frontend/jest.setup.js` mock unless the test needs a custom spy.

- [ ] Run and verify failure.

```powershell
cd apps/frontend
npx jest tests/tdd/sprint-101-offered-awaiting-items.test.tsx --runInBand
```

Expected: fails until the component is implemented.

---

## Task 5: Implement OfferedAwaitingPanel

**Files:**
- Create: `apps/frontend/src/components/Feed/OfferedAwaitingPanel.tsx`
- Modify: `apps/frontend/src/components/Feed/UnifiedFeed.tsx`
- Modify: `apps/frontend/src/types/unified-feed.ts`

- [ ] Add the type.

```ts
export interface OfferedAwaitingItem {
  match_id: string
  request_id: string
  title: string
  description?: string
  author_name?: string
  community_id?: string
  community_name?: string
  urgency?: UrgencyLevel
  request_type?: string
  payload_type?: PayloadType
  status: 'proposed'
  offered_at?: string
}
```

- [ ] Add `OfferedAwaitingPanel`.

Render:

- headline: `You've offered to help on N open asks`
- subcopy: `Waiting for the requester to respond.`
- top preview rows linked to `/requests/{request_id}`
- trailing link to `/dashboard?tab=helping`
- singular/plural copy for 1 ask

- [ ] Replace the count-only band in `UnifiedFeed`.

Keep Home-only guard:

```tsx
{!isCommunity && offeredAwaiting > 0 && (
  <OfferedAwaitingPanel count={offeredAwaiting} items={offeredAwaitingItems} />
)}
```

- [ ] Run the new frontend test.

```powershell
cd apps/frontend
npx jest tests/tdd/sprint-101-offered-awaiting-items.test.tsx --runInBand
```

Expected: passes.

- [ ] Run the Sprint 100 G1 regression.

```powershell
cd apps/frontend
npx jest tests/tdd/sprint-100-g1-offered-band.test.tsx --runInBand
```

Expected: update assertions if copy changed, but preserve the behavior: Home-only, positive count only.

- [ ] Commit.

```powershell
git add apps/frontend/src/components/Feed/OfferedAwaitingPanel.tsx apps/frontend/src/components/Feed/UnifiedFeed.tsx apps/frontend/src/types/unified-feed.ts apps/frontend/tests/tdd/sprint-101-offered-awaiting-items.test.tsx apps/frontend/tests/tdd/sprint-100-g1-offered-band.test.tsx
git commit -m "feat(frontend): show pending offer preview items on home"
```

---

## Task 6: Frontend TDD for Actionable Request Detail

**Files:**
- Create: `apps/frontend/tests/tdd/sprint-101-request-detail-action.test.tsx`
- Modify: `apps/frontend/src/pages/requests/[id].tsx`

- [ ] Write tests for the four viewer states.

Mock `useRouter` locally because this page must read `query.id` and assert `replace` is no longer
called:

```tsx
const replace = jest.fn();
jest.mock('next/router', () => ({
  useRouter: () => ({ query: { id: 'r1' }, replace, push: jest.fn(), isReady: true }),
}));
```

Cases:

```tsx
it('offers help when viewer_relation is can_offer', async () => {
  localStorage.setItem('user', JSON.stringify({ id: 'me' }));
  getRequest.mockResolvedValue({ data: detail({ viewer_relation: 'can_offer' }) });
  createMatch.mockResolvedValue({});

  render(<RequestDetailPage />);
  fireEvent.click(await screen.findByRole('button', { name: /Offer to Help/i }));

  await waitFor(() => expect(createMatch).toHaveBeenCalledWith({ request_id: 'r1', responder_id: 'me' }));
  expect(replace).not.toHaveBeenCalledWith('/dashboard?tab=helping');
});

it('shows awaiting requester response when viewer already offered', async () => {
  getRequest.mockResolvedValue({ data: detail({ viewer_relation: 'already_offered', viewer_match: { id: 'm1', status: 'proposed' } }) });
  render(<RequestDetailPage />);
  expect(await screen.findByText(/waiting for the requester/i)).toBeInTheDocument();
});

it('points own requests to Asks without showing Offer', async () => {
  getRequest.mockResolvedValue({ data: detail({ viewer_relation: 'own_request' }) });
  render(<RequestDetailPage />);
  expect(await screen.findByText(/This is your ask/i)).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /Offer/i })).not.toBeInTheDocument();
});

it('renders completed requests as finite state', async () => {
  getRequest.mockResolvedValue({ data: detail({ status: 'completed', viewer_relation: 'not_actionable' }) });
  render(<RequestDetailPage />);
  expect(await screen.findByText(/This ask is completed/i)).toBeInTheDocument();
});
```

Add `beforeEach(() => { localStorage.clear(); replace.mockClear(); createMatch.mockClear(); })` so
the responder id arrangement is explicit and tests do not pass/fail based on leaked localStorage.

- [ ] Run and verify failure.

```powershell
cd apps/frontend
npx jest tests/tdd/sprint-101-request-detail-action.test.tsx --runInBand
```

Expected: fails because the page still redirects.

---

## Task 7: Implement Request Detail Page

**Files:**
- Modify: `apps/frontend/src/pages/requests/[id].tsx`
- Modify: `apps/frontend/src/pages/communities/[id]/open-asks.tsx`
- Modify: `apps/frontend/src/components/community/tabs/BrowseTab.tsx`

- [ ] Replace the redirect page with a real detail page.

Required behaviors:

- read `localStorage.user` defensively for `currentUserId`
- fetch `requestService.getRequest(id)` once `router.isReady`
- show loading/error/404 states
- render title, requester, community, urgency/status, description, and payload details via `RequestPayloadRenderer`
- call `requestService.createMatch({ request_id: id, responder_id: currentUserId })` for `can_offer`
- after offer success, show "Offer sent — track it in Helping" with link
- label `request_type === 'service'` as "Offer service" while still using the same `createMatch`
  mutation as `RequestCard`; priced provider offers (`provider.offers`) stay in the existing provider
  offer flow and are out of scope for this detail page

- [ ] Use state-specific action copy.

| `viewer_relation` | UI |
|---|---|
| `can_offer` | Offer to Help / Offer service button |
| `already_offered` | "You've offered to help. Waiting for the requester to respond." + Helping link |
| `own_request` | "This is your ask." + Asks link |
| `not_actionable` | Completed/cancelled/matched finite copy, no fake action |

- [ ] Update community open-asks copy.

Change copy from "browse-only" implication to:

```text
Open an ask to see details and the action available to you.
```

Keep count reachability intact; the page can still include own/already-offered asks.

- [ ] Replace `BrowseTab` lede.

Use literal copy such as:

```tsx
<p className="kq-lede">Open asks from this community. Open one to see details and the action available to you.</p>
```

- [ ] Run tests.

```powershell
cd apps/frontend
npx jest tests/tdd/sprint-101-request-detail-action.test.tsx tests/tdd/sprint-100-request-card-clickable.test.tsx --runInBand
```

Expected: passes; clickable card behavior remains intact.

- [ ] Commit.

```powershell
git add apps/frontend/src/pages/requests/[id].tsx apps/frontend/src/pages/communities/[id]/open-asks.tsx apps/frontend/src/components/community/tabs/BrowseTab.tsx apps/frontend/tests/tdd/sprint-101-request-detail-action.test.tsx
git commit -m "feat(frontend): restore actionable request detail"
```

---

## Task 8: State-Aware Asks Expansion

**Files:**
- Create: `apps/frontend/tests/tdd/sprint-101-asks-state-copy.test.tsx`
- Modify: `apps/frontend/src/components/MyRequestsTab.tsx`

- [ ] Write failing tests for expansion copy.

Cases:

```tsx
it('says no offers yet only for open asks with no offers', async () => {
  render(<MyRequestsTab onNewRequest={jest.fn()} />);
  fireEvent.click(await screen.findByText('Open ask'));
  expect(screen.getByText(/No offers yet/i)).toBeInTheDocument();
});

it('does not say no offers yet for completed asks', async () => {
  render(<MyRequestsTab onNewRequest={jest.fn()} />);
  fireEvent.click(await screen.findByText('Completed ask'));
  expect(screen.queryByText(/No offers yet/i)).not.toBeInTheDocument();
  expect(screen.getByText(/This ask is completed/i)).toBeInTheDocument();
});
```

- [ ] Implement a small helper in `MyRequestsTab.tsx`.

```ts
function emptyOfferCopy(status: string): string {
  switch (status) {
    case 'open': return 'No offers yet.';
    case 'completed': return 'This ask is completed.';
    case 'matched': return 'This ask is already matched.';
    case 'cancelled': return 'This ask was cancelled.';
    default: return 'No active offers for this ask.';
  }
}
```

- [ ] Render the helper when `offers.length === 0`.

- [ ] Guard localStorage parsing while in the file.

Use try/catch like the rest of the frontend, so malformed `localStorage.user` cannot crash Asks.

- [ ] Run tests.

```powershell
cd apps/frontend
npx jest tests/tdd/sprint-101-asks-state-copy.test.tsx --runInBand
```

Expected: passes.

- [ ] Commit.

```powershell
git add apps/frontend/src/components/MyRequestsTab.tsx apps/frontend/tests/tdd/sprint-101-asks-state-copy.test.tsx
git commit -m "fix(frontend): make asks expansion state aware"
```

---

## Task 9: Bounded Graph Layout Spike

**Files:**
- Modify: `apps/frontend/src/components/graphs/CommunityDepthGraph.tsx`
- Modify: `apps/frontend/src/components/graphs/TrustGraphHEB.tsx` only if a simple deterministic ordering helps
- Modify: `apps/landing/src/data/docs/guides/trust-graph.json`

- [ ] Inspect current layout behavior.

Community depth graph currently places nodes in API order around a circle. HEB clusters nodes by
strong edges and bundles links; crossings can still happen because graph topology is dense.

- [ ] Try simple deterministic ordering for `CommunityDepthGraph`.

Before assigning circular positions, first compute degree from the current `data.links` shape because
`DepthNode` does not carry degree:

```ts
const degreeById = new Map<string, number>();
data.nodes.forEach((node) => degreeById.set(node.id, 0));
data.links.forEach((link) => {
  degreeById.set(link.source, (degreeById.get(link.source) ?? 0) + 1);
  degreeById.set(link.target, (degreeById.get(link.target) ?? 0) + 1);
});
```

Then sort:

```ts
const orderedNodes = [...data.nodes].sort((a, b) => {
  const memberDiff = Number(b.is_member) - Number(a.is_member);
  if (memberDiff) return memberDiff;
  const degreeDiff = (degreeById.get(b.id) ?? 0) - (degreeById.get(a.id) ?? 0);
  if (degreeDiff) return degreeDiff;
  return a.name.localeCompare(b.name);
});
```

Then lay out `orderedNodes`.

If `source`/`target` are ever returned as objects instead of ids, normalize them before counting. Do
not commit the sort if the current data shape cannot support it clearly.

- [ ] For HEB, do not overfit.

Only change ordering if a simple sort by cluster then degree then name reduces label churn. If not,
leave rendering alone and document:

```text
Trust graph crossings are reduced by hierarchical edge bundling but cannot be eliminated formulaically
without changing topology or hand-placing nodes.
```

- [ ] Add or update a lightweight test if there is already a graph unit test pattern. Otherwise,
verify by `tsc --noEmit` and document the decision in the guide/context.

- [ ] Commit.

```powershell
git add apps/frontend/src/components/graphs/CommunityDepthGraph.tsx apps/frontend/src/components/graphs/TrustGraphHEB.tsx apps/landing/src/data/docs/guides/trust-graph.json
git commit -m "chore(frontend): bound graph layout ordering"
```

If no graph code changes are made, commit only the docs/context decision with a message like:

```powershell
git commit -m "docs: record bounded graph layout decision"
```

---

## Task 10: User Guides, Onboarding, and Context Docs

**Files:**
- Modify: `apps/frontend/src/lib/onboarding/workflows.ts`
- Modify: `apps/frontend/CONTEXT.md`
- Modify: `services/request-service/CONTEXT.md`
- Modify: `services/registry.json`
- Modify: `apps/landing/src/data/docs/guides/dashboard-home.json`
- Modify: `apps/landing/src/data/docs/guides/fulfilling-requests.json`
- Modify: `apps/landing/src/data/docs/guides/making-requests.json`
- Modify: `apps/landing/src/data/docs/guides/managing-commitments.json`
- Modify: `apps/landing/src/data/docs/guides/match-lifecycle.json`
- Modify: `apps/landing/src/data/docs/guides/trust-graph.json`

- [ ] Update onboarding workflow copy.

Mention:

- Home shows pending offers as item previews.
- Opening a request card goes to detail, where action eligibility is clear.
- Community Home/open asks are open asks, not completed interaction samples.

- [ ] Update landing user guides listed above.

Use source JSON files directly because these are the checked-in docs data in this repo.

- [ ] Update frontend context with a Sprint 101 section.

Include:

- `OfferedAwaitingPanel`
- actionable `/requests/[id]`
- Asks state-aware empty copy
- router mock guardrail
- graph layout outcome

- [ ] Update request-service context and registry if API response fields changed.

`services/registry.json` request-service `GET /requests/curated` description should mention:

```text
Sprint 101: view=home also carries offeredAwaitingItems, a small preview list of open asks the
member has already offered on and awaits response.
```

`GET /requests/:id` should mention `viewer_relation`.

- [ ] Verify nav did not silently revert.

```powershell
rg -n "dashboard-home|fulfilling-requests|making-requests|managing-commitments|match-lifecycle|trust-graph" apps/landing/src/data/docs/nav.json
```

- [ ] Commit.

```powershell
git add apps/frontend/src/lib/onboarding/workflows.ts apps/frontend/CONTEXT.md services/request-service/CONTEXT.md services/registry.json apps/landing/src/data/docs/guides/dashboard-home.json apps/landing/src/data/docs/guides/fulfilling-requests.json apps/landing/src/data/docs/guides/making-requests.json apps/landing/src/data/docs/guides/managing-commitments.json apps/landing/src/data/docs/guides/match-lifecycle.json apps/landing/src/data/docs/guides/trust-graph.json
git commit -m "docs: update request actionability guides"
```

---

## Task 11: Targeted Verification

**Files:**
- Verify only

- [ ] Run request-service TDD.

```powershell
cd services/request-service
npx jest tests/tdd/sprint-101-actionability-state.test.ts --runInBand
```

- [ ] Run frontend Sprint 101 and touched-regression tests.

```powershell
cd apps/frontend
npx jest tests/tdd/sprint-101-offered-awaiting-items.test.tsx tests/tdd/sprint-101-request-detail-action.test.tsx tests/tdd/sprint-101-asks-state-copy.test.tsx tests/tdd/sprint-100-g1-offered-band.test.tsx tests/tdd/sprint-100-request-card-clickable.test.tsx tests/tdd/sprint-86-unified-feed-community.test.tsx --runInBand
```

- [ ] Run type check.

```powershell
npx tsc --noEmit
```

- [ ] Run unit/regression tests.

```powershell
npm test
```

- [ ] Run feedback docs check.

```powershell
npm run feedback:check
```

- [ ] Run high/critical audit gate.

```powershell
npm audit --package-lock-only --audit-level=high
```

Expected: high/critical clean. Remaining moderate advisories are documented as within SLA unless
cleaned opportunistically.

---

## Task 12: SDLC Quality Gates

**Files:**
- Verify/review only

- [ ] Run `/simplify` after each implementation task and one final diff-wide simplify pass.

Verification:

```powershell
git diff --stat
```

- [ ] Run `/code-review` on the branch diff and resolve correctness findings.

Verification:

```powershell
git status --short
```

- [ ] Run `/security-review` on the branch diff.

Record any false-positive dismissal in the PR body's Security dismissals section. The recurring
`apps/frontend/src/lib/api.ts` request-forgery finding is known; do not dismiss anything new without
written justification.

- [ ] Confirm no skipped tests were introduced.

```powershell
rg -n "describe\\.skip|it\\.skip|test\\.skip" apps services tests
```

---

## Task 13: Final Pre-Push Verification

**Files:**
- Verify only

- [ ] Run final full checks.

```powershell
npx tsc --noEmit
npm test
npm run test:tdd
npm run feedback:check
npm audit --package-lock-only --audit-level=high
```

- [ ] Check final diff.

```powershell
git status --short
git diff --stat
```

- [ ] Update `.claude/handoff/CURRENT_HANDOFF.md` with execution results, blockers, and deploy notes.

- [ ] Commit any final docs/handoff updates.

```powershell
git add .claude/handoff/CURRENT_HANDOFF.md
git commit -m "docs: update Sprint 101 handoff"
```

---

## Task 14: Merge + Deploy

**Files:**
- PR/deploy only

- [ ] Open PR with the full `.github/pull_request_template.md` body filled in.

```powershell
gh pr create --base master --head feature/sprint-101-actionability-state-truth --title "Sprint 101: Actionability + State Truth" --body-file C:\tmp\sprint-101-pr-body.md
```

- [ ] Wait for required checks.

```powershell
gh pr checks --watch
```

- [ ] Get required review/approval. Do not self-merge; Admin merge authority applies.

- [ ] After Admin authorization, merge to `master`.

- [ ] Monitor GitHub Actions deploy to karmyq.com.

- [ ] Run post-deploy human validation:

1. Login as `maria.reyes@test.karmyq.com / password123`.
2. Dashboard Home shows pending offered items, not only a count.
3. Open a community open ask and confirm `/requests/[id]` shows details/action instead of redirecting.
4. Offer on an eligible ask from detail; confirm it moves to awaiting response / Helping.
5. Expand a completed Asks item; confirm it does not say "No offers yet."
6. Check community Home copy and graph layout decision.

- [ ] Update handoff with deployed version, PR number, commit, deploy result, and validation result.
