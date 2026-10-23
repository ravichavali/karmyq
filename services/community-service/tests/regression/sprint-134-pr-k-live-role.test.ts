/**
 * Sprint 134 PR K (BUG-069, ADR-102): community-service admin gates re-derive the caller's role from
 * communities.members. Every stale-case token CLAIMS admin of both communities, so a 403 proves the
 * claim no longer grants anything; the positive rows send an EMPTY claim, so passing proves the gate
 * reads the row. Each positive row stops at the first validation or state check after the gate.
 *
 * Real routers; the PostgreSQL boundary, the event publisher, the fusion/split executors and (for the
 * route rows) the live-role module are mocked. The helper's own cases run against the real module; its
 * SQL is proven in tests/integration/sprint-134-pr-k-live-admin-role.integration.test.ts.
 */
import express from 'express';
import request from 'supertest';

const mockQuery = jest.fn();
jest.mock('../../src/database/db', () => ({
  __esModule: true,
  default: { query: (...args: any[]) => mockQuery(...args) },
  query: (...args: any[]) => mockQuery(...args),
  withTransaction: (fn: any) => fn({ query: (...args: any[]) => mockQuery(...args) }),
  initDatabase: jest.fn(),
}));
jest.mock('../../src/events/publisher', () => ({ publishEvent: jest.fn() }));
jest.mock('../../src/services/fusionService', () => ({ executeFusion: jest.fn() }));
jest.mock('../../src/services/fissionService', () => ({ executeSplit: jest.fn(), clusterCommunityMembers: jest.fn() }));
// Automock: every export is a jest.fn (the helper's own cases use jest.requireActual).
jest.mock('../../src/utils/liveRole');

import * as liveRole from '../../src/utils/liveRole';
import { executeFusion } from '../../src/services/fusionService';
import { executeSplit } from '../../src/services/fissionService';
import communitiesRouter from '../../src/routes/communities';
import fusionsRouter from '../../src/routes/fusions';
import splitsRouter from '../../src/routes/splits';
import trustQuestionsRouter from '../../src/routes/trust-questions';

const actual = jest.requireActual('../../src/utils/liveRole') as typeof liveRole;
const mocked = liveRole as jest.Mocked<typeof liveRole>;

const U = '10000000-0000-4000-8000-000000000001';
const C = '20000000-0000-4000-8000-000000000001';
const C2 = '20000000-0000-4000-8000-000000000002';
const PROPOSAL = '30000000-0000-4000-8000-000000000001';
const Q = '40000000-0000-4000-8000-000000000001';
const CHOICE = '40000000-0000-4000-8000-000000000002';
const STALE_ADMIN = [{ id: C, name: 'A', role: 'admin' }, { id: C2, name: 'B', role: 'admin' }];

let claim: unknown[] = [];
let fusionStatus = 'discussion';
const app = express();
app.use(express.json());
app.use((req: any, _res, next) => {
  req.user = { userId: U, email: 'u@test.example', communities: claim };
  next();
});
app.use('/communities/trust-questions', trustQuestionsRouter);
app.use('/communities', splitsRouter);
app.use('/communities', fusionsRouter);
app.use('/communities', communitiesRouter);

beforeEach(() => {
  mockQuery.mockReset();
  mockQuery.mockImplementation(async (sql: string) =>
    /^\s*SELECT \* FROM communities\.fusion_proposals WHERE id/.test(sql)
      ? { rows: [{ id: PROPOSAL, community_a_id: C, community_b_id: C2, status: fusionStatus }], rowCount: 1 }
      : { rows: [], rowCount: 0 });
  for (const fn of [mocked.getLiveRole, mocked.isLiveAdmin, mocked.isLiveAdminOfAnyCommunity, executeFusion, executeSplit]) {
    (fn as jest.Mock).mockReset();
  }
  const notApproved = () => Promise.reject(new Error('Proposal must be in approved status'));
  (executeFusion as jest.Mock).mockImplementation(notApproved);
  (executeSplit as jest.Mock).mockImplementation(notApproved);
});

const writes = () => mockQuery.mock.calls.map(([sql]) => String(sql)).filter((sql) => /^\s*(INSERT|UPDATE|DELETE)\b/i.test(sql));
type Method = 'post' | 'put' | 'delete';
const send = (method: Method, path: string, body: unknown, as: unknown[]) => {
  claim = as;
  const r = request(app)[method](path);
  return body === undefined ? r : r.send(body as object);
};

