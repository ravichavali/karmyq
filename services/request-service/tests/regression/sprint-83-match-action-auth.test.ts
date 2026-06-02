/**
 * Sprint 83: Match-action authorization hardening (ADR-064)
 *
 * The accept/reject/complete handlers sit behind authMiddleware but historically
 * authorized against `req.body.user_id` — a client-supplied, forgeable field.
 * Any logged-in user could act on another user's match by sending the right id.
 *
 * These tests lock the contract: authorization is derived from the authenticated
 * JWT identity (`req.user.userId`) ONLY. A `user_id` in the body is ignored — so
 * a forged body id can never grant access, and a missing body id never blocks a
 * legitimate participant.
 */

const mockQuery = jest.fn();
jest.mock('../../src/database/db', () => ({ query: (...args: any[]) => mockQuery(...args) }));

const mockPublishEvent = jest.fn();
jest.mock('../../src/events/publisher', () => ({ publishEvent: (...args: any[]) => mockPublishEvent(...args) }));

import express from 'express';
import request from 'supertest';

// Build a matches app whose authenticated identity is `userId` (as authMiddleware would set it).
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

const PROPOSED_MATCH = {
  id: 'match-1',
  request_id: 'req-1',
  offer_id: 'offer-1',
  requester_id: 'requester-user',
  responder_id: 'helper-user',
  status: 'proposed',
  admin_proposed: false,
};

const MATCHED_MATCH = {
  ...PROPOSED_MATCH,
  status: 'matched',
};

describe('Sprint 83: Match-action authorization derives identity from JWT, not body', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPublishEvent.mockResolvedValue(undefined);
  });

  // ─── reject / withdraw ────────────────────────────────────────────────────

  it('reject: lets the responder (helper) withdraw their own match → 200', async () => {
    mockQuery
      .mockResolvedValueOnce({ rowCount: 1, rows: [PROPOSED_MATCH] })       // matchCheck
      .mockResolvedValueOnce({ rowCount: 1, rows: [] })                     // UPDATE status='rejected'
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ count: '1' }] });      // remaining proposed (skip reopen)

    const app = await buildMatchesApp('helper-user');
    const res = await request(app)
      .put('/matches/match-1/reject')
      .send({}); // no user_id in body — identity is the JWT
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('reject: forbids a third user even when they forge a participant id in the body → 403', async () => {
    mockQuery.mockResolvedValueOnce({ rowCount: 1, rows: [PROPOSED_MATCH] }); // matchCheck

    const app = await buildMatchesApp('stranger-user');
    const res = await request(app)
      .put('/matches/match-1/reject')
      .send({ user_id: 'requester-user' }); // forged body id MUST be ignored
    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    // The forged body id must not have driven a state change
    expect(mockPublishEvent).not.toHaveBeenCalled();
  });

  // ─── accept ───────────────────────────────────────────────────────────────

  it('accept: forbids a non-requester JWT on a normal (non-admin-proposed) match → 403', async () => {
    mockQuery.mockResolvedValueOnce({ rowCount: 1, rows: [PROPOSED_MATCH] }); // matchCheck

    const app = await buildMatchesApp('helper-user'); // helper is responder, not requester
    const res = await request(app)
      .put('/matches/match-1/accept')
      .send({ user_id: 'requester-user' }); // forged body id MUST be ignored
    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });

  // ─── complete ───────────────────────────────────────────────────────────────

  it('complete: forbids a cross-user JWT and does NOT publish match_completed → 403', async () => {
    mockQuery.mockResolvedValueOnce({ rowCount: 1, rows: [MATCHED_MATCH] }); // matchCheck

    const app = await buildMatchesApp('stranger-user');
    const res = await request(app)
      .put('/matches/match-1/complete')
      .send({ user_id: 'requester-user' }); // forged body id MUST be ignored
    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(mockPublishEvent).not.toHaveBeenCalled();
  });

  it('complete: records done_at for a legitimate participant identified by JWT → 200', async () => {
    mockQuery
      .mockResolvedValueOnce({ rowCount: 1, rows: [MATCHED_MATCH] })        // matchCheck
      .mockResolvedValueOnce({                                              // UPDATE SET requester_done_at RETURNING
        rows: [{ requester_done_at: new Date(), responder_done_at: null }],
      });

    const app = await buildMatchesApp('requester-user');
    const res = await request(app)
      .put('/matches/match-1/complete')
      .send({}); // no user_id in body — identity is the JWT
    expect(res.status).toBe(200);
    expect(res.body.data.fully_completed).toBe(false);
    expect(res.body.data.waiting_for).toBe('helper');
  });
});
