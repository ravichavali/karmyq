/**
 * Sprint 134 BUG-074: cancel and complete change a match only while it is 'matched'.
 *
 * Mocked SQL contract: the exact guarded statements, their order (match row before request row, the same
 * order as complete), their parameters (no status is ever a parameter), the refusal codes, and that a
 * refusal writes and publishes nothing. The per-status matrix and the concurrency proof run against real
 * SQL in the root tests/integration/sprint-134-bug-074-match-status-guards.integration.test.ts.
 */

const mockQuery = jest.fn();
jest.mock('../../src/database/db', () => ({
  query: (...args: any[]) => mockQuery(...args),
  withTransaction: (fn: any) => fn((...args: any[]) => mockQuery(...args)),
}));

const mockPublishEvent = jest.fn();
jest.mock('../../src/events/publisher', () => ({ publishEvent: (...args: any[]) => mockPublishEvent(...args) }));

import express from 'express';
import request from 'supertest';

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

const MATCH = {
  id: 'match-1',
  request_id: 'req-1',
  offer_id: 'offer-1',
  requester_id: 'requester-user',
  responder_id: 'helper-user',
  status: 'matched',
};

const sqlOf = (n: number) => String(mockQuery.mock.calls[n][0]).replace(/\s+/g, ' ').trim();
const paramsOf = (n: number) => mockQuery.mock.calls[n][1];

describe('BUG-074: DELETE /matches/:id cancels only an exchange in progress', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    mockPublishEvent.mockResolvedValue(undefined);
  });

  it('guards the match write, then locks the request, reopens it conditionally and frees only a matched offer', async () => {
    mockQuery
      .mockResolvedValueOnce({ rowCount: 1, rows: [MATCH] })          // participant read
      .mockResolvedValueOnce({ rowCount: 1, rows: [] })               // guarded UPDATE matches
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ id: 'req-1' }] }) // request row lock
      .mockResolvedValueOnce({ rowCount: 1, rows: [] })               // conditional request update
      .mockResolvedValueOnce({ rowCount: 1, rows: [] });              // conditional offer update

    const res = await request(await buildApp('helper-user')).delete('/matches/match-1');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, message: 'Match cancelled successfully' });
    expect(mockQuery).toHaveBeenCalledTimes(5);
    expect(sqlOf(1)).toBe("UPDATE requests.matches SET status = 'cancelled' WHERE id = $1 AND status = 'matched'");
    expect(paramsOf(1)).toEqual(['match-1']);
    expect(sqlOf(2)).toBe('SELECT id FROM requests.help_requests WHERE id = $1 FOR UPDATE');
    expect(paramsOf(2)).toEqual(['req-1']);
    expect(sqlOf(3)).toContain(
      "SET status = CASE WHEN EXISTS (SELECT 1 FROM requests.matches m WHERE m.request_id = r.id AND m.status = 'completed') THEN 'completed' ELSE 'open' END");
    expect(sqlOf(3)).toContain(
      "WHERE r.id = $1 AND r.status = 'matched' AND NOT EXISTS (SELECT 1 FROM requests.matches m WHERE m.request_id = r.id AND m.status = 'matched')");
    expect(paramsOf(3)).toEqual(['req-1']);
    expect(sqlOf(4)).toBe("UPDATE requests.help_offers SET status = 'active' WHERE id = $1 AND status = 'matched'");
    expect(paramsOf(4)).toEqual(['offer-1']);
    expect(mockPublishEvent).toHaveBeenCalledTimes(1);
    expect(mockPublishEvent).toHaveBeenCalledWith('match_cancelled', { match_id: 'match-1', request_id: 'req-1', offer_id: 'offer-1' });
  });

  it('skips the offer statement when the match has no offer', async () => {
    mockQuery
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ ...MATCH, offer_id: null }] })
      .mockResolvedValueOnce({ rowCount: 1, rows: [] })
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ id: 'req-1' }] })
      .mockResolvedValueOnce({ rowCount: 1, rows: [] });

    const res = await request(await buildApp('requester-user')).delete('/matches/match-1');

    expect(res.status).toBe(200);
    expect(mockQuery).toHaveBeenCalledTimes(4);
    // The participant read LEFT JOINs help_offers, so match the write, not the table name.
    expect(mockQuery.mock.calls.some((args: any[]) => /UPDATE requests\.help_offers/.test(String(args[0])))).toBe(false);
  });

  it('refuses with 409 MATCH_NOT_CANCELLABLE when the guarded write changes no row: no further statement, no event', async () => {
    mockQuery
      .mockResolvedValueOnce({ rowCount: 1, rows: [MATCH] })
      .mockResolvedValueOnce({ rowCount: 0, rows: [] });

    const res = await request(await buildApp('helper-user')).delete('/matches/match-1');

    expect(res.status).toBe(409);
    expect(res.body).toEqual({
      success: false,
      message: 'Only an exchange in progress can be cancelled',
      error: 'MATCH_NOT_CANCELLABLE',
    });
    expect(mockQuery).toHaveBeenCalledTimes(2);
    expect(mockPublishEvent).not.toHaveBeenCalled();
  });

  it('answers a non-participant with 404 and writes nothing', async () => {
    mockQuery.mockResolvedValueOnce({ rowCount: 0, rows: [] });

    const res = await request(await buildApp('stranger-user')).delete('/matches/match-1');

    expect(res.status).toBe(404);
    expect(mockQuery).toHaveBeenCalledTimes(1);
    expect(mockPublishEvent).not.toHaveBeenCalled();
  });
});

