/**
 * Sprint 85 / ADR-066 — Withdraw Offer verify-lock (decision-band critical path).
 *
 * The unified feed's decision band wires "Withdraw Offer" to PUT /matches/:id/reject for the
 * RESPONDER (the helper who made the offer). Sprint 62 already locked that both participants may
 * call reject; this locks the branch the band depends on but S62 did NOT cover: when the
 * responder withdraws their ONLY proposed offer, the request must REOPEN (status → 'open') so it
 * returns to the feed. A non-participant is still refused.
 *
 * Asserts the reopen SQL actually fires (no shallow 200-only check), per the robust-testing standard.
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

const PROPOSED_MATCH = {
  id: 'match-1',
  request_id: 'req-1',
  requester_id: 'requester-user',
  responder_id: 'helper-user',
  status: 'proposed',
};

async function buildMatchesApp(userId: string) {
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

describe('Sprint 85: decision-band Withdraw Offer (PUT /matches/:id/reject)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPublishEvent.mockResolvedValue(undefined);
  });

  it('lets the responder withdraw their only offer AND reopens the request', async () => {
    mockQuery
      .mockResolvedValueOnce({ rowCount: 1, rows: [PROPOSED_MATCH] }) // matchCheck
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ id: 'req-1' }] })// lockRequest: SELECT request FOR UPDATE (race serialization)
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ status: 'open' }] }) // lockRequest: derived status
      .mockResolvedValueOnce({ rowCount: 1, rows: [] })              // conditional UPDATE matches SET status='rejected'
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ id: 'req-1' }] })// reconcile: request row lock
      .mockResolvedValueOnce({ rowCount: 1, rows: [] });             // reconcile: derive help_requests.status (no proposal left → open)

    const app = await buildMatchesApp('helper-user'); // the RESPONDER
    const res = await request(app).put('/matches/match-1/reject').send();

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    // The match was rejected...
    const rejectCall = mockQuery.mock.calls.find(
      ([sql]) => /UPDATE\s+requests\.matches/i.test(sql) && /status\s*=\s*'rejected'/i.test(sql),
    );
    expect(rejectCall).toBeDefined();

    // ...and the request's status was re-derived from its rows (Sprint 135, BUG-075): with no proposal, exchange or
    // dibs left the derivation yields 'open', so the request returns to the feed. The reconcile replaces the old
    // unconditional `SET status = 'open'` write.
    const reconcileCall = mockQuery.mock.calls.find(
      ([sql]) => /UPDATE\s+requests\.help_requests\s+r\s+SET\s+status\s*=\s*CASE/i.test(sql),
    );
    expect(reconcileCall).toBeDefined();
    expect(reconcileCall![0]).toMatch(/ELSE\s+'open'\s+END/);
    expect(reconcileCall![0]).toMatch(/r\.status\s*<>\s*'cancelled'/);
    expect(reconcileCall![1]).toEqual(['req-1']);

    expect(mockPublishEvent).toHaveBeenCalledWith(
      'match_rejected',
      expect.objectContaining({ match_id: 'match-1', request_id: 'req-1' }),
    );
  });

  it('reject never writes a literal request status: it derives the request, so other proposed offers keep it open', async () => {
    mockQuery
      .mockResolvedValueOnce({ rowCount: 1, rows: [PROPOSED_MATCH] }) // matchCheck
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ id: 'req-1' }] })// lockRequest: SELECT request FOR UPDATE (race serialization)
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ status: 'open' }] }) // lockRequest: derived status
      .mockResolvedValueOnce({ rowCount: 1, rows: [] })              // conditional UPDATE matches SET status='rejected'
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ id: 'req-1' }] })// reconcile: request row lock
      .mockResolvedValueOnce({ rowCount: 1, rows: [] });             // reconcile: derive (other proposals remain, still open)

    const app = await buildMatchesApp('helper-user');
    const res = await request(app).put('/matches/match-1/reject').send();

    expect(res.status).toBe(200);
    // Sprint 135: no statement writes a literal 'open'; the status is derived (the old row-count branch is gone).
    const requestWrites = mockQuery.mock.calls
      .map(([sql]) => String(sql).replace(/\s+/g, ' '))
      .filter((sql) => /UPDATE\s+requests\.help_requests/i.test(sql));
    // Exactly one request write, and it is the derive-only reconcile (SET status = CASE), never a literal status.
    expect(requestWrites).toHaveLength(1);
    expect(requestWrites[0]).toMatch(/SET status = CASE/);
    const literalOpenWrite = mockQuery.mock.calls.find(
      ([sql]) => /UPDATE\s+requests\.help_requests/i.test(sql) && /THEN\s+'matched'/i.test(sql) === false,
    );
    expect(literalOpenWrite).toBeUndefined();
  });

  it('refuses a non-participant (neither requester nor responder)', async () => {
    mockQuery.mockResolvedValueOnce({ rowCount: 1, rows: [PROPOSED_MATCH] }); // matchCheck

    const app = await buildMatchesApp('stranger-user');
    const res = await request(app).put('/matches/match-1/reject').send();

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    // No mutation occurred.
    expect(mockQuery.mock.calls.some(([sql]) => /UPDATE/i.test(sql))).toBe(false);
  });
});
