import express from 'express';
import request from 'supertest';
const mockQuery = jest.fn(), mockPublish = jest.fn();
jest.mock('../../src/database/db', () => ({ query: (...a: any[]) => mockQuery(...a), withTransaction: (fn: any) => fn((...a: any[]) => mockQuery(...a)) }));
jest.mock('../../src/events/publisher', () => ({ publishEvent: (...a: any[]) => mockPublish(...a) }));
import router from '../../src/routes/inventory';
const R = '10000000-0000-4000-8000-000000000001', O = '10000000-0000-4000-8000-000000000002', C = '20000000-0000-4000-8000-000000000001', I = '30000000-0000-4000-8000-000000000001';
const app = express(); app.use(express.json()); app.use((req: any, _res, next) => { req.user = { userId: R }; next(); }); app.use('/inventory', router);
let saved: any;
beforeEach(() => {
  saved = undefined; mockPublish.mockReset().mockRejectedValue(new Error('Redis unavailable'));
  mockQuery.mockReset().mockImplementation(async (sql: string) => {
    if (sql.includes('FROM inventory.items')) return { rows: [{ id: I, owner_user_id: O, name: 'Ladder', category: 'tools', status: 'available' }] };
    if (sql.includes('FROM requests.help_requests') && sql.includes('inventory_item_id')) return { rows: saved ? [saved] : [] };
    if (sql.includes('INSERT INTO requests.help_requests')) { saved = { id: 'ask', requester_id: R }; return { rows: [saved] }; }
    if (sql.includes('communities.members')) return { rows: [{ user_id: R }, { user_id: O }] };
    if (sql.includes('inventory.item_shares')) return { rows: [{}] };
    return { rows: [] };
  });
});
it('returns the committed ask despite a queue failure and persists a delivery record', async () => {
  const res = await request(app).post(`/inventory/items/${I}/borrow`).send({ community_id: C, duration_days: 3 });
  expect(res.status).toBe(201); expect(res.body.data.id).toBe('ask');
  expect(mockQuery.mock.calls.some(([sql]) => sql.includes('INSERT INTO inventory.borrow_notification_outbox'))).toBe(true);
});
it('reuses an existing open ask under the item lock instead of creating a second row/event', async () => {
  const first = await request(app).post(`/inventory/items/${I}/borrow`).send({ community_id: C, duration_days: 3 });
  const second = await request(app).post(`/inventory/items/${I}/borrow`).send({ community_id: C, duration_days: 3 });
  expect(first.status).toBe(201); expect(second.status).toBe(201); expect(second.body.data.id).toBe(first.body.data.id);
  expect(mockQuery.mock.calls.filter(([sql]) => sql.includes('INSERT INTO requests.help_requests'))).toHaveLength(1);
  expect(mockPublish).toHaveBeenCalledTimes(1);
});
