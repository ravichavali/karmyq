/** Real routers and SQL builders; only the PostgreSQL and queue boundaries are mocked. */
import express from 'express';
import request from 'supertest';
const mockQuery = jest.fn();
const mockPublish = jest.fn();
jest.mock('../../src/database/db', () => ({
  query: (...args: any[]) => mockQuery(...args),
  withTransaction: async (fn: any) => fn((...args: any[]) => mockQuery(...args)),
}));
jest.mock('../../src/events/publisher', () => ({ publishEvent: (...args: any[]) => mockPublish(...args) }));
import inventoryRouter from '../../src/routes/inventory';
import requestsRouter from '../../src/routes/requests';
import matchesRouter from '../../src/routes/matches';
import { getRequestReachability } from '../../src/db/eligibility';
import { buildRequestsQuery } from '../../src/utils/queryBuilder';
const R = '10000000-0000-4000-8000-000000000001';
const O = '10000000-0000-4000-8000-000000000002';
const C = '20000000-0000-4000-8000-000000000001';
const I = '30000000-0000-4000-8000-000000000001';
const ASK = '40000000-0000-4000-8000-000000000001';
const item = { id: I, owner_user_id: O, owner_community_id: null, name: 'Ladder', category: 'tools', condition: 'good', status: 'available' };
const body = { community_id: C, duration_days: 3, description: 'For painting' };
const app = (userId = R) => {
  const a = express(); a.use(express.json());
  a.use((req: any, _res, next) => { req.user = { userId, communities: [] }; next(); });
  a.use('/requests/inventory', inventoryRouter); a.use('/requests', requestsRouter); a.use('/matches', matchesRouter);
  return a;
};
beforeEach(() => {
  mockPublish.mockReset().mockResolvedValue(undefined);
  mockQuery.mockReset().mockImplementation(async (sql: string) => {
    if (sql.includes('FROM inventory.items')) return { rows: [item], rowCount: 1 };
    if (sql.includes('INSERT INTO requests.help_requests')) return { rows: [{ id: ASK }], rowCount: 1 };
    if (sql.includes('communities.members')) return { rows: [{ user_id: O }, { user_id: R }], rowCount: 2 };
    if (sql.includes('inventory.item_shares')) return { rows: [{ exists: 1 }], rowCount: 1 };
    return { rows: [], rowCount: 0 };
  });
});
it('creates a directed borrow with exact payload, target and one attribution community, then publishes privately', async () => {
  const res = await request(app()).post(`/requests/inventory/items/${I}/borrow`).send(body);
  expect(res.status).toBe(201); expect(res.body.data.id).toBe(ASK);
  const [sql, params] = mockQuery.mock.calls.find(([s]) => s.includes('INSERT INTO requests.help_requests'))!;
  expect(sql).toMatch(/is_directed/); expect(sql).toMatch(/TRUE/);
  expect(sql).toMatch(/'borrow'/); expect(params).toEqual(expect.arrayContaining([R, O, I, 'Ask to borrow Ladder']));
  expect(params.map((p: any) => { try { return JSON.parse(p); } catch { return null; } })).toContainEqual({ item_category: 'tools', duration_days: 3, condition_min: 'good' });
  const links = mockQuery.mock.calls.filter(([s]) => s.includes('INSERT INTO requests.request_communities'));
  expect(links).toHaveLength(1); expect(links[0][1]).toEqual([ASK, C]);
  expect(mockPublish.mock.calls).toEqual([['directed_request_created', { request_id: ASK, requester_id: R, recipient_user_ids: [O], title: 'Ask to borrow Ladder', inventory_item_id: I }]]);
});
it('targets live admins for community property and excludes the requester from recipients', async () => {
  mockQuery.mockImplementation(async (sql: string) => {
    if (sql.includes('FROM inventory.items')) return { rows: [{ ...item, owner_user_id: null, owner_community_id: C }], rowCount: 1 };
    if (sql.includes('INSERT INTO requests.help_requests')) return { rows: [{ id: ASK }], rowCount: 1 };
    if (sql.includes("role='admin'") || sql.includes("role = 'admin'")) return { rows: [{ user_id: O }, { user_id: R }], rowCount: 2 };
    return { rows: [{ user_id: R }, { user_id: O }], rowCount: 2 };
  });
  expect((await request(app()).post(`/requests/inventory/items/${I}/borrow`).send(body)).status).toBe(201);
  expect(mockPublish.mock.calls[0][1].recipient_user_ids).toEqual([O]);
  const insert = mockQuery.mock.calls.find(([s]) => s.includes('INSERT INTO requests.help_requests'))!;
  expect(insert[1]).toEqual(expect.arrayContaining([null, C, I]));
});
it('preserves a short optional note inside a valid ordinary request description', async () => {
  expect((await request(app()).post(`/requests/inventory/items/${I}/borrow`).send({ ...body, description: 'Hi' })).status).toBe(201);
  const [, params] = mockQuery.mock.calls.find(([s]) => s.includes('INSERT INTO requests.help_requests'))!;
  expect(params[2]).toContain('Hi'); expect(params[2].length).toBeGreaterThanOrEqual(10);
});
it('rejects the personal owner', async () => {
  expect((await request(app(O)).post(`/requests/inventory/items/${I}/borrow`).send(body)).status).toBe(400);
  expect(mockPublish).not.toHaveBeenCalled();
});
it('rejects an unavailable item visible to its community manager', async () => {
  mockQuery.mockResolvedValue({ rows: [{ ...item, status: 'unavailable' }], rowCount: 1 });
  expect((await request(app()).post(`/requests/inventory/items/${I}/borrow`).send(body)).status).toBe(400);
});
it('returns 404 when the selected community grants no item audience', async () => {
  mockQuery.mockResolvedValue({ rows: [], rowCount: 0 });
  expect((await request(app()).post(`/requests/inventory/items/${I}/borrow`).send(body)).status).toBe(404);
  expect(mockPublish).not.toHaveBeenCalled();
});
it.each([{ duration_days: 0 }, { duration_days: 1.5 }, { duration_days: 31 }, { return_date: 'yesterday' }, { return_date: '2026-02-30T00:00:00Z' }, { description: 'x'.repeat(2001) }, { is_directed: true }, { community_id: 'nope' }])('rejects invalid borrow fields %j before writing', async (fields) => {
  expect((await request(app()).post(`/requests/inventory/items/${I}/borrow`).send({ ...body, ...fields })).status).toBe(400);
  expect(mockQuery).not.toHaveBeenCalled(); expect(mockPublish).not.toHaveBeenCalled();
});
it('does not publish on transaction failure', async () => {
  mockQuery.mockImplementation(async (sql: string) => {
    if (sql.includes('FROM inventory.items')) return { rows: [item], rowCount: 1 };
    if (sql.includes('INSERT INTO requests.request_communities')) throw new Error('injected attribution failure');
    if (sql.includes('INSERT INTO requests.help_requests')) return { rows: [{ id: ASK }], rowCount: 1 };
    return { rows: [{ user_id: R }, { user_id: O }], rowCount: 2 };
  });
  expect((await request(app()).post(`/requests/inventory/items/${I}/borrow`).send(body)).status).toBe(500);
  expect(mockPublish).not.toHaveBeenCalled();
});
it.each(['is_directed', 'directed_to_user_id', 'directed_to_community_id', 'inventory_item_id'])('rejects %s even when null or false on ordinary POST /requests', async (field) => {
  expect((await request(app()).post('/requests').send({ title: 'Can I borrow a ladder?', description: 'For painting my house this weekend', community_id: C, request_type: 'generic', [field]: null })).status).toBe(400);
  expect(mockQuery).not.toHaveBeenCalled();
});
it.each([
  [true, false, O, false, null], [true, true, O, true, 'directed'], [true, true, R, false, null],
])('directed eligibility ignores community/sister/platform access (%j)', async (directed, audience, requester, reachable, tier) => {
  mockQuery.mockResolvedValue({ rows: [{ is_directed: directed, in_directed_audience: audience, requester_id: requester, status: 'open', expired: false, visibility_scope: 'platform', is_member: true, sister_reachable: true }], rowCount: 1 });
  const result = await getRequestReachability(ASK, R);
  expect(result.reachable).toBe(reachable); expect(result.reachability).toBe(tier);
});
it('uses NOT_IN_AUDIENCE for an unrelated directed offer', async () => {
  mockQuery.mockResolvedValue({ rows: [{ is_directed: true, in_directed_audience: false, requester_id: O, status: 'open', expired: false, visibility_scope: 'platform' }], rowCount: 1 });
  const res = await request(app()).post('/matches').send({ request_id: ASK });
  expect(res.status).toBe(403); expect(res.body.error).toBe('NOT_IN_AUDIENCE');
});
it.each([undefined, O])('browse excludes directed when requester filter is %s', (requester_id) => {
  expect(buildRequestsQuery({ requester_id, viewer_id: R }).queryText).toContain('/* not-directed */ NOT r.is_directed');
});
it('own list admits only the caller\'s directed rows, with correct bound placeholder after other filters', () => {
  const { queryText, params } = buildRequestsQuery({ requester_id: R, viewer_id: R, community_id: C, status: 'open', include_admin_notes: 'true' });
  expect(queryText).toContain('/* directed-audience */'); expect(queryText).toContain('r.requester_id = $3');
  expect(params[2]).toBe(R);
});
