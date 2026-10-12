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

describe('Sprint 133 retired legacy matched feed', () => {
  it('returns 404 for an authenticated caller', async () => {
    const response = await request(app(CALLER)).get('/requests/matched/for-user');
    expect(response.status).toBe(404);
    expect(mockQuery).not.toHaveBeenCalled();
  });

  it('returns 404 even when a legacy client sends user_id', async () => {
    const response = await request(app(CALLER))
      .get(`/requests/matched/for-user?user_id=${OTHER}&limit=4`);
    expect(response.status).toBe(404);
    expect(mockQuery).not.toHaveBeenCalled();
  });

  it('has no anonymous handler or database access', async () => {
    const response = await request(app()).get(`/requests/matched/for-user?user_id=${OTHER}`);
    expect(response.status).toBe(404);
    expect(mockQuery).not.toHaveBeenCalled();
  });
});
