/**
 * Sprint 92 — BUG-008: matching logic strands help_offers in 'matched' state.
 *
 * ── ROOT CAUSE (diagnosis-first, systematic-debugging) ────────────────────────
 * When a match is CREATED (matches.ts POST /, ~L224) its linked help_offer is set
 * to status = 'matched'. But the offer is only ever restored to 'active' by the
 * DELETE/cancel path (matches.ts ~L619). Two other lifecycle transitions that take
 * a match out of play never free the offer:
 *
 *   1. PUT /matches/:id/reject — withdraws/rejects a match and (when no proposed
 *      siblings remain) reopens the request to 'open', but leaves the linked offer
 *      permanently 'matched'. The reject matchCheck SELECT doesn't even read
 *      offer_id, so it has no handle on the offer to reset.
 *   2. PUT /matches/:id/accept — accepts one match and bulk-rejects every sibling
 *      proposed match (~L340), but never frees those siblings' offers.
 *
 * Net effect: after a requester rejects a match, or accepts one helper (rejecting
 * the others), the affected helpers' offers stay 'matched' forever. They vanish
 * from the active-offer pool (GET /offers defaults to status='active') and the
 * reopened request can never be re-matched through them — "matching logic seems
 * broken." DELETE/cancel does it correctly; reject and accept-sibling do not.
 *
 * FIX: restore the linked offer(s) to 'active' on both the reject path and the
 * accept path's sibling rejection, mirroring the cancel path — so a reopened /
 * re-matchable request returns to a clean state and freed helpers re-enter the pool.
 *
 * These tests assert the offer-restoring queries are issued. RED before the fix
 * (no help_offers reset on reject/accept-sibling), GREEN after.
 *
 * Run: npm run test:tdd -- sprint-92-matching   (a tests/tdd/ file — `npm test`
 * = unit+regression only and would false-green this.)
 */

const mockQuery = jest.fn();
const mockClient = { query: jest.fn().mockResolvedValue({ rows: [] }), release: jest.fn() };
const mockPool = { connect: jest.fn().mockResolvedValue(mockClient) };
jest.mock('../../src/database/db', () => ({
  __esModule: true,
  default: mockPool,
  query: (...args: any[]) => mockQuery(...args),
  // Run the transaction body inline against mockQuery so the existing per-statement
  // mock sequences and call assertions hold unchanged.
  withTransaction: (fn: any) => fn((...args: any[]) => mockQuery(...args)),
}));

const mockPublishEvent = jest.fn();
jest.mock('../../src/events/publisher', () => ({ publishEvent: (...args: any[]) => mockPublishEvent(...args) }));

// Pass-through auth that injects the JWT identity from an x-test-user header.
jest.mock('@karmyq/shared/middleware/auth', () => ({
  authMiddleware: (req: any, _res: any, next: any) => {
    req.user = { userId: req.headers['x-test-user'] || 'requester-user', email: 'u@test.com', communities: [] };
    next();
  },
}));

import express from 'express';
import request from 'supertest';

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

