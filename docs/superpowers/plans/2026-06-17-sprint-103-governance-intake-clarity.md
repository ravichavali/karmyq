# Governance + Intake Clarity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox
> (`- [ ]`) syntax for tracking.

**Goal:** Make split authority, service-vs-help action language, and founding-circle intake review
match what the system can actually do.

**Architecture:** Sprint 103 changes three bounded surfaces. Community-service keeps split children
administrable with child-local admin selection; frontend centralizes request action copy in a helper;
auth-service adds authenticated founding-circle review endpoints backed by the existing submissions
table and a small admin page.

**Tech Stack:** Node.js/Express/TypeScript, Next.js 14, PostgreSQL 15, Bull queue.

## Global Constraints

- Branch: `feature/sprint-103-governance-intake-clarity`.
- Version target: `v11.11.0 -> v11.12.0`.
- Founding-circle reviewer permission is `any active community admin`; do not add a new role system.
- Split child admins must be selected from that child's assigned members.
- Keep `split_origin` links and Sprint 86 trust/karma carry-forward semantics unchanged.
- No outbound founding-circle email, Slack, webhook, queue event, or notification transport.
- Centralize offer action labels in one frontend helper.
- New endpoints use ADR-074 error envelopes: `{ success:false, message:string, error:string }`.
- Frontend API wrappers read `res.data` after interceptor unwrapping.
- Docs and regenerated landing docs ship in the same PR.

---

## File Map

### New files to create

| File | Responsibility |
|------|----------------|
| `services/community-service/tests/tdd/sprint-103-split-child-admin.test.ts` | TDD coverage for child-local split admin selection. |
| `apps/frontend/src/lib/requestActionCopy.ts` | Single helper for service vs mutual-aid offer labels and error fallback copy. |
| `apps/frontend/tests/tdd/sprint-103-offer-action-copy.test.tsx` | TDD coverage for helper, `RequestCard`, and request detail action labels. |
| `services/auth-service/tests/tdd/foundingCircleReview.route.test.ts` | TDD coverage for founding-circle review list/update endpoints. |
| `apps/frontend/src/pages/admin/founding-circle.tsx` | Admin/reviewer page for founding-circle submissions. |
| `apps/frontend/tests/tdd/sprint-103-founding-circle-admin.test.tsx` | TDD coverage for the admin review page. |

### Existing files to modify

| File | Change |
|------|--------|
| `services/community-service/src/services/fissionService.ts` | Extract child admin selector; stop promoting executing admin into both children. |
| `apps/frontend/src/components/Feed/RequestCard.tsx` | Use shared offer label/error helper. |
| `apps/frontend/src/pages/requests/[id].tsx` | Use shared offer label/error helper. |
| `services/auth-service/src/database/foundingCircleDb.ts` | Add list/update/reviewer DB helpers. |
| `services/auth-service/src/routes/foundingCircle.ts` | Add authenticated review endpoints; keep public POST unchanged. |
| `apps/frontend/src/lib/api.ts` | Add `foundingCircleAdminService` wrappers. |
| `apps/frontend/src/components/admin/AdminLayout.tsx` | Add Founding Circle nav link. |
| `docs/guides/community-fission.md` | Document child-local split admin selection. |
| `docs/concepts/governance.md` | Document split relation vs authority. |
| `docs/concepts/community-and-provider-two-facets.md` | Document action-language boundary. |
| `docs/guides/using-service-providers-guide.md` | Confirm service ask language. |
| `docs/adr/ADR-076-founding-circle-intake.md` | Update persist-only review status to reviewer API/page. |
| `apps/frontend/CONTEXT.md` | Add Sprint 103 frontend notes. |
| `services/auth-service/CONTEXT.md` | Document review endpoints. |
| `services/community-service/CONTEXT.md` | Document child-local split admins. |
| `services/registry.json` | Add new auth-service endpoints. |
| `apps/landing/src/data/docs/**` | Regenerated docs. |
| `.claude/handoff/CURRENT_HANDOFF.md` | Track Sprint 103 execution state and validation checklist. |

---

## Critical Implementation Notes

1. **Do not create a new platform-role system in Sprint 103.** Founding-circle reviewer permission is
   defined as any active community admin, matching the existing admin UI gate. A true platform role is a
   future architectural decision.
2. **Split child admins must be child-local.** The executing parent admin is not automatically inserted
   as admin into both children. Each child admin must be selected from that child's assigned members.
3. **Keep the `split_origin` link.** The relationship between child communities is preserved by
   `communities.community_links`, not by shared admin authority.
4. **Never leave a child adminless.** If no assigned parent admin exists for a child, promote the
   strongest assigned member by within-child trust degree with deterministic tie-breaks.
5. **Do not change trust/karma carry-forward semantics.** Sprint 103 changes roles only; within-group
   trust and karma copying from Sprint 86 stays intact.
6. **Centralize offer action copy.** Do not reintroduce inline `request_type === 'service'` label checks
   in multiple components.
7. **Service asks are not peer messaging.** Do not restore the Sprint 102 reconnect CTA or add direct
   peer messages as part of service/provider clarity.
8. **Founding-circle review is not notification.** No email, Slack, webhook, queue event, or outbound
   transport in this sprint.
9. **Use the ADR-074 error contract.** New auth-service review endpoints return string `error` codes.
10. **API interceptor unwraps envelopes.** Frontend callers should read `res.data`, not `res.data.data`.
11. **Editing `apps/frontend/src/lib/api.ts` can retrigger CodeQL `js/request-forgery`.** If it recurs,
    dismiss with the documented trusted env-baseURL rationale and re-run the gate.
12. **Docs are part of done.** Update source docs, service contexts, registry, frontend context, and
    regenerated landing docs in the same PR.

---

## Task 1: Branch + Context Check

**Files:**
- Read: `docs/superpowers/specs/2026-06-17-sprint-103-governance-intake-clarity-design.md`
- Read: `services/community-service/CONTEXT.md`
- Read: `services/auth-service/CONTEXT.md`
- Read: `apps/frontend/CONTEXT.md`

**Interfaces:**
- Consumes: approved Sprint 103 spec.
- Produces: confirmed clean starting point for implementation.

