import express from 'express';
import request from 'supertest';
const mockQuery = jest.fn();
jest.mock('../../src/database/db', () => ({ query: (...a: any[]) => mockQuery(...a), withTransaction: (fn: any) => fn((...a: any[]) => mockQuery(...a)) }));
jest.mock('../../src/events/publisher', () => ({ publishEvent: jest.fn(), initEventPublisher: jest.fn() }));
import { fetchDecisions } from '../../src/routes/requests';
import matches from '../../src/routes/matches';
import requests from '../../src/routes/requests';
import { validateRequestForOffer } from '../../src/db/providerOffersDb';
import { FeedComposer } from '../../src/services/feed/feedComposer';
const app = express(); app.use(express.json()); app.use((req: any, _res, next) => { req.user = { userId: 'outsider' }; next(); }); app.use('/matches', matches);
app.use('/requests', requests);
beforeEach(() => mockQuery.mockReset());
it.each(['requester', 'helper'])('retains mark-done and feedback decisions for a private %s', async (viewer) => {
  const row = { id: 'match', request_id: 'ask', requester_id: 'requester', responder_id: 'helper', title: 'Private ladder', category: 'borrow', created_at: 'now' };
  mockQuery.mockImplementation(async (sql: string) => ({ rows: sql.includes('NOT hr.is_directed') ? [] : sql.includes("m.status IN ('proposed', 'matched')") ? [{ ...row, status: 'matched' }] : sql.includes("m.status = 'completed'") ? [row] : [] }));
  const decisions = await fetchDecisions({} as any, viewer);
  expect(decisions.map(d => d.data.actions)).toEqual([['mark_done'], ['rate']]);
});
it.each(['open', 'completed', 'cancelled'])('conceals a private %s request at the offer boundary', async (status) => {
  mockQuery.mockResolvedValue({ rows: [{ is_directed: true, in_directed_audience: false, requester_id: 'R', status, expired: false }], rowCount: 1 });
  const res = await request(app).post('/matches').send({ request_id: 'ask' });
  expect(res.status).toBe(404); expect(res.body).toEqual({ success: false, message: 'Request not found' });
  expect(await validateRequestForOffer('ask', 'outsider')).toEqual({ valid: false, reason: 'Request not found' });
});
it('preserves new-member activity when the community has no public requests', async () => {
  mockQuery.mockImplementation(async (sql: string) => {
    if (sql.includes('SELECT c.id, c.name')) return { rows: [{ id: 'C', name: 'Neighbours' }] };
    if (sql.includes('as new_members')) return { rows: [{ exchanges_week: 0, new_members: /LEFT JOIN requests.help_requests r ON \/\* not-directed \*\//.test(sql) ? 2 : 0 }] };
    return { rows: [] };
  });
  const items = await (new FeedComposer() as any).getCommunityActivityItems('R', 10, {}, new Set());
  expect(items[0].data.new_members_count).toBe(2);
});
it.each(['/matches', '/matches/match'])('retains a demoted participant on %s', async (url) => {
  mockQuery.mockImplementation(async (sql: string) => ({ rows: sql.includes('directed_admin') ? [] : [{ id: 'match', requester_id: 'R', responder_id: 'outsider' }], rowCount: sql.includes('directed_admin') ? 0 : 1 }));
  const res = await request(app).get(url);
  expect(res.status).toBe(200);
  if (url === '/matches') expect(res.body.data.matches.map((m: any) => m.id)).toEqual(['match']);
  else expect(res.body.data.id).toBe('match');
});
it('excludes private offers from both offered-awaiting count and rows', async () => {
  mockQuery.mockImplementation(async (sql: string) => ({ rows: sql.includes('NOT hr.is_directed') ? (sql.includes('COUNT(') ? [{ count: 0 }] : []) : (sql.includes('COUNT(') ? [{ count: 1 }] : [{ match_id: 'match', request_id: 'ask', title: 'Private ladder' }]) }));
  const res = await request(app).get('/requests/offered-awaiting');
  expect(res.status).toBe(200); expect(res.body.data).toEqual({ count: 0, items: [] });
});
