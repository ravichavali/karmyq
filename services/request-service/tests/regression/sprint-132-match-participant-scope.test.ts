/**
 * Sprint 132 PR S — BUG-057: match views are scoped to the authenticated participant.
 *
 * Before the fix, `GET /matches` applied only optional, client-supplied filters (no filter = every
 * match; `user_id=<anyone>` = that person's matches), and `GET /matches/:id` checked only the id. Both
 * return request titles/descriptions, and `/:id` returns requester and helper emails.
 *
 * The DB boundary is mocked here, so these tests pin the contract the SQL must carry: the caller's
 * JWT id is ALWAYS bound into a requester/responder predicate, and a client `user_id` is never bound.
 * The feedback routes mounted on /matches (src/routes/feedback.ts) had the same client-id hole. Row-level truth against real Postgres is proven by
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
const PARTICIPANT_PREDICATE = /\(\s*r\.requester_id\s*=\s*\$(\d+)\s+OR\s+m\.responder_id\s*=\s*\$\1\s*\)/;

async function buildApp(userId: string) {
  const { default: matchesRouter } = await import('../../src/routes/matches');
  const { default: feedbackRouter } = await import('../../src/routes/feedback');
  const app = express();
  app.use(express.json());
  app.use((req: any, _res: any, next: any) => {
    req.user = { userId, email: 'u@test.com', communities: [] };
    next();
  });
  app.use('/matches', matchesRouter);
  app.use('/matches', feedbackRouter); // mounted on /matches too (src/index.ts)
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

describe('BUG-057: match feedback routes take the participant from the JWT', () => {
  const MATCH = {
    id: 'match-1', status: 'completed', requester_id: 'requester-user', responder_id: 'helper-user',
    requester_visible: true, responder_visible: true,
  };

  it('GET /matches/:id/feedback → 403 for a non-participant even when ?user_id names a participant', async () => {
    mockQuery.mockResolvedValueOnce({ rowCount: 1, rows: [MATCH] });

    const res = await request(await buildApp(OTHER)).get('/matches/match-1/feedback').query({ user_id: 'requester-user' });

    expect(res.status).toBe(403);
    expect(mockQuery).toHaveBeenCalledTimes(1); // the feedback rows were never read
  });

  it('GET /matches/:id/feedback → 200 for a participant with no user_id param', async () => {
    mockQuery.mockResolvedValueOnce({ rowCount: 1, rows: [MATCH] });

    const res = await request(await buildApp('requester-user')).get('/matches/match-1/feedback');

    expect(res.status).toBe(200);
  });

  it('POST /matches/:id/feedback → 403 for a non-participant even when from_user_id names a participant', async () => {
    mockQuery.mockResolvedValueOnce({ rowCount: 1, rows: [MATCH] });

    const res = await request(await buildApp(OTHER))
      .post('/matches/match-1/feedback')
      .send({ from_user_id: 'helper-user', helpfulness: 5, responsiveness: 5, clarity: 5 });

    expect(res.status).toBe(403);
    expect(mockQuery).toHaveBeenCalledTimes(1); // nothing was written
  });

  it('POST /matches/:id/feedback writes the JWT caller as author, not the body from_user_id', async () => {
    mockQuery
      .mockResolvedValueOnce({ rowCount: 1, rows: [MATCH] })             // match lookup
      .mockResolvedValueOnce({ rowCount: 0, rows: [] })                  // existing feedback by author
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ id: 'fb-1' }] })    // INSERT
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ from_user_id: 'helper-user', allow_featuring: false }] });

    const res = await request(await buildApp('helper-user'))
      .post('/matches/match-1/feedback')
      .send({ from_user_id: 'requester-user', helpfulness: 5, responsiveness: 4, clarity: 3 });

    expect(res.status).toBeLessThan(300);
    expect(mockQuery.mock.calls[1][1]).toEqual(['match-1', 'helper-user']);
    const insertParams = mockQuery.mock.calls[2][1];
    expect(insertParams.slice(0, 3)).toEqual(['match-1', 'helper-user', 'requester-user']); // from = caller, to = the other party
  });
});