- [ ] Create or switch to the sprint branch.

```bash
git checkout -b feature/sprint-103-governance-intake-clarity
```

Expected: branch exists and current branch is `feature/sprint-103-governance-intake-clarity`.

- [ ] Confirm local state before editing.

```bash
git status --short
```

Expected: planning artifacts may be present. Untracked `scripts/founding-circle-submissions.sh` is user/local work; do not stage or remove it.

- [ ] Read the context files listed above.

- [ ] Locate current implementation surfaces.

```bash
rg -n "executeSplit|Offer service|Offer to Help|founding-circle|founding_circle" services apps docs
```

Expected: hits in `fissionService.ts`, `RequestCard.tsx`, `requests/[id].tsx`, `foundingCircle.ts`,
`foundingCircleDb.ts`, docs, and tests.

---

## Task 2: TDD - Child-Local Split Admin Selection

**Files:**
- Create: `services/community-service/tests/tdd/sprint-103-split-child-admin.test.ts`
- Test target: `services/community-service/src/services/fissionService.ts`

**Interfaces:**
- Produces expected helper signature:
  `selectChildAdmin(group: string[], context: SplitAdminSelectionContext): string`.
- Later tasks consume the helper in `executeSplit`.

- [ ] Create the failing test file.

```ts
import { selectChildAdmin, SplitAdminSelectionContext } from '../../src/services/fissionService';

const context = (overrides: Partial<SplitAdminSelectionContext> = {}): SplitAdminSelectionContext => ({
  executingAdminId: 'admin-parent',
  parentAdmins: new Set(['admin-parent', 'admin-b']),
  joinedAtByUser: new Map([
    ['admin-parent', '2026-01-01T00:00:00.000Z'],
    ['admin-b', '2026-01-02T00:00:00.000Z'],
    ['member-strong', '2026-01-03T00:00:00.000Z'],
    ['member-quiet', '2026-01-04T00:00:00.000Z'],
  ]),
  trustEdges: [
    { user_id_a: 'member-strong', user_id_b: 'member-quiet', effective_weight: 5 },
    { user_id_a: 'member-strong', user_id_b: 'member-third', effective_weight: 4 },
    { user_id_a: 'member-quiet', user_id_b: 'member-third', effective_weight: 1 },
  ],
  ...overrides,
});

describe('Sprint 103 split child admin selection', () => {
  it('keeps the executing admin only for the child they are assigned to', () => {
    expect(selectChildAdmin(['admin-parent', 'member-quiet'], context())).toBe('admin-parent');
    expect(selectChildAdmin(['admin-b', 'member-quiet'], context())).toBe('admin-b');
  });

  it('prefers an assigned parent admin over a non-admin with higher trust degree', () => {
    expect(selectChildAdmin(['admin-b', 'member-strong', 'member-quiet'], context())).toBe('admin-b');
  });

  it('promotes the strongest assigned member when no parent admin is assigned', () => {
    expect(selectChildAdmin(['member-quiet', 'member-strong', 'member-third'], context())).toBe('member-strong');
  });

  it('uses joined_at then user_id as deterministic tie-breakers', () => {
    const tied = context({
      trustEdges: [
        { user_id_a: 'member-a', user_id_b: 'member-b', effective_weight: 2 },
        { user_id_a: 'member-c', user_id_b: 'member-b', effective_weight: 2 },
      ],
      joinedAtByUser: new Map([
        ['member-a', '2026-01-02T00:00:00.000Z'],
        ['member-b', '2026-01-03T00:00:00.000Z'],
        ['member-c', '2026-01-01T00:00:00.000Z'],
      ]),
    });

    expect(selectChildAdmin(['member-a', 'member-b', 'member-c'], tied)).toBe('member-c');
  });

  it('throws if asked to select an admin for an empty child', () => {
    expect(() => selectChildAdmin([], context())).toThrow(/empty child/i);
  });
});
```

- [ ] Run the test and confirm it fails.

```bash
cd services/community-service && npx jest tests/tdd/sprint-103-split-child-admin.test.ts --runInBand
```

Expected: fails because `selectChildAdmin` is not exported.

---

## Task 3: Implement Child-Local Split Admins

**Files:**
- Modify: `services/community-service/src/services/fissionService.ts`

**Interfaces:**
- Consumes: `selectChildAdmin(group, context)` from Task 2.
- Produces: `executeSplit` inserts exactly one selected admin per child, from that child's assigned members.

- [ ] Add the exported context type and helper near the existing pure functions.

```ts
export interface SplitAdminSelectionContext {
  executingAdminId: string;
  parentAdmins: Set<string>;
  joinedAtByUser: Map<string, string>;
  trustEdges: TrustEdge[];
}

function trustDegreeWithinGroup(userId: string, group: Set<string>, edges: TrustEdge[]): number {
  return edges.reduce((total, edge) => {
    const touchesUser = edge.user_id_a === userId || edge.user_id_b === userId;
    const other = edge.user_id_a === userId ? edge.user_id_b : edge.user_id_a;
    return touchesUser && group.has(other) ? total + edge.effective_weight : total;
  }, 0);
}

function compareJoinedThenId(a: string, b: string, joinedAtByUser: Map<string, string>): number {
  const joinedA = joinedAtByUser.get(a) ?? '';
  const joinedB = joinedAtByUser.get(b) ?? '';
  if (joinedA !== joinedB) return joinedA.localeCompare(joinedB);
  return a.localeCompare(b);
}

export function selectChildAdmin(group: string[], context: SplitAdminSelectionContext): string {
  if (group.length === 0) throw new Error('Cannot select admin for empty child group');
  if (group.includes(context.executingAdminId)) return context.executingAdminId;

  const assignedParentAdmins = group
    .filter((userId) => context.parentAdmins.has(userId))
    .sort((a, b) => compareJoinedThenId(a, b, context.joinedAtByUser));
  if (assignedParentAdmins.length > 0) return assignedParentAdmins[0];

  const groupSet = new Set(group);
  return [...group].sort((a, b) => {
    const degreeDelta =
      trustDegreeWithinGroup(b, groupSet, context.trustEdges) -
      trustDegreeWithinGroup(a, groupSet, context.trustEdges);
    if (degreeDelta !== 0) return degreeDelta;
    return compareJoinedThenId(a, b, context.joinedAtByUser);
  })[0];
}
```