/** Find a query call that resets a help_offer to 'active', returning its params. */
function findOfferReactivation(): any[] | undefined {
  const call = mockQuery.mock.calls.find(([sql, params]: [string, any[]]) =>
    typeof sql === 'string' &&
    /help_offers/i.test(sql) &&
    /status\s*=\s*'active'/i.test(sql) &&
    Array.isArray(params)
  );
  return call?.[1];
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

describe('Sprint 92 BUG-008: rejecting/accepting a match frees the linked offer(s)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPublishEvent.mockResolvedValue(undefined);
    // Generic default so unanticipated queries don't crash the handler.
    mockQuery.mockResolvedValue({ rowCount: 1, rows: [{ count: '0' }] });
  });

  it('reject: restores the linked help_offer to active so the helper re-enters the pool', async () => {
    mockQuery
      .mockResolvedValueOnce({ rowCount: 1, rows: [PROPOSED_MATCH] }) // matchCheck (must expose offer_id)
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ id: 'req-1' }] })// SELECT request FOR UPDATE
      .mockResolvedValueOnce({ rowCount: 1, rows: [] })               // conditional UPDATE matches status='rejected'
      .mockResolvedValueOnce({ rowCount: 1, rows: [] })               // UPDATE help_offers status='active'
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ count: '0' }] }) // remaining proposed = 0 → reopen
      .mockResolvedValueOnce({ rowCount: 1, rows: [] });              // UPDATE help_requests status='open'

    const app = await buildMatchesApp('helper-user');
    const res = await request(app).put('/matches/match-1/reject').send({});

    expect(res.status).toBe(200);
    const params = findOfferReactivation();
    expect(params).toBeDefined();
    expect(params).toContain('offer-1');
  });

  it('accept: frees the offers of the sibling matches it rejects', async () => {
    mockQuery
      .mockResolvedValueOnce({ rowCount: 1, rows: [PROPOSED_MATCH] })                       // matchCheck
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ request_type: 'generic', payload: null }] }) // requestData
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ id: 'req-1' }] })                      // SELECT request FOR UPDATE (lock)
      .mockResolvedValueOnce({ rowCount: 1, rows: [] })                                     // UPDATE matches accept (conditional, rowCount 1)
      .mockResolvedValueOnce({ rowCount: 1, rows: [] })                                     // UPDATE help_requests matched
      .mockResolvedValueOnce({ rowCount: 1, rows: [] })                                     // UPDATE sibling help_offers active
      .mockResolvedValueOnce({ rowCount: 1, rows: [] })                                     // UPDATE sibling matches rejected
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ id: 'match-1', request_type: 'generic', payload: null, request_title: 'X' }] }); // enriched

    const app = await buildMatchesApp('requester-user');
    const res = await request(app).put('/matches/match-1/accept').send({});

    expect(res.status).toBe(200);
    // A help_offers → 'active' reset query must be issued for the rejected siblings.
    const resetCall = mockQuery.mock.calls.find(([sql]: [string]) =>
      typeof sql === 'string' && /help_offers/i.test(sql) && /status\s*=\s*'active'/i.test(sql)
    );
    expect(resetCall).toBeDefined();
  });

  it('reject: returns 409 and mutates nothing when the match already left proposed (raced an accept)', async () => {
    mockQuery
      .mockResolvedValueOnce({ rowCount: 1, rows: [PROPOSED_MATCH] }) // matchCheck (stale read: accept landed after)
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ id: 'req-1' }] })// SELECT request FOR UPDATE
      .mockResolvedValueOnce({ rowCount: 0, rows: [] });              // conditional reject matched 0 rows → conflict

    const app = await buildMatchesApp('helper-user');
    const res = await request(app).put('/matches/match-1/reject').send({});

    expect(res.status).toBe(409);
    expect(res.body.error).toBe('MATCH_NOT_PROPOSED');
    // A lost reject race must not free the offer, reopen the request, or publish.
    expect(mockPublishEvent).not.toHaveBeenCalled();
    const mutation = mockQuery.mock.calls.find(([sql]: [string]) =>
      typeof sql === 'string' && /UPDATE requests\.(help_offers|help_requests)/i.test(sql)
    );
    expect(mutation).toBeUndefined();
  });

  it('accept: returns 409 when a sibling won the race (conditional update matches 0 rows)', async () => {
    mockQuery
      .mockResolvedValueOnce({ rowCount: 1, rows: [PROPOSED_MATCH] })                       // matchCheck
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ request_type: 'generic', payload: null }] }) // requestData
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ id: 'req-1' }] })                      // SELECT request FOR UPDATE
      .mockResolvedValueOnce({ rowCount: 0, rows: [] });                                    // conditional accept matched 0 rows → conflict

    const app = await buildMatchesApp('requester-user');
    const res = await request(app).put('/matches/match-1/accept').send({});

    expect(res.status).toBe(409);
    expect(res.body.error).toBe('ALREADY_MATCHED');
    // Must NOT have transitioned the request or published an accept.
    expect(mockPublishEvent).not.toHaveBeenCalled();
    const requestMatched = mockQuery.mock.calls.find(([sql]: [string]) =>
      typeof sql === 'string' && /help_requests/i.test(sql) && /status\s*=\s*'matched'/i.test(sql)
    );
    expect(requestMatched).toBeUndefined();
  });
});

describe('Sprint 92 BUG-007: neighbor first-ask submit validates via the mutual-aid path', () => {
  async function buildDibsApp() {
    const { default: dibsRouter } = await import('../../src/routes/dibs');
    const app = express();
    app.use(express.json());
    app.use('/requests', dibsRouter);
    return app;
  }

  beforeEach(() => {
    jest.clearAllMocks();
    mockPublishEvent.mockResolvedValue(undefined);
    mockClient.query.mockResolvedValue({ rows: [] });
    mockPool.connect.mockResolvedValue(mockClient);
  });

  it('accepts a valid neighbor on a non-service request (validated against auth.users, not provider_profiles)', async () => {
    const future = new Date(Date.now() + 24 * 60 * 60 * 1000);
    mockQuery
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ id: 'req-1', requester_id: 'requester-user', scheduled_for: null, status: 'open', request_type: 'generic' }] }) // request lookup
      .mockResolvedValueOnce({ rowCount: 0, rows: [] })                                   // getDibsByRequestId → none
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ community_id: 'c1' }] })             // request_communities
      .mockResolvedValueOnce({ rows: [{ providerId: 'n1', providerUserId: 'neighbor-user', displayName: 'N', trustScore: 55, priorInteractions: 1, trustGraphConnection: 'direct' }] }) // mutual-aid candidates
      .mockResolvedValueOnce({ rows: [{ id: 'dibs-1', request_id: 'req-1', requester_id: 'requester-user', provider_user_id: 'neighbor-user', status: 'pending', expires_at: future }] }); // createDibs

    const app = await buildDibsApp();
    const res = await request(app)
      .post('/requests/req-1/dibs')
      .set('x-test-user', 'requester-user')
      .send({ provider_user_id: 'neighbor-user' });

    // Not a 403 NO_PRIOR_INTERACTION — the neighbor is accepted.
    expect(res.status).toBe(201);
    // Proof the branch used the mutual-aid (neighbor) query, not provider-only.
    const validated = mockQuery.mock.calls.some(([sql]: [string]) =>
      typeof sql === 'string' && /from\s+auth\.users/i.test(sql)
    );
    expect(validated).toBe(true);
    const usedProviderOnly = mockQuery.mock.calls.some(([sql]: [string]) =>
      typeof sql === 'string' && /from\s+requests\.provider_profiles/i.test(sql)
    );
    expect(usedProviderOnly).toBe(false);
  });
});
