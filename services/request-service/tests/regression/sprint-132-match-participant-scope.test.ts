/**
 * Sprint 132 PR S — BUG-057: match views are scoped to the authenticated participant.
 *
 * Before the fix, `GET /matches` applied only optional, client-supplied filters (no filter = every
 * match; `user_id=<anyone>` = that person's matches), and `GET /matches/:id` checked only the id. Both
 * return request titles/descriptions, and `/:id` returns requester and helper emails.
 *
 * The DB boundary is mocked here, so these tests pin the contract the SQL must carry: the caller's
 * JWT id is ALWAYS bound into a requester/responder/offerer predicate, and a client `user_id` is
 * never bound. Row-level truth against real Postgres is proven by
 * tests/integration/sprint-132-security-authz.integration.test.ts.
 */

const mockQuery = jest.fn();
jest.mock('../../src/database/db', () => ({
  query: (...args: any[]) => mockQuery(...args),
  withTransaction: (fn: any) => fn((...args: any[]) => mockQuery(...args)),
}));
jest.mock('../../src/events/publisher', () => ({ publishEvent: jest.fn() }));

import express from 'express';
import request from 'supertest';

const CALLER = 'caller-user';
const OTHER = 'other-user';
const PARTICIPANT_PREDICATE = /\(\s*r\.requester_id\s*=\s*\$(\d+)\s+OR\s+m\.responder_id\s*=\s*\$\1\s+OR\s+o\.offerer_id\s*=\s*\$\1\s*\)/;

async function buildApp(userId: string) {
  const { default: matchesRouter } = await import('../../src/routes/matches');
  const app = express();
  app.use(express.json());
  app.use((req: any, _res: any, next: any) => {
    req.user = { userId, email: 'u@test.com', communities: [] };
    next();
  });
  app.use('/matches', matchesRouter);
  return app;
}

/** The bound value of the participant placeholder in the one SQL call made. */
function participantBinding(): unknown {
  expect(mockQuery).toHaveBeenCalledTimes(1);
  const [sql, params] = mockQuery.mock.calls[0];
  const match = PARTICIPANT_PREDICATE.exec(sql);
  expect(match).not.toBeNull();
  return params[Number(match![1]) - 1];
}

beforeEach(() => {
  mockQuery.mockReset();
  mockQuery.mockResolvedValue({ rowCount: 0, rows: [] });
});

describe('BUG-057: GET /matches is always scoped to the JWT caller', () => {
  it('with no filters, binds the caller into the participant predicate', async () => {
    const res = await request(await buildApp(CALLER)).get('/matches');

    expect(res.status).toBe(200);
    expect(participantBinding()).toBe(CALLER);
  });

  it('ignores a spoofed user_id: the other user\'s id is never bound', async () => {
    await request(await buildApp(CALLER)).get('/matches').query({ user_id: OTHER });

    expect(participantBinding()).toBe(CALLER);
    expect(mockQuery.mock.calls[0][1]).not.toContain(OTHER);
  });

  it('keeps request_id/status as narrowing filters on top of the participant predicate', async () => {
    await request(await buildApp(CALLER)).get('/matches').query({ request_id: 'req-1', status: 'proposed' });

    expect(participantBinding()).toBe(CALLER);
    const params = mockQuery.mock.calls[0][1];
    expect(params).toEqual(expect.arrayContaining(['req-1', 'proposed']));
  });

  it('401 without an authenticated identity, and no query runs', async () => {
    const { default: matchesRouter } = await import('../../src/routes/matches');
    const app = express();
    app.use('/matches', matchesRouter);

    const res = await request(app).get('/matches');

    expect(res.status).toBe(401);
    expect(mockQuery).not.toHaveBeenCalled();
  });
});

describe('BUG-057: GET /matches/:id is visible only to a participant', () => {
  it('binds the match id AND the caller into the participant predicate', async () => {
    await request(await buildApp(CALLER)).get('/matches/match-1');

    expect(participantBinding()).toBe(CALLER);
    expect(mockQuery.mock.calls[0][1]).toContain('match-1');
  });

  it('404 when the caller is not a participant (the query returns no row)', async () => {
    const res = await request(await buildApp(OTHER)).get('/matches/match-1');

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });

  it('200 with the row when the caller is a participant', async () => {
    mockQuery.mockResolvedValue({ rowCount: 1, rows: [{ id: 'match-1', requester_id: CALLER }] });

    const res = await request(await buildApp(CALLER)).get('/matches/match-1');

    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe('match-1');
  });
});