- [ ] In `executeSplit`, fetch active parent admins and member join dates after `finalAssignments`.

```ts
const parentMembersRes = await client.query(
  `SELECT user_id, role, joined_at
   FROM communities.members
   WHERE community_id = $1 AND status = 'active'`,
  [communityId]
);
const parentAdmins = new Set(
  parentMembersRes.rows.filter((row: any) => row.role === 'admin').map((row: any) => row.user_id)
);
const joinedAtByUser = new Map(
  parentMembersRes.rows.map((row: any) => [row.user_id, new Date(row.joined_at).toISOString()])
);
```

- [ ] Fetch parent trust edges for all assigned members once.

```ts
const assignedUserIds = finalAssignments.rows.map((row: any) => row.user_id);
const trustEdgesRes = await client.query(
  `SELECT user_id_a, user_id_b, current_weight AS effective_weight
   FROM social_graph.trust_edges_live
   WHERE community_id = $1
     AND user_id_a = ANY($2::uuid[])
     AND user_id_b = ANY($2::uuid[])`,
  [communityId, assignedUserIds]
);
```

- [ ] Replace the old unconditional admin upsert inside the child loop.

```ts
const selectionContext: SplitAdminSelectionContext = {
  executingAdminId: adminId,
  parentAdmins,
  joinedAtByUser,
  trustEdges: trustEdgesRes.rows,
};

for (const [childId, group] of [[childAId, groupA], [childBId, groupB]] as const) {
  const childAdminId = selectChildAdmin(group, selectionContext);
  await client.query(
    `INSERT INTO communities.members (community_id, user_id, role, status)
     VALUES ($1, $2, 'admin', 'active')
     ON CONFLICT (community_id, user_id)
     DO UPDATE SET role = 'admin', status = 'active'`,
    [childId, childAdminId]
  );
  // keep existing current_members recompute + trust/karma carry-forward below
}
```

- [ ] Ensure the regular member insert still runs before admin promotion, so the admin is already a child member.

- [ ] Run the focused test.

```bash
cd services/community-service && npx jest tests/tdd/sprint-103-split-child-admin.test.ts --runInBand
```

Expected: pass.

- [ ] Run community-service TDD/regression.

```bash
cd services/community-service && npm run test:tdd && npm run test:regression
```

Expected: pass or only pre-existing unrelated failures documented with exact test names.

---

## Task 4: TDD - Shared Offer Action Copy

**Files:**
- Create: `apps/frontend/tests/tdd/sprint-103-offer-action-copy.test.tsx`
- Test target: `apps/frontend/src/lib/requestActionCopy.ts`
- Test target: `apps/frontend/src/components/Feed/RequestCard.tsx`
- Test target: `apps/frontend/src/pages/requests/[id].tsx`

**Interfaces:**
- Produces helper contract:
  `getOfferActionLabel(requestType?: string, state?: 'idle' | 'pending'): string`
  and `getOfferErrorFallback(requestType?: string): string`.

- [ ] Create the failing test file.

```tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import RequestCard from '@/components/Feed/RequestCard';
import RequestDetailPage from '@/pages/requests/[id]';
import { requestService } from '@/lib/api';
import { getOfferActionLabel, getOfferErrorFallback } from '@/lib/requestActionCopy';

jest.mock('@/lib/api', () => ({
  requestService: {
    getRequest: jest.fn(),
    createMatch: jest.fn(),
  },
}));

jest.mock('next/router', () => ({
  useRouter: () => ({ isReady: true, query: { id: 'request-1' }, push: jest.fn() }),
}));

const card = (requestType: string) => ({
  request_id: 'request-1',
  requester_id: 'requester-1',
  title: 'Fix a sink',
  description: 'Kitchen sink',
  status: 'open',
  urgency: 'medium',
  request_type: requestType,
  payload_type: requestType,
  payload: {},
  requirements: {},
  author_name: 'Maya',
  community_id: 'community-1',
});

const detail = (requestType: string) => ({
  id: 'request-1',
  title: 'Fix a sink',
  status: 'open',
  request_type: requestType,
  viewer_relation: 'can_offer',
});

describe('Sprint 103 offer action copy', () => {
  beforeEach(() => jest.clearAllMocks());

  it('centralizes idle and pending labels', () => {
    expect(getOfferActionLabel('service')).toBe('Offer service');
    expect(getOfferActionLabel('service', 'pending')).toBe('Offering service...');
    expect(getOfferActionLabel('generic')).toBe('Offer to Help');
    expect(getOfferActionLabel('ride', 'pending')).toBe('Offering...');
    expect(getOfferErrorFallback('service')).toBe('Failed to offer service');
    expect(getOfferErrorFallback('borrow')).toBe('Failed to offer help');
  });

  it('uses service language on request cards', () => {
    render(<RequestCard data={card('service') as any} currentUserId="helper-1" />);
    expect(screen.getByRole('button', { name: /offer service/i })).toBeInTheDocument();
  });

  it('keeps mutual-aid language on request cards', () => {
    render(<RequestCard data={card('generic') as any} currentUserId="helper-1" />);
    expect(screen.getByRole('button', { name: /offer to help/i })).toBeInTheDocument();
  });

  it('uses the same service label on request detail', async () => {
    (requestService.getRequest as jest.Mock).mockResolvedValue({ data: detail('service') });
    (requestService.createMatch as jest.Mock).mockResolvedValue({});

    render(<RequestDetailPage />);

    fireEvent.click(await screen.findByRole('button', { name: /offer service/i }));
    await waitFor(() => expect(requestService.createMatch).toHaveBeenCalledWith({ request_id: 'request-1' }));
  });
});
```

- [ ] Run the test and confirm it fails.

```bash
cd apps/frontend && npx jest tests/tdd/sprint-103-offer-action-copy.test.tsx --runInBand
```

Expected: fails because `requestActionCopy.ts` does not exist.

