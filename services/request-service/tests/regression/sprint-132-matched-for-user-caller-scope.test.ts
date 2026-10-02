import express from 'express';
import request from 'supertest';

const mockQuery = jest.fn();
jest.mock('../../src/database/db', () => ({
  __esModule: true,
  default: { query: (...args: unknown[]) => mockQuery(...args), connect: jest.fn() },
  query: (...args: unknown[]) => mockQuery(...args),
  withTransaction: (fn: any) => fn((...args: unknown[]) => mockQuery(...args)),
}));
jest.mock('../../src/events/publisher', () => ({ publishEvent: jest.fn() }));

import requestsRouter from '../../src/routes/requests';

const CALLER = '11111111-1111-1111-1111-111111111111';
const OTHER = '22222222-2222-2222-2222-222222222222';

function app(caller?: string) {
  const server = express();
  server.use((req: any, _res, next) => {
    if (caller) req.user = { userId: caller, email: 'caller@example.test', communities: [] };
    next();
  });
  server.use('/requests', requestsRouter);
  return server;
}

beforeEach(() => {
  mockQuery.mockReset();
  mockQuery.mockImplementation(async (_sql: string, params: unknown[]) => ({
    rows: [{ id: params[0] === CALLER ? 'caller-request' : 'other-request' }],
    rowCount: 1,
  }));
});

describe('GET /requests/matched/for-user caller scope', () => {
  it('uses the authenticated caller when user_id is omitted', async () => {
    const response = await request(app(CALLER)).get('/requests/matched/for-user');
    expect(response.status).toBe(200);
    expect(response.body.data).toEqual([{ id: 'caller-request' }]);
    expect(mockQuery.mock.calls[0][1][0]).toBe(CALLER);
  });

  it('ignores a spoofed user_id and still queries only the caller', async () => {
    const response = await request(app(CALLER))
      .get(`/requests/matched/for-user?user_id=${OTHER}&limit=4`);
    expect(response.status).toBe(200);
    expect(response.body.data).toEqual([{ id: 'caller-request' }]);
    expect(mockQuery.mock.calls[0][1]).toEqual([CALLER, '4']);
    expect(String(mockQuery.mock.calls[0][0])).toMatch(/auth\.user_tags/);
  });

  it('rejects a request without an authenticated caller before querying', async () => {
    const response = await request(app()).get(`/requests/matched/for-user?user_id=${OTHER}`);
    expect(response.status).toBe(401);
    expect(mockQuery).not.toHaveBeenCalled();
  });
});
