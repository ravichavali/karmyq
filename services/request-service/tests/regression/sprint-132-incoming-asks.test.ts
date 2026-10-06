import express from 'express';
import request from 'supertest';
const mockQuery = jest.fn();
jest.mock('../../src/database/db', () => ({ query: (...args: any[]) => mockQuery(...args), withTransaction: (fn: any) => fn(mockQuery) }));
import router from '../../src/routes/inventory';
it('binds the JWT caller, guards audience and selects unanswered open/unexpired asks in newest order', async () => {
  mockQuery.mockReset().mockResolvedValue({ rows: [{ id: 'ask-r', requester_name: 'Riley', payload: { duration_days: 3 } }], rowCount: 1 });
  const app = express(); app.use((req: any, _res, next) => { req.user = { userId: 'owner' }; next(); }); app.use('/requests/inventory', router);
  const res = await request(app).get('/requests/inventory/asks/incoming?user_id=stranger');
  expect(res.status).toBe(200); expect(res.body.data.asks.map((a: any) => a.id)).toEqual(['ask-r']);
  const [sql, params] = mockQuery.mock.calls[0];
  expect(params).toEqual(['owner']); expect(sql).toContain('/* directed-audience */');
  expect(sql).toMatch(/r\.is_directed/); expect(sql).toMatch(/r\.requester_id\s*<>\s*\$1/);
  expect(sql).toMatch(/r\.status\s*=\s*'open'/); expect(sql).toMatch(/r\.expired\s*=\s*FALSE/);
  expect(sql).toMatch(/NOT EXISTS/); expect(sql).toContain("'proposed', 'matched'");
  expect(sql).toMatch(/responder_id\s*=\s*\$1/); expect(sql).toContain('ORDER BY r.created_at DESC');
});