---

## Task 5: Implement Shared Offer Action Copy

**Files:**
- Create: `apps/frontend/src/lib/requestActionCopy.ts`
- Modify: `apps/frontend/src/components/Feed/RequestCard.tsx`
- Modify: `apps/frontend/src/pages/requests/[id].tsx`

**Interfaces:**
- Consumes helper contract from Task 4.
- Produces no behavior change to `createMatch`, only copy consistency.

- [ ] Create the helper.

```ts
export type OfferActionState = 'idle' | 'pending';

export function isServiceRequest(requestType?: string | null): boolean {
  return String(requestType ?? '') === 'service';
}

export function getOfferActionLabel(
  requestType?: string | null,
  state: OfferActionState = 'idle'
): string {
  if (state === 'pending') return isServiceRequest(requestType) ? 'Offering service...' : 'Offering...';
  return isServiceRequest(requestType) ? 'Offer service' : 'Offer to Help';
}

export function getOfferErrorFallback(requestType?: string | null): string {
  return isServiceRequest(requestType) ? 'Failed to offer service' : 'Failed to offer help';
}
```

- [ ] Update `RequestCard.tsx`.

```tsx
import { getOfferActionLabel, getOfferErrorFallback } from '@/lib/requestActionCopy';
```

Replace the error fallback:

```tsx
setError(err?.response?.data?.message ?? getOfferErrorFallback(data.request_type));
```

Replace the button label:

```tsx
{getOfferActionLabel(data.request_type, offering ? 'pending' : 'idle')}
```

- [ ] Update `requests/[id].tsx`.

```tsx
import { getOfferActionLabel, getOfferErrorFallback } from '@/lib/requestActionCopy';
```

Replace the error fallback:

```tsx
setError(err?.response?.data?.message ?? getOfferErrorFallback(detail.request_type));
```

Replace the button label:

```tsx
{getOfferActionLabel(detail.request_type, offering ? 'pending' : 'idle')}
```

Remove the local `isService` constant if no longer used.

- [ ] Run focused frontend tests.

```bash
cd apps/frontend && npx jest tests/tdd/sprint-103-offer-action-copy.test.tsx tests/tdd/sprint-92-provider-copy.test.tsx tests/tdd/sprint-101-request-detail-action.test.tsx --runInBand
```

Expected: pass.

---

## Task 6: TDD - Founding-Circle Review Endpoints

**Files:**
- Create: `services/auth-service/tests/tdd/foundingCircleReview.route.test.ts`
- Test target: `services/auth-service/src/routes/foundingCircle.ts`
- Test target: `services/auth-service/src/database/foundingCircleDb.ts`

**Interfaces:**
- Produces route expectations:
  - `GET /founding-circle/submissions`
  - `PATCH /founding-circle/submissions/:id/status`

- [ ] Create route tests with mocked DB helpers and mocked auth middleware.

```ts
import request from 'supertest';
import express from 'express';
import foundingCircleRoutes from '../../src/routes/foundingCircle';
import {
  isFoundingCircleReviewer,
  listFoundingCircleSubmissions,
  updateFoundingCircleSubmissionStatus,
} from '../../src/database/foundingCircleDb';

jest.mock('@karmyq/shared/middleware', () => ({
  authMiddleware: (req: any, _res: any, next: any) => {
    const auth = req.headers.authorization;
    if (!auth) {
      _res.status(401).json({ success: false, message: 'No authentication token provided', error: 'UNAUTHORIZED' });
      return;
    }
    if (auth === 'Bearer reviewer') req.user = { userId: 'reviewer-1', email: 'r@test.com', communities: [] };
    if (auth === 'Bearer member') req.user = { userId: 'member-1', email: 'm@test.com', communities: [] };
    next();
  },
}));

jest.mock('../../src/database/foundingCircleDb');

const mockIsReviewer = isFoundingCircleReviewer as jest.MockedFunction<typeof isFoundingCircleReviewer>;
const mockList = listFoundingCircleSubmissions as jest.MockedFunction<typeof listFoundingCircleSubmissions>;
const mockUpdate = updateFoundingCircleSubmissionStatus as jest.MockedFunction<typeof updateFoundingCircleSubmissionStatus>;

function app() {
  const app = express();
  app.use(express.json());
  app.use('/founding-circle', foundingCircleRoutes);
  return app;
}

describe('Sprint 103 founding-circle review endpoints', () => {
  beforeEach(() => jest.clearAllMocks());

  it('requires auth for listing submissions', async () => {
    const res = await request(app()).get('/founding-circle/submissions');
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('UNAUTHORIZED');
  });

  it('forbids authenticated non-reviewers', async () => {
    mockIsReviewer.mockResolvedValue(false);
    const res = await request(app()).get('/founding-circle/submissions').set('Authorization', 'Bearer member');
    expect(res.status).toBe(403);
    expect(res.body.error).toBe('FORBIDDEN');
  });

  it('lists submissions for reviewers with status, limit, and offset', async () => {
    mockIsReviewer.mockResolvedValue(true);
    mockList.mockResolvedValue({
      items: [{ id: 's1', email: 'a@example.com', status: 'new', created_at: '2026-06-17T00:00:00.000Z' }],
      count: 1,
      limit: 25,
      offset: 0,
    } as any);

    const res = await request(app())
      .get('/founding-circle/submissions?status=new&limit=25&offset=0')
      .set('Authorization', 'Bearer reviewer');

    expect(res.status).toBe(200);
    expect(res.body.data.items).toHaveLength(1);
    expect(mockList).toHaveBeenCalledWith({ status: 'new', limit: 25, offset: 0 });
  });

  it('updates status for reviewers', async () => {
    mockIsReviewer.mockResolvedValue(true);
    mockUpdate.mockResolvedValue({ id: 's1', email: 'a@example.com', status: 'reviewed' } as any);

    const res = await request(app())
      .patch('/founding-circle/submissions/s1/status')
      .set('Authorization', 'Bearer reviewer')
      .send({ status: 'reviewed' });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('reviewed');
    expect(mockUpdate).toHaveBeenCalledWith('s1', 'reviewed');
  });

  it('rejects invalid status with 400', async () => {
    mockIsReviewer.mockResolvedValue(true);
    const res = await request(app())
      .patch('/founding-circle/submissions/s1/status')
      .set('Authorization', 'Bearer reviewer')
      .send({ status: 'emailed' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('VALIDATION_ERROR');
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('returns 404 when updating a missing submission', async () => {
    mockIsReviewer.mockResolvedValue(true);
    mockUpdate.mockResolvedValue(null);
    const res = await request(app())
      .patch('/founding-circle/submissions/missing/status')
      .set('Authorization', 'Bearer reviewer')
      .send({ status: 'archived' });

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('NOT_FOUND');
  });
});
```

