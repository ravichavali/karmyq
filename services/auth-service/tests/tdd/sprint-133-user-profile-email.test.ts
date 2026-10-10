import express from 'express';
import request from 'supertest';

// BUG-062: GET /users/:userId was anonymous and returned the user's email to anyone. It now requires
// authentication and returns `email` only when the caller reads their own profile.
const mockQuery = jest.fn();
jest.mock('../../src/database/db', () => ({ query: (...args: unknown[]) => mockQuery(...args) }));
jest.mock('@karmyq/shared/middleware', () => ({
  // Stand-in for the real JWT check: no x-test-user header means no valid token.
  authMiddleware: (req: any, res: any, next: any) => {
    const userId = req.headers['x-test-user'];
    if (!userId) return res.status(401).json({ success: false, message: 'No token provided', error: 'UNAUTHORIZED' });
    req.user = { userId, email: `${userId}@example.test`, communities: [] };
    next();
  },
}));

import usersRouter from '../../src/routes/users';

const SELF = '11111111-1111-1111-1111-111111111111';
const OTHER = '22222222-2222-2222-2222-222222222222';

function app() {
  const server = express();
  server.use(express.json());
  server.use('/users', usersRouter);
  return server;
}

beforeEach(() => {
  mockQuery.mockReset();
  mockQuery.mockImplementation(async (sql: string, params: unknown[] = []) => {
    const withEmail = /\bemail\b/i.test(sql);
    return {
      rowCount: 1,
      rows: [{
        id: params[0], name: 'Person', bio: null, avatar_url: null,
        ...(withEmail ? { email: `${params[0]}@private.test` } : {}),
      }],
    };
  });
});

describe('GET /users/:userId email exposure (BUG-062)', () => {
  it('rejects an anonymous caller with 401 before querying', async () => {
    const res = await request(app()).get(`/users/${OTHER}`);
    expect(res.status).toBe(401);
    expect(mockQuery).not.toHaveBeenCalled();
  });

  it('returns another user profile without email, and never selects it', async () => {
    const res = await request(app()).get(`/users/${OTHER}`).set('x-test-user', SELF);
    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(OTHER);
    expect(res.body.data).not.toHaveProperty('email');
    expect(String(mockQuery.mock.calls[0][0])).not.toMatch(/\bemail\b/i);
  });

  it('returns the caller own profile with email', async () => {
    const res = await request(app()).get(`/users/${SELF}`).set('x-test-user', SELF);
    expect(res.status).toBe(200);
    expect(res.body.data.email).toBe(`${SELF}@private.test`);
  });
});