describe('BUG-074: PUT /matches/:id/complete records a mark only on an exchange in progress', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    mockPublishEvent.mockResolvedValue(undefined);
  });

  it('guards the done_at write with the match status', async () => {
    mockQuery
      .mockResolvedValueOnce({ rowCount: 1, rows: [MATCH] })
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ requester_done_at: new Date(), responder_done_at: null }] });

    const res = await request(await buildApp('requester-user')).put('/matches/match-1/complete').send({});

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ fully_completed: false, waiting_for: 'helper' });
    expect(sqlOf(1)).toBe(
      "UPDATE requests.matches SET requester_done_at = CURRENT_TIMESTAMP WHERE id = $1 AND status = 'matched' RETURNING requester_done_at, responder_done_at");
    expect(paramsOf(1)).toEqual(['match-1']);
  });

  it('answers a mark that lost the race to a completion with the idempotent 200: no stamp, no event', async () => {
    mockQuery
      .mockResolvedValueOnce({ rowCount: 1, rows: [MATCH] })            // pre-read still saw 'matched'
      .mockResolvedValueOnce({ rowCount: 0, rows: [] })                 // guarded UPDATE: the row is completed now
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ status: 'completed' }] }); // re-read

    const res = await request(await buildApp('helper-user')).put('/matches/match-1/complete').send({});

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      success: true,
      data: { fully_completed: true, waiting_for: null },
      message: 'Match already completed',
    });
    expect(mockQuery).toHaveBeenCalledTimes(3);
    expect(sqlOf(2)).toBe('SELECT status FROM requests.matches WHERE id = $1');
    expect(paramsOf(2)).toEqual(['match-1']);
    expect(mockPublishEvent).not.toHaveBeenCalled();
  });

  it.each(['proposed', 'rejected', 'cancelled'])(
    'refuses a mark on a %s match with 409 MATCH_NOT_COMPLETABLE: no finalize, no event',
    async (status) => {
      mockQuery
        .mockResolvedValueOnce({ rowCount: 1, rows: [{ ...MATCH, status }] })
        .mockResolvedValueOnce({ rowCount: 0, rows: [] })
        .mockResolvedValueOnce({ rowCount: 1, rows: [{ status }] });

      const res = await request(await buildApp('requester-user')).put('/matches/match-1/complete').send({});

      expect(res.status).toBe(409);
      expect(res.body).toEqual({
        success: false,
        message: 'Only an exchange in progress can be marked done',
        error: 'MATCH_NOT_COMPLETABLE',
      });
      expect(mockQuery).toHaveBeenCalledTimes(3);
      expect(mockQuery.mock.calls.some((args: any[]) => /status = 'completed'/.test(String(args[0])))).toBe(false);
      expect(mockPublishEvent).not.toHaveBeenCalled();
    });
});