- [ ] Run the test and confirm it fails.

```bash
cd services/auth-service && npx jest tests/tdd/foundingCircleReview.route.test.ts --runInBand
```

Expected: fails because DB helpers and routes do not exist.

---

## Task 7: Implement Founding-Circle Review Endpoints

**Files:**
- Modify: `services/auth-service/src/database/foundingCircleDb.ts`
- Modify: `services/auth-service/src/routes/foundingCircle.ts`

**Interfaces:**
- Consumes Task 6 tests.
- Produces `GET` and `PATCH` reviewer endpoints.

- [ ] Add types and DB helpers.

```ts
export type FoundingCircleStatus = 'new' | 'reviewed' | 'contacted' | 'archived';

export interface FoundingCircleSubmissionRow {
  id: string;
  email: string;
  lens: string | null;
  contribution: string | null;
  concern: string | null;
  source_page: string;
  status: FoundingCircleStatus;
  created_at: string;
  reviewed_at: string | null;
}

export async function isFoundingCircleReviewer(userId: string): Promise<boolean> {
  const result = await query(
    `SELECT 1
     FROM communities.members
     WHERE user_id = $1 AND role = 'admin' AND status = 'active'
     LIMIT 1`,
    [userId]
  );
  return result.rowCount > 0;
}

export async function listFoundingCircleSubmissions({
  status,
  limit,
  offset,
}: {
  status?: FoundingCircleStatus;
  limit: number;
  offset: number;
}): Promise<{ items: FoundingCircleSubmissionRow[]; count: number; limit: number; offset: number }> {
  const params: any[] = [];
  const where = status ? `WHERE status = $${params.push(status)}` : '';
  params.push(limit, offset);
  const rows = await query(
    `SELECT id, email, lens, contribution, concern, source_page, status, created_at, reviewed_at
     FROM auth.founding_circle_submissions
     ${where}
     ORDER BY created_at DESC
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );
  const countParams = status ? [status] : [];
  const count = await query(
    `SELECT COUNT(*)::int AS count FROM auth.founding_circle_submissions ${where}`,
    countParams
  );
  return { items: rows.rows, count: count.rows[0]?.count ?? 0, limit, offset };
}

export async function updateFoundingCircleSubmissionStatus(
  id: string,
  status: FoundingCircleStatus
): Promise<FoundingCircleSubmissionRow | null> {
  const result = await query(
    `UPDATE auth.founding_circle_submissions
     SET status = $2,
         reviewed_at = CASE
           WHEN reviewed_at IS NULL AND $2 <> 'new' THEN NOW()
           WHEN $2 = 'new' THEN NULL
           ELSE reviewed_at
         END
     WHERE id = $1
     RETURNING id, email, lens, contribution, concern, source_page, status, created_at, reviewed_at`,
    [id, status]
  );
  return result.rows[0] ?? null;
}
```

- [ ] Add route imports.

```ts
import { authMiddleware, AuthenticatedRequest } from '@karmyq/shared/middleware';
import { sendForbidden, sendNotFound, sendUnauthorized } from '@karmyq/shared/utils/response';
import {
  insertFoundingCircleSubmission,
  FoundingCircleSubmission,
  FoundingCircleStatus,
  isFoundingCircleReviewer,
  listFoundingCircleSubmissions,
  updateFoundingCircleSubmissionStatus,
} from '../database/foundingCircleDb';
```

- [ ] Add constants and reviewer guard below validation helpers.

```ts
const VALID_STATUSES: FoundingCircleStatus[] = ['new', 'reviewed', 'contacted', 'archived'];

async function requireReviewer(req: AuthenticatedRequest, res: Response): Promise<boolean> {
  const userId = req.user?.userId;
  if (!userId) {
    sendUnauthorized(res, 'No authentication token provided', { requestId: (req as any).id });
    return false;
  }
  if (!(await isFoundingCircleReviewer(userId))) {
    sendForbidden(res, 'Founding-circle review requires community admin access', { requestId: (req as any).id });
    return false;
  }
  return true;
}
```

- [ ] Add `GET /submissions` before the public `POST /submissions` or after it; method separation keeps routing unambiguous.

```ts
router.get('/submissions', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  if (!(await requireReviewer(req, res))) return;
  const rawStatus = typeof req.query.status === 'string' ? req.query.status : undefined;
  const status = rawStatus && VALID_STATUSES.includes(rawStatus as FoundingCircleStatus)
    ? rawStatus as FoundingCircleStatus
    : undefined;
  if (rawStatus && !status) {
    return sendValidationError(res, 'Invalid status filter', { status: rawStatus }, { requestId: (req as any).id });
  }
  const limit = Math.min(Math.max(Number(req.query.limit ?? 50), 1), 100);
  const offset = Math.max(Number(req.query.offset ?? 0), 0);
  const data = await listFoundingCircleSubmissions({ status, limit, offset });
  return sendSuccess(res, data, HTTP_STATUS.OK, { requestId: (req as any).id });
});
```

- [ ] Add `PATCH /submissions/:id/status`.

```ts
router.patch('/submissions/:id/status', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  if (!(await requireReviewer(req, res))) return;
  const status = req.body?.status;
  if (!VALID_STATUSES.includes(status)) {
    return sendValidationError(res, 'Invalid status', { status }, { requestId: (req as any).id });
  }
  const updated = await updateFoundingCircleSubmissionStatus(req.params.id, status);
  if (!updated) return sendNotFound(res, 'Founding-circle submission', { requestId: (req as any).id });
  return sendSuccess(res, updated, HTTP_STATUS.OK, { requestId: (req as any).id });
});
```

- [ ] Run auth-service focused tests.

```bash
cd services/auth-service && npx jest tests/tdd/foundingCircleReview.route.test.ts tests/tdd/foundingCircle.route.test.ts tests/unit/foundingCircle.test.ts --runInBand
```

Expected: pass.

---

## Task 8: TDD - Founding-Circle Admin Page

**Files:**
- Create: `apps/frontend/tests/tdd/sprint-103-founding-circle-admin.test.tsx`
- Test target: `apps/frontend/src/pages/admin/founding-circle.tsx`
- Test target: `apps/frontend/src/lib/api.ts`

**Interfaces:**
- Produces frontend wrapper expectations:
  - `foundingCircleAdminService.listSubmissions(params)`
  - `foundingCircleAdminService.updateSubmissionStatus(id, status)`

- [ ] Create the failing page test.

```tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import FoundingCircleAdminPage from '@/pages/admin/founding-circle';
import { foundingCircleAdminService } from '@/lib/api';