describe('liveRole helper (real module, pg mocked)', () => {
  it('reads the active row with exact params', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ role: 'moderator' }], rowCount: 1 });
    expect(await actual.getLiveRole(C, U)).toBe('moderator');
    expect(mockQuery).toHaveBeenCalledTimes(1);
    expect(mockQuery.mock.calls[0][0]).toMatch(/FROM communities\.members\s+WHERE community_id = \$1 AND user_id = \$2 AND status = 'active'/);
    expect(mockQuery.mock.calls[0][1]).toEqual([C, U]);
  });
  it('answers null when there is no active row', async () => {
    expect(await actual.getLiveRole(C, U)).toBeNull();
  });
  it("reads an active row whose role is NULL as 'member' (the column default)", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ role: null }], rowCount: 1 });
    expect(await actual.getLiveRole(C, U)).toBe('member');
  });
  it.each([[undefined, U], ['not-a-uuid', U], [C, undefined]])('answers null without a query for (%p, %p)', async (c, u) => {
    expect(await actual.getLiveRole(c, u)).toBeNull();
    expect(mockQuery).not.toHaveBeenCalled();
  });
  it('isLiveAdmin is false for a moderator and true for an admin', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ role: 'moderator' }], rowCount: 1 });
    expect(await actual.isLiveAdmin(C, U)).toBe(false);
    mockQuery.mockResolvedValueOnce({ rows: [{ role: 'admin' }], rowCount: 1 });
    expect(await actual.isLiveAdmin(C, U)).toBe(true);
  });
  it('isLiveAdminOfAnyCommunity passes [userId] and needs an active admin row', async () => {
    expect(await actual.isLiveAdminOfAnyCommunity(U)).toBe(false);
    expect(mockQuery.mock.calls[0][0]).toMatch(/WHERE user_id = \$1 AND status = 'active' AND role = 'admin'/);
    expect(mockQuery.mock.calls[0][1]).toEqual([U]);
    mockQuery.mockResolvedValueOnce({ rows: [{ '?column?': 1 }], rowCount: 1 });
    expect(await actual.isLiveAdminOfAnyCommunity(U)).toBe(true);
  });
  it('isLiveAdminOfAnyCommunity is false without a query for no user', async () => {
    expect(await actual.isLiveAdminOfAnyCommunity(undefined)).toBe(false);
    expect(mockQuery).not.toHaveBeenCalled();
  });
});

// [method, path, body, the community ids the gate must consult, live status, fusion proposal status]. Every row has
// all six: a shorter row would make it.each treat the callback's last parameter as a `done` callback.
type Row = [Method, string, unknown, string[], number, string];
const communityAdminRoutes: Row[] = [
  ['put', `/communities/${C}/tags`, { tags: 'not-an-array' }, [C], 400, 'discussion'],
  ['put', `/communities/${C}/location`, { lat: 'x', lng: 0 }, [C], 400, 'discussion'],
  ['post', `/communities/${C}/fusions`, {}, [C], 400, 'discussion'],
  ['post', `/communities/${C}/fusions/${PROPOSAL}/accept`, undefined, [C2], 422, 'discussion'],
  ['post', `/communities/${C}/fusions/${PROPOSAL}/reject`, undefined, [C2], 422, 'discussion'],
  ['post', `/communities/${C}/fusions/${PROPOSAL}/start-vote`, undefined, [C, C2], 422, 'voting'],
  ['post', `/communities/${C}/fusions/${PROPOSAL}/execute`, undefined, [C, C2], 422, 'approved'],
  ['post', `/communities/${C}/splits`, {}, [C], 400, 'discussion'],
  ['put', `/communities/${C}/splits/${PROPOSAL}/assignments`, {}, [C], 400, 'discussion'],
  ['post', `/communities/${C}/splits/${PROPOSAL}/start-vote`, undefined, [C], 404, 'discussion'],
  ['post', `/communities/${C}/splits/${PROPOSAL}/execute`, undefined, [C], 422, 'discussion'],
];

describe('community-admin gates', () => {
  it.each(communityAdminRoutes)('%s %s refuses a stale admin claim', async (method, path, body, consulted, _live, status) => {
    fusionStatus = status;
    mocked.isLiveAdmin.mockResolvedValue(false);
    const res = await send(method, path, body, STALE_ADMIN);
    expect(res.status).toBe(403);
    expect(mocked.isLiveAdmin.mock.calls).toEqual(consulted.map((c) => [c, U]));
    expect(writes()).toEqual([]);
    expect(executeFusion).not.toHaveBeenCalled();
    expect(executeSplit).not.toHaveBeenCalled();
  });
  it.each(communityAdminRoutes)('%s %s admits a live admin with an empty claim', async (method, path, body, _consulted, live, status) => {
    fusionStatus = status;
    mocked.isLiveAdmin.mockResolvedValue(true);
    expect((await send(method, path, body, [])).status).toBe(live);
  });
  it('start-vote and execute admit a live admin of the TARGET community alone', async () => {
    fusionStatus = 'voting';
    mocked.isLiveAdmin.mockImplementation(async (c) => c === C2);
    expect((await send('post', `/communities/${C}/fusions/${PROPOSAL}/start-vote`, undefined, [])).status).toBe(422);
  });
});

const anyCommunityAdminRoutes: Array<[Method, string, unknown, number]> = [
  ['post', '/communities/trust-questions', {}, 400],
  ['put', `/communities/trust-questions/${Q}`, { question_text: 'x' }, 404],
  ['delete', `/communities/trust-questions/${Q}`, undefined, 404],
  ['post', `/communities/trust-questions/${Q}/choices`, {}, 400],
  ['put', `/communities/trust-questions/${Q}/choices/${CHOICE}`, { label: 'x' }, 404],
  ['delete', `/communities/trust-questions/${Q}/choices/${CHOICE}`, undefined, 404],
];

describe('trust-question writes (admin of any community, live)', () => {
  it.each(anyCommunityAdminRoutes)('%s %s refuses a stale admin claim', async (method, path, body) => {
    mocked.isLiveAdminOfAnyCommunity.mockResolvedValue(false);
    const res = await send(method, path, body, STALE_ADMIN);
    expect(res.status).toBe(403);
    expect(mocked.isLiveAdminOfAnyCommunity.mock.calls).toEqual([[U]]);
    expect(writes()).toEqual([]);
  });
  it.each(anyCommunityAdminRoutes)('%s %s admits a live admin with an empty claim', async (method, path, body, live) => {
    mocked.isLiveAdminOfAnyCommunity.mockResolvedValue(true);
    expect((await send(method, path, body, [])).status).toBe(live);
  });
});