jest.mock('@/components/Layout', () => ({
  __esModule: true,
  default: ({ children }: any) => <div>{children}</div>,
}));

jest.mock('@/utils/admin-auth', () => ({
  requireAdmin: jest.fn(() => true),
  isAdmin: jest.fn(() => true),
}));

jest.mock('next/router', () => ({
  useRouter: () => ({ push: jest.fn() }),
}));

jest.mock('@/lib/api', () => ({
  foundingCircleAdminService: {
    listSubmissions: jest.fn(),
    updateSubmissionStatus: jest.fn(),
  },
}));

const listResponse = {
  items: [
    {
      id: 's1',
      email: 'founder@example.com',
      lens: 'community organizer',
      contribution: 'I can host reviews.',
      concern: 'Trust at scale.',
      source_page: 'join',
      status: 'new',
      created_at: '2026-06-17T00:00:00.000Z',
      reviewed_at: null,
    },
  ],
  count: 1,
  limit: 50,
  offset: 0,
};

describe('Sprint 103 founding-circle admin page', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (foundingCircleAdminService.listSubmissions as jest.Mock).mockResolvedValue({ data: listResponse });
    (foundingCircleAdminService.updateSubmissionStatus as jest.Mock).mockResolvedValue({
      data: { ...listResponse.items[0], status: 'reviewed', reviewed_at: '2026-06-17T01:00:00.000Z' },
    });
  });

  it('lists founding-circle submissions', async () => {
    render(<FoundingCircleAdminPage />);
    expect(await screen.findByText('founder@example.com')).toBeInTheDocument();
    expect(screen.getByText('community organizer')).toBeInTheDocument();
    expect(screen.getByText('I can host reviews.')).toBeInTheDocument();
  });

  it('filters by status', async () => {
    render(<FoundingCircleAdminPage />);
    await screen.findByText('founder@example.com');
    fireEvent.click(screen.getByRole('button', { name: /reviewed/i }));
    await waitFor(() =>
      expect(foundingCircleAdminService.listSubmissions).toHaveBeenLastCalledWith({
        status: 'reviewed',
        limit: 50,
        offset: 0,
      })
    );
  });

  it('marks a submission reviewed', async () => {
    render(<FoundingCircleAdminPage />);
    fireEvent.click(await screen.findByRole('button', { name: /mark reviewed/i }));
    await waitFor(() =>
      expect(foundingCircleAdminService.updateSubmissionStatus).toHaveBeenCalledWith('s1', 'reviewed')
    );
    expect(await screen.findByText(/reviewed/i)).toBeInTheDocument();
  });
});
```

- [ ] Run and confirm failure.

```bash
cd apps/frontend && npx jest tests/tdd/sprint-103-founding-circle-admin.test.tsx --runInBand
```

Expected: fails because the page and wrapper do not exist.

---

## Task 9: Implement Founding-Circle Admin Page

**Files:**
- Modify: `apps/frontend/src/lib/api.ts`
- Create: `apps/frontend/src/pages/admin/founding-circle.tsx`
- Modify: `apps/frontend/src/components/admin/AdminLayout.tsx`

**Interfaces:**
- Consumes auth-service review endpoints from Task 7.
- Produces a minimal admin review queue with status filters and status actions.

- [ ] Add API wrappers near auth-service or admin wrappers in `api.ts`.

```ts
export type FoundingCircleStatus = 'new' | 'reviewed' | 'contacted' | 'archived';

export const foundingCircleAdminService = {
  listSubmissions: (params?: { status?: FoundingCircleStatus; limit?: number; offset?: number }) =>
    api.get('/founding-circle/submissions', { params }),

  updateSubmissionStatus: (id: string, status: FoundingCircleStatus) =>
    api.patch(`/founding-circle/submissions/${encodeURIComponent(id)}/status`, { status }),
};
```

- [ ] Create the page with the existing `requireAdmin` pattern.

```tsx
import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import AdminLayout from '@/components/admin/AdminLayout';
import { foundingCircleAdminService, FoundingCircleStatus } from '@/lib/api';
import { requireAdmin, isAdmin } from '@/utils/admin-auth';

type Submission = {
  id: string;
  email: string;
  lens: string | null;
  contribution: string | null;
  concern: string | null;
  source_page: string;
  status: FoundingCircleStatus;
  created_at: string;
  reviewed_at: string | null;
};

const FILTERS: Array<{ label: string; status?: FoundingCircleStatus }> = [
  { label: 'All' },
  { label: 'New', status: 'new' },
  { label: 'Reviewed', status: 'reviewed' },
  { label: 'Contacted', status: 'contacted' },
  { label: 'Archived', status: 'archived' },
];

export default function FoundingCircleAdminPage() {
  const router = useRouter();
  const [authChecked, setAuthChecked] = useState(false);
  const [filter, setFilter] = useState<FoundingCircleStatus | undefined>('new');
  const [items, setItems] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    requireAdmin(router);
    setAuthChecked(true);
  }, [router]);

  async function load(status = filter) {
    setLoading(true);
    try {
      const res = await foundingCircleAdminService.listSubmissions({ status, limit: 50, offset: 0 });
      setItems(res.data.items);
      setError('');
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'Could not load submissions');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (authChecked && isAdmin()) load(filter);
  }, [authChecked, filter]);

  async function updateStatus(id: string, status: FoundingCircleStatus) {
    const res = await foundingCircleAdminService.updateSubmissionStatus(id, status);
    setItems((current) => current.map((item) => (item.id === id ? res.data : item)));
  }

  return (
    <AdminLayout title="Founding Circle">
      <main className="p-6 max-w-5xl">
        <h1 className="text-2xl font-semibold text-text mb-2">Founding-circle submissions</h1>
        <p className="text-sm text-text-muted mb-4">Review notes from karmyq.org/join. No notifications are sent from this page.</p>

        <div className="flex flex-wrap gap-2 mb-4">
          {FILTERS.map((item) => (
            <button
              key={item.label}
              type="button"
              onClick={() => setFilter(item.status)}
              className={`btn-secondary text-sm ${filter === item.status ? 'border-primary text-primary' : ''}`}
            >
              {item.label}
            </button>
          ))}
        </div>

        {error && <p className="text-sm text-red-600 mb-4">{error}</p>}
        {loading ? (
          <p className="text-sm text-text-muted">Loading submissions...</p>
        ) : items.length === 0 ? (
          <p className="text-sm text-text-muted">No submissions in this view.</p>
        ) : (
          <div className="grid gap-3">
            {items.map((item) => (
              <article key={item.id} className="kq-card">
                <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                  <div>
                    <p className="font-semibold text-text">{item.email}</p>
                    {item.lens && <p className="text-sm text-text-muted">{item.lens}</p>}
                    <p className="kq-quiet-meta">Status: {item.status}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button className="btn-secondary text-sm" onClick={() => updateStatus(item.id, 'reviewed')}>Mark reviewed</button>
                    <button className="btn-secondary text-sm" onClick={() => updateStatus(item.id, 'contacted')}>Mark contacted</button>
                    <button className="btn-secondary text-sm" onClick={() => updateStatus(item.id, 'archived')}>Archive</button>
                  </div>
                </div>
                {item.contribution && <p className="text-sm text-text mt-3 whitespace-pre-line">{item.contribution}</p>}
                {item.concern && <p className="text-sm text-text-muted mt-2 whitespace-pre-line">{item.concern}</p>}
              </article>
            ))}
          </div>
        )}
      </main>
    </AdminLayout>
  );
}
```

- [ ] Add a nav link to `AdminLayout.tsx`.

```tsx
<Link
  href="/admin/founding-circle"
  className="block px-4 py-2 rounded hover:bg-surface-raised text-text-muted hover:text-primary"
>
  Founding Circle
</Link>
```

- [ ] Run focused test.

```bash
cd apps/frontend && npx jest tests/tdd/sprint-103-founding-circle-admin.test.tsx --runInBand
```

Expected: pass.

---

## Task 10: Docs, Registry, and Generated Landing Docs

**Files:**
- Modify: `docs/guides/community-fission.md`
- Modify: `docs/concepts/governance.md`
- Modify: `docs/concepts/community-and-provider-two-facets.md`
- Modify: `docs/guides/using-service-providers-guide.md`
- Modify: `docs/adr/ADR-076-founding-circle-intake.md`
- Modify: `apps/frontend/CONTEXT.md`
- Modify: `services/auth-service/CONTEXT.md`
- Modify: `services/community-service/CONTEXT.md`
- Modify: `services/registry.json`
- Regenerate: `apps/landing/src/data/docs/**`

**Interfaces:**
- Consumes final implementation behavior.
- Produces docs and registry matching shipped endpoints.

- [ ] Update `services/registry.json` auth-service `apis.provides`.

```json
{ "method": "GET", "path": "/founding-circle/submissions", "description": "Authenticated founding-circle reviewer list endpoint. Filters by status and returns paginated submissions for review." },
{ "method": "PATCH", "path": "/founding-circle/submissions/:id/status", "description": "Authenticated founding-circle reviewer endpoint to mark a submission new, reviewed, contacted, or archived." }
```

- [ ] Update `services/auth-service/CONTEXT.md` with the two new endpoints under founding-circle.

- [ ] Update `services/community-service/CONTEXT.md` Recent Changes with child-local split admin selection.

- [ ] Update source docs with these exact points:
  - `community-fission.md`: child communities are linked by `split_origin`; each child admin is selected from assigned members.
  - `governance.md`: relation between split children is not the same as shared authority.
  - `community-and-provider-two-facets.md`: service asks say "Offer service"; mutual-aid asks say "Offer to Help".
  - `using-service-providers-guide.md`: service action language remains service-specific on card and detail.
  - `ADR-076`: review no longer requires `psql`; Sprint 103 adds authenticated reviewer endpoints/page; outbound notify remains deferred.

- [ ] Add Sprint 103 section to `apps/frontend/CONTEXT.md`.

- [ ] Regenerate docs using the repo script.

```bash
cd apps/landing && npm run generate-docs
```

- [ ] Verify source and generated docs.

```bash
rg -n "child-local|Offer service|Founding-circle|founding-circle reviewer|split_origin" docs apps/landing/src/data/docs services/registry.json apps/frontend/CONTEXT.md services/auth-service/CONTEXT.md services/community-service/CONTEXT.md
```

Expected: all Sprint 103 concepts are present.

---

## Task 11: Focused Verification

**Files:**
- Test: Sprint 103 test files and adjacent regression suites.

**Interfaces:**
- Produces confidence before full SDLC gates.

- [ ] Run community-service focused tests.

```bash
cd services/community-service && npx jest tests/tdd/sprint-103-split-child-admin.test.ts --runInBand
```

Expected: pass.

- [ ] Run auth-service focused tests.

```bash
cd services/auth-service && npx jest tests/tdd/foundingCircleReview.route.test.ts tests/tdd/foundingCircle.route.test.ts tests/unit/foundingCircle.test.ts --runInBand
```

Expected: pass.

- [ ] Run frontend focused tests.

```bash
cd apps/frontend && npx jest tests/tdd/sprint-103-offer-action-copy.test.tsx tests/tdd/sprint-103-founding-circle-admin.test.tsx tests/tdd/sprint-92-provider-copy.test.tsx tests/tdd/sprint-101-request-detail-action.test.tsx --runInBand
```

Expected: pass.

- [ ] Run type checks for touched workspaces.

```bash
cd services/community-service && npx tsc --noEmit
cd services/auth-service && npx tsc --noEmit
cd apps/frontend && npx tsc --noEmit
```

Expected: clean or only pre-existing failures documented with exact names and proof.

---

## Task 12: SDLC Quality Gates

**Files:**
- Review: full branch diff.

**Interfaces:**
- Produces merge-ready branch evidence.

- [ ] Testing gate: unit + regression.

```bash
npm test
```

Expected: pass.

- [ ] TDD gate.

```bash
npm run test:tdd
```

Expected: Sprint 103 TDD passes. Existing unrelated TDD failures may remain only if documented and
confirmed on `master`.

- [ ] Feedback loop check.

```bash
npm run feedback:check
```

Expected: pass.

- [ ] Service analysis because `services/registry.json` changes.

```bash
npm run analyze:services
```

Expected: pass; generated dependency docs are not hand-edited unless the script updates them.

- [ ] Security dependency gate.

```bash
npm audit --package-lock-only --audit-level=high
```

Expected: no high/critical local audit findings.

- [ ] `/simplify` on the branch diff.

Verification: record findings in the PR body and resolve unnecessary duplication, especially around
offer copy and founding-circle status rendering.

- [ ] `/code-review` on the branch diff.

Verification: record findings in the PR body and resolve correctness issues before merge.

- [ ] `/security-review` on the branch diff.

Verification: record findings in the PR body. Pay special attention to founding-circle PII, admin auth,
and accidental public listing of submissions.

---

## Task 13: Final Pre-Push Verification + PR

**Files:**
- Review: full branch diff.
- Read: `.github/pull_request_template.md`

**Interfaces:**
- Produces a PR carrying the cross-agent contract.

- [ ] Check status and diff.

```bash
git status --short
git diff --stat
```

Expected: only Sprint 103 files plus generated docs. Do not stage `scripts/founding-circle-submissions.sh`.

- [ ] Stage source and generated docs.

```bash
git add services/community-service/src/services/fissionService.ts services/community-service/tests/tdd/sprint-103-split-child-admin.test.ts
git add apps/frontend/src/lib/requestActionCopy.ts apps/frontend/src/components/Feed/RequestCard.tsx apps/frontend/src/pages/requests/[id].tsx apps/frontend/tests/tdd/sprint-103-offer-action-copy.test.tsx
git add services/auth-service/src/database/foundingCircleDb.ts services/auth-service/src/routes/foundingCircle.ts services/auth-service/tests/tdd/foundingCircleReview.route.test.ts
git add apps/frontend/src/lib/api.ts apps/frontend/src/pages/admin/founding-circle.tsx apps/frontend/src/components/admin/AdminLayout.tsx apps/frontend/tests/tdd/sprint-103-founding-circle-admin.test.tsx
git add docs/guides/community-fission.md docs/concepts/governance.md docs/concepts/community-and-provider-two-facets.md docs/guides/using-service-providers-guide.md docs/adr/ADR-076-founding-circle-intake.md apps/frontend/CONTEXT.md services/auth-service/CONTEXT.md services/community-service/CONTEXT.md services/registry.json .claude/handoff/CURRENT_HANDOFF.md
git add -f apps/landing/src/data/docs
```

- [ ] Confirm staged files exclude unrelated local work.

```bash
git diff --cached --name-only
```

Expected: no untracked local scripts and no unrelated files.

- [ ] Commit.

```bash
git commit -m "Sprint 103: governance and intake clarity"
```

- [ ] Push branch.

```bash
git push -u origin feature/sprint-103-governance-intake-clarity
```

- [ ] Create PR with the full template. `gh pr create` does not auto-inject the template.

```bash
gh pr create --base master --head feature/sprint-103-governance-intake-clarity --title "Sprint 103: Governance + Intake Clarity" --body-file .github/pull_request_template.md
```

- [ ] Fill every required PR contract section, including tests, docs, risk, and security dismissals if
CodeQL re-flags the known `api.ts` trusted-baseURL false positive.

- [ ] Watch checks.

```bash
gh pr checks --watch
```

Expected: all required checks green. Do not self-merge; Admin/Claude owns merge authority.

---

## Task 14: Merge + Deploy

**Files:**
- Use: `.claude/skills/deploy/SKILL.md`

**Interfaces:**
- Produces deployed demo after Admin authorization.

- [ ] After Admin authorizes merge/deploy, use the `/deploy` skill.

- [ ] Confirm GitHub Actions deploy succeeds.

```bash
gh run list --limit 5
gh run watch
```

Expected: deploy to demo green.

- [ ] If deploy fails due to migration or service health, follow the deploy skill rollback/diagnosis path.

---

## Sprint 103 - Post-Deploy Validation (Human Checklist)

### 1. Split admin smoke test

Create or use an approved split where the executing parent admin is assigned to only one child, execute it,
then inspect children.

Expected: executing admin is admin only in their assigned child; sibling child has one assigned member as
admin; the siblings still have an active `split_origin` link.

### 2. Offer action copy smoke test

Open a mutual-aid ask and a service ask from feed/card and detail.

Expected: mutual-aid surfaces say "Offer to Help"; service surfaces say "Offer service"; offering still
creates the same match.

### 3. Founding-circle review smoke test

Log in as an existing community admin and open `https://karmyq.com/admin/founding-circle`.

Expected: submissions load, status filter works, and marking a row reviewed/contacted/archived updates
the row without sending any notification.

### 4. API verification

```bash
curl -H "Authorization: Bearer $TOKEN" "https://karmyq.com/api/founding-circle/submissions?status=new" | jq '.data.items | length'
```

Expected: authenticated reviewer gets a numeric length; non-reviewer gets `403 FORBIDDEN`.
