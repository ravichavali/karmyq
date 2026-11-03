/**
 * Sprint 135 (BUG-075, BUG-078): the ten request-status writers.
 *
 * Mocked SQL contract. Each writer takes its locks in the documented order, decides every refusal before its first
 * write, guards its own row's change in the write, and leaves the request's status to src/db/requestStatus.ts. None
 * issues a request-status UPDATE of its own. The real-row behaviour and the races run in the root
 * tests/integration/sprint-135-request-status-guards.integration.test.ts.
 */
const mockQuery = jest.fn();
jest.mock('../../src/database/db', () => ({
  __esModule: true,
  default: {},
  query: (...args: any[]) => mockQuery(...args),
  withTransaction: (fn: any) => fn((...args: any[]) => mockQuery(...args)),
}));

const mockPublishEvent = jest.fn();
jest.mock('../../src/events/publisher', () => ({ publishEvent: (...args: any[]) => mockPublishEvent(...args) }));

// Propose-match's admin check. A plain function, so no resetMocks setting can wipe it.
jest.mock('../../src/db/liveRole', () => ({
  ...jest.requireActual('../../src/db/liveRole'),
  hasLiveRoleInRequestCommunities: async () => true,
}));

// The dibs and provider-offer routers carry their own authMiddleware: inject the caller from a header instead.
jest.mock('@karmyq/shared/middleware/auth', () => ({
  authMiddleware: (req: any, _res: any, next: any) => {
    req.user = { userId: req.headers['x-test-user'], email: 'u@test.com', communities: [] };
    next();
  },
}));

import express from 'express';
import request from 'supertest';

type Reply = { rowCount: number; rows: any[] };
const rows = (r: any[] = [], rowCount = r.length): Reply => ({ rowCount, rows: r });
const flat = (sql: unknown) => String(sql).replace(/\s+/g, ' ').trim();
let replies: Array<[RegExp, Reply]> = [];
const reply = (re: RegExp, r: Reply) => { replies.push([re, r]); };

const statements = () => mockQuery.mock.calls.map(([sql, params]) => ({ sql: flat(sql), params }));
const sqls = () => statements().map((s) => s.sql);
/** Index of the first statement matching a pattern, or equal to an exact (flattened) statement. */
const at = (p: RegExp | string) => sqls().findIndex((s) => (typeof p === 'string' ? s === p : p.test(s)));
const writes = () => sqls().filter((s) => /^(UPDATE|INSERT|DELETE)\b/i.test(s));

const LOCK = /^SELECT id FROM requests\.help_requests WHERE id = \$1 FOR UPDATE$/;
/** lockRequest's second statement: the derived status every precondition reads. */
const DERIVE = /^SELECT CASE WHEN r\.status = 'cancelled'/;
const RECONCILE = /^UPDATE requests\.help_requests r SET status = CASE /;
const CANCEL_REQUEST = /^UPDATE requests\.help_requests r SET status = 'cancelled'/;
const CLOSE_OFFERS = /^UPDATE requests\.help_offers SET status = 'active', updated_at = CURRENT_TIMESTAMP WHERE status = 'matched' AND id IN/;
const CLOSE_MATCHES = /^UPDATE requests\.matches SET status = 'rejected', updated_at = CURRENT_TIMESTAMP WHERE request_id = \$1 AND status = 'proposed'$/;
/** A request-status write that is not the shared helper's: what every writer used to do. */
const OWN_STATUS_WRITE = /^UPDATE requests\.help_requests\b(?!.*SET status = CASE)(?!.*SET status = 'cancelled').*\bSET\b.*\bstatus = /;
const PARTICIPANT_READ = /FROM requests\.matches m LEFT JOIN requests\.help_requests r/;

const PROPOSED = { id: 'match-1', request_id: 'req-1', offer_id: 'offer-1', responder_id: 'helper', requester_id: 'requester', status: 'proposed', admin_proposed: false };
const MATCHED = { ...PROPOSED, status: 'matched' };

async function app() {
  const { default: requests } = await import('../../src/routes/requests');
  const { default: dibs } = await import('../../src/routes/dibs');
  const { default: adminActions } = await import('../../src/routes/adminActions');
  const { default: requesterOffers } = await import('../../src/routes/requesterOffers');
  const { default: matches } = await import('../../src/routes/matches');
  const a = express();
  a.use(express.json());
  a.use((req: any, _res: any, next: any) => {
    req.user = { userId: req.headers['x-test-user'], email: 'u@test.com', communities: [] };
    next();
  });
  // Mount order as in src/index.ts.
  a.use('/requests', requests);
  a.use('/requests', dibs);
  a.use('/requests', adminActions);
  a.use('/requests', requesterOffers);
  a.use('/matches', matches);
  return a;
}

beforeEach(() => {
  replies = [];
  mockQuery.mockReset();
  mockQuery.mockImplementation(async (sql: unknown) => {
    const text = flat(sql);
    const hit = replies.find(([re]) => re.test(text));
    return hit ? hit[1] : rows([], 1);
  });
  mockPublishEvent.mockReset();
  mockPublishEvent.mockResolvedValue(undefined);
});

describe('PUT /matches/:id/accept (BUG-075, BUG-078 #1)', () => {
  beforeEach(() => {
    reply(PARTICIPANT_READ, rows([PROPOSED]));
    reply(/^SELECT request_type, payload FROM requests\.help_requests/, rows([{ request_type: 'generic', payload: null }]));
    reply(/^SELECT m\.\*, r\.request_type/, rows([{ id: 'match-1' }]));
  });
  const accept = async () => request(await app()).put('/matches/match-1/accept').set('x-test-user', 'requester').send({});

  it('locks the open request, accepts the match, closes the other proposals and derives the request last', async () => {
    reply(DERIVE, rows([{ status: 'open' }]));
    const res = await accept();
    expect(res.status).toBe(200);
    const order = [LOCK, /^UPDATE requests\.matches SET status = 'matched'/, CLOSE_OFFERS, CLOSE_MATCHES, RECONCILE].map(at);
    expect(order.every((i) => i >= 0)).toBe(true);
    expect([...order].sort((x, y) => x - y)).toEqual(order);
    expect(sqls().filter((s) => OWN_STATUS_WRITE.test(s))).toEqual([]);
    expect(mockPublishEvent).toHaveBeenCalledWith('match_accepted', expect.objectContaining({ match_id: 'match-1' }));
  });

  it.each(['dibs_pending', 'completed', 'cancelled'])('refuses a %s request with 409 REQUEST_NOT_OPEN and writes nothing', async (status) => {
    reply(DERIVE, rows([{ status }]));
    const res = await accept();
    expect(res.status).toBe(409);
    expect(res.body).toEqual({ success: false, message: 'This request is no longer open', error: 'REQUEST_NOT_OPEN' });
    expect(writes()).toEqual([]);
    expect(mockPublishEvent).not.toHaveBeenCalled();
  });

  it('keeps ALREADY_MATCHED for a request a sibling accept already matched', async () => {
    reply(DERIVE, rows([{ status: 'matched' }]));
    const res = await accept();
    expect(res.status).toBe(409);
    expect(res.body).toEqual({ success: false, message: 'This request was just matched with someone else', error: 'ALREADY_MATCHED' });
    expect(writes()).toEqual([]);
  });
});

describe('PUT /matches/:id/reject (BUG-075, BUG-078 #1)', () => {
  it('frees the offer only while the proposal holds it, and derives the request instead of reopening it', async () => {
    reply(PARTICIPANT_READ, rows([PROPOSED]));
    reply(DERIVE, rows([{ status: 'completed' }]));
    const res = await request(await app()).put('/matches/match-1/reject').set('x-test-user', 'helper').send({});
    expect(res.status).toBe(200);
    const offer = statements().find((s) => s.sql === "UPDATE requests.help_offers SET status = 'active' WHERE id = $1 AND status = 'matched'");
    expect(offer?.params).toEqual(['offer-1']);
    expect(sqls().pop()).toMatch(RECONCILE);
    expect(sqls().filter((s) => OWN_STATUS_WRITE.test(s) || /COUNT\(\*\)/.test(s))).toEqual([]);
  });
});

describe('PUT /matches/:id/complete (BUG-078 #2, #3)', () => {
  it("records a first mark with COALESCE, so a repeat mark keeps the first mark's time, and touches no request", async () => {
    reply(PARTICIPANT_READ, rows([MATCHED]));
    reply(/^UPDATE requests\.matches SET requester_done_at/, rows([{ requester_done_at: 't1', responder_done_at: null }]));
    const res = await request(await app()).put('/matches/match-1/complete').set('x-test-user', 'requester').send({});
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ fully_completed: false, waiting_for: 'helper' });
    expect(sqls()).toContain(
      "UPDATE requests.matches SET requester_done_at = COALESCE(requester_done_at, CURRENT_TIMESTAMP) WHERE id = $1 AND status = 'matched' RETURNING requester_done_at, responder_done_at");
    expect(sqls().filter((s) => /help_requests/.test(s) && !PARTICIPANT_READ.test(s))).toEqual([]);
  });

  it('derives the request after the final mark instead of overwriting it, match row first', async () => {
    reply(PARTICIPANT_READ, rows([MATCHED]));
    reply(/^UPDATE requests\.matches SET responder_done_at/, rows([{ requester_done_at: 't1', responder_done_at: 't2' }]));
    const res = await request(await app()).put('/matches/match-1/complete').set('x-test-user', 'helper').send({});
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ fully_completed: true, waiting_for: null });
    const finalize = sqls().indexOf("UPDATE requests.matches SET status = 'completed', completed_at = CURRENT_TIMESTAMP WHERE id = $1");
    expect(finalize).toBeGreaterThan(-1);
    expect(finalize).toBeLessThan(at(LOCK));
    expect(at(LOCK)).toBeLessThan(at(RECONCILE));
    expect(sqls().filter((s) => OWN_STATUS_WRITE.test(s))).toEqual([]);
    expect(mockPublishEvent).toHaveBeenCalledWith('match_completed', expect.objectContaining({ match_id: 'match-1' }));
  });
});

describe('DELETE /matches/:id (BUG-074 cancel, now through the shared helper)', () => {
  it('derives the request after the guarded match write and before freeing the offer', async () => {
    reply(PARTICIPANT_READ, rows([MATCHED]));
    const res = await request(await app()).delete('/matches/match-1').set('x-test-user', 'helper');
    expect(res.status).toBe(200);
    const cancel = sqls().indexOf("UPDATE requests.matches SET status = 'cancelled' WHERE id = $1 AND status = 'matched'");
    const offer = sqls().indexOf("UPDATE requests.help_offers SET status = 'active' WHERE id = $1 AND status = 'matched'");
    expect(cancel).toBeGreaterThan(-1);
    expect(cancel).toBeLessThan(at(LOCK));
    expect(at(RECONCILE)).toBeGreaterThan(-1);
    expect(offer).toBeGreaterThan(-1);
    expect(at(RECONCILE)).toBeLessThan(offer);
    expect(sqls().filter((s) => OWN_STATUS_WRITE.test(s))).toEqual([]);
  });
});

describe('POST /requests/:id/propose-match (BUG-075)', () => {
  beforeEach(() => {
    reply(/^SELECT id FROM requests\.help_requests r WHERE/, rows([{ id: 'req-1' }]));
    reply(/FROM communities\.members cm JOIN requests\.request_communities rc/, rows([{ '?column?': 1 }]));
    reply(/^INSERT INTO requests\.matches \(request_id, responder_id, status, admin_proposed\)/, rows([{ id: 'match-new' }]));
  });
  const propose = async () => request(await app()).post('/requests/req-1/propose-match').set('x-test-user', 'admin').send({ user_id: 'helper' });
  const DUPLICATE_CHECK = /^SELECT id FROM requests\.matches WHERE request_id = \$1 AND responder_id = \$2 AND status = 'proposed'$/;

  it('locks the request, then checks for a duplicate and inserts, only while it is open', async () => {
    reply(DERIVE, rows([{ status: 'open' }]));
    const res = await propose();
    expect(res.status).toBe(201);
    expect(res.body).toEqual({ success: true, data: { matchId: 'match-new' } });
    const order = [LOCK, DUPLICATE_CHECK, /^INSERT INTO requests\.matches/].map(at);
    expect(order.every((i) => i >= 0)).toBe(true);
    expect([...order].sort((x, y) => x - y)).toEqual(order);
  });

  it.each(['dibs_pending', 'matched', 'completed', 'cancelled'])('refuses a %s request with 409 REQUEST_NOT_OPEN and inserts nothing', async (status) => {
    reply(DERIVE, rows([{ status }]));
    const res = await propose();
    expect(res.status).toBe(409);
    expect(res.body).toEqual({ success: false, message: 'This request is no longer open', error: 'REQUEST_NOT_OPEN' });
    expect(writes()).toEqual([]);
    expect(mockPublishEvent).not.toHaveBeenCalled();
  });
});

describe('POST /requests/:id/dibs (BUG-075)', () => {
  beforeEach(() => {
    reply(/^SELECT id, requester_id, scheduled_for, status, request_type, category, payload FROM requests\.help_requests r/,
      rows([{ id: 'req-1', requester_id: 'requester', scheduled_for: null, status: 'open', request_type: 'generic', category: 'generic', payload: null }]));
    reply(/^SELECT \* FROM requests\.dibs WHERE request_id = \$1$/, rows([]));
    reply(/^SELECT community_id FROM requests\.request_communities/, rows([{ community_id: 'c1' }]));
    reply(/FROM auth\.users u/, rows([{ providerId: 'helper', providerUserId: 'helper', displayName: 'H', trustScore: 55,
      priorInteractions: 1, similarPriorInteractions: 0, trustGraphConnection: 'direct', isAvailable: true }]));
    reply(/^INSERT INTO requests\.dibs/, rows([{ id: 'dibs-1', request_id: 'req-1', provider_user_id: 'helper', status: 'pending' }]));
  });
  const send = async () => request(await app()).post('/requests/req-1/dibs').set('x-test-user', 'requester').send({ provider_user_id: 'helper' });

  it('writes the dibs under the lock while the request is open, then derives dibs_pending', async () => {
    reply(DERIVE, rows([{ status: 'open' }]));
    const res = await send();
    expect(res.status).toBe(201);
    const order = [LOCK, /^INSERT INTO requests\.dibs/, RECONCILE].map(at);
    expect(order.every((i) => i >= 0)).toBe(true);
    expect([...order].sort((x, y) => x - y)).toEqual(order);
    expect(sqls().filter((s) => OWN_STATUS_WRITE.test(s))).toEqual([]);
  });

  it('refuses with 409 REQUEST_NOT_OPEN when the request stopped being open after the pre-read (a race)', async () => {
    reply(DERIVE, rows([{ status: 'matched' }]));
    const res = await send();
    expect(res.status).toBe(409);
    expect(res.body).toEqual({ success: false, message: 'Request is not available for dibs', error: 'REQUEST_NOT_OPEN' });
    expect(writes()).toEqual([]);
    expect(mockPublishEvent).not.toHaveBeenCalled();
  });
});

describe('PUT /requests/dibs/:id/accept (BUG-075)', () => {
  const DIBS_LOCK = /^SELECT status, expires_at > clock_timestamp\(\) AS live FROM requests\.dibs WHERE id = \$1 FOR UPDATE$/;
  const DIBS_ACCEPT = "UPDATE requests.dibs SET status = 'accepted', updated_at = NOW() WHERE id = $1 AND status = 'pending'";
  beforeEach(() => {
    reply(/^SELECT \* FROM requests\.dibs WHERE id = \$1$/, rows([{ id: 'dibs-1', request_id: 'req-1', provider_user_id: 'helper',
      status: 'pending', expires_at: new Date(Date.now() + 3_600_000).toISOString() }]));
  });
  // Replies are matched first-registered-first, so a test that needs a different dibs row registers it before this one.
  const liveDibs = () => reply(DIBS_LOCK, rows([{ status: 'pending', live: true }]));
  const accept = async () => request(await app()).put('/requests/dibs/dibs-1/accept').set('x-test-user', 'helper').send({});

  it('locks the dibs row, then the request, and accepts only while the request waits on it', async () => {
    liveDibs();
    reply(DERIVE, rows([{ status: 'dibs_pending' }]));
    const res = await accept();
    expect(res.status).toBe(200);
    const order = [DIBS_LOCK, LOCK, DIBS_ACCEPT,
      /^INSERT INTO requests\.matches \(request_id, responder_id, status\)/, CLOSE_OFFERS, CLOSE_MATCHES, RECONCILE].map(at);
    expect(order.every((i) => i >= 0)).toBe(true);
    expect([...order].sort((x, y) => x - y)).toEqual(order);
    expect(sqls().filter((s) => OWN_STATUS_WRITE.test(s))).toEqual([]);
  });

  it.each(['open', 'matched', 'completed', 'cancelled'])('refuses a %s request with 409 REQUEST_NOT_OPEN and writes nothing', async (status) => {
    liveDibs();
    reply(DERIVE, rows([{ status }]));
    const res = await accept();
    expect(res.status).toBe(409);
    expect(res.body).toEqual({ success: false, message: 'This request is no longer waiting on your dibs', error: 'REQUEST_NOT_OPEN' });
    expect(writes()).toEqual([]);
    expect(mockPublishEvent).not.toHaveBeenCalled();
  });

  it('refuses a dibs another call settled while this one waited on its lock: 409 INVALID_STATE, no write', async () => {
    reply(DIBS_LOCK, rows([{ status: 'declined', live: true }]));
    const res = await accept();
    expect(res.status).toBe(409);
    expect(res.body).toEqual({ success: false, message: 'Dibs is no longer pending', error: 'INVALID_STATE' });
    expect(writes()).toEqual([]);
    expect(at(LOCK)).toBe(-1);   // decided on the dibs row, before the request lock
  });

  it('refuses an invitation that expired while this call waited on its lock: 410 DIBS_EXPIRED, no write', async () => {
    reply(DIBS_LOCK, rows([{ status: 'pending', live: false }]));
    const res = await accept();
    expect(res.status).toBe(410);
    expect(res.body).toEqual({ success: false, message: 'This dibs invitation has expired', error: 'DIBS_EXPIRED' });
    expect(writes()).toEqual([]);
  });
});

describe('PUT /requests/dibs/:id/decline and POST /requests/dibs/:id/expire (BUG-075)', () => {
  beforeEach(() => {
    reply(/^SELECT \* FROM requests\.dibs WHERE id = \$1$/, rows([{ id: 'dibs-1', request_id: 'req-1', provider_user_id: 'helper',
      status: 'pending', expires_at: new Date(Date.now() + 3_600_000).toISOString() }]));
  });

  it('decline guards the dibs write and derives the request instead of reopening it', async () => {
    const res = await request(await app()).put('/requests/dibs/dibs-1/decline').set('x-test-user', 'helper').send({});
    expect(res.status).toBe(200);
    const decline = sqls().indexOf("UPDATE requests.dibs SET status = 'declined', updated_at = NOW() WHERE id = $1 AND status = 'pending'");
    expect(decline).toBeGreaterThan(-1);
    expect(decline).toBeLessThan(at(LOCK));
    expect(at(LOCK)).toBeLessThan(at(RECONCILE));
    expect(sqls().filter((s) => OWN_STATUS_WRITE.test(s))).toEqual([]);
  });

  it('decline refuses a dibs another call already settled with 409 INVALID_STATE and leaves the request alone', async () => {
    reply(/^UPDATE requests\.dibs SET status = 'declined'/, rows([], 0));
    const res = await request(await app()).put('/requests/dibs/dibs-1/decline').set('x-test-user', 'helper').send({});
    expect(res.status).toBe(409);
    expect(res.body).toEqual({ success: false, message: 'Dibs is no longer pending', error: 'INVALID_STATE' });
    expect(sqls().filter((s) => /help_requests/.test(s))).toEqual([]);
  });

  it('expire guards the dibs write and derives the request', async () => {
    const res = await request(await app()).post('/requests/dibs/dibs-1/expire').set('x-test-user', 'helper').send({});
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, data: { dibs_status: 'expired' } });
    const expire = sqls().indexOf("UPDATE requests.dibs SET status = 'expired', updated_at = NOW() WHERE id = $1 AND status = 'pending'");
    expect(expire).toBeGreaterThan(-1);
    expect(expire).toBeLessThan(at(RECONCILE));
    expect(sqls().filter((s) => OWN_STATUS_WRITE.test(s))).toEqual([]);
  });
});

describe('PUT /requests/offers/:id/accept (BUG-075)', () => {
  const OFFER_ACCEPT = "UPDATE provider.offers SET status = 'accepted', updated_at = NOW() WHERE id = $1 AND status = 'pending'";
  beforeEach(() => {
    reply(/^SELECT o\.\*, hr\.requester_id as requester_user_id/, rows([{ id: 'off-1', request_id: 'req-1',
      provider_user_id: 'provider', requester_user_id: 'requester', status: 'pending' }]));
  });
  const accept = async () => request(await app()).put('/requests/offers/off-1/accept').set('x-test-user', 'requester').send({});

  it('accepts in one transaction only while the request is open, and derives it last', async () => {
    reply(DERIVE, rows([{ status: 'open' }]));
    const res = await accept();
    expect(res.status).toBe(200);
    const order = [LOCK, /^UPDATE provider\.offers SET status = 'accepted'/, /^INSERT INTO requests\.matches/,
      CLOSE_OFFERS, CLOSE_MATCHES, RECONCILE].map(at);
    expect(order.every((i) => i >= 0)).toBe(true);
    expect([...order].sort((x, y) => x - y)).toEqual(order);
    expect(sqls()).toContain(OFFER_ACCEPT);
    expect(sqls().filter((s) => OWN_STATUS_WRITE.test(s))).toEqual([]);
  });

  it.each(['dibs_pending', 'matched', 'completed', 'cancelled'])('refuses a %s request with 409 REQUEST_NOT_OPEN and writes nothing', async (status) => {
    reply(DERIVE, rows([{ status }]));
    const res = await accept();
    expect(res.status).toBe(409);
    expect(res.body).toEqual({ success: false, message: 'This request is no longer open', error: 'REQUEST_NOT_OPEN' });
    expect(writes()).toEqual([]);
    expect(mockPublishEvent).not.toHaveBeenCalled();
  });

  it('answers 404 when the offer was settled concurrently, and inserts no match', async () => {
    reply(DERIVE, rows([{ status: 'open' }]));
    reply(/^UPDATE provider\.offers SET status = 'accepted'/, rows([], 0));
    const res = await accept();
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ success: false, message: 'Offer not found or not pending', error: 'NOT_FOUND' });
    expect(writes()).toEqual([OFFER_ACCEPT]);
  });
});

describe('PUT /requests/:id (BUG-075)', () => {
  beforeEach(() => {
    reply(/^SELECT requester_id FROM requests\.help_requests WHERE id = \$1 AND requester_id = \$2$/, rows([{ requester_id: 'requester' }]));
  });

  it('refuses a status in the body with 400 STATUS_NOT_EDITABLE before any write or event', async () => {
    const res = await request(await app()).put('/requests/req-1').set('x-test-user', 'requester').send({ title: 'T', status: 'open' });
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ success: false, message: "A request's status changes through its exchanges, not an edit", error: 'STATUS_NOT_EDITABLE' });
    expect(writes()).toEqual([]);
    expect(mockPublishEvent).not.toHaveBeenCalled();
  });

  it('edits the other fields with no status assignment and no request_completed event', async () => {
    reply(/^UPDATE requests\.help_requests SET/, rows([{ id: 'req-1', title: 'T' }]));
    const res = await request(await app()).put('/requests/req-1').set('x-test-user', 'requester').send({ title: 'T' });
    expect(res.status).toBe(200);
    const update = statements().find((s) => /^UPDATE requests\.help_requests SET/.test(s.sql));
    expect(update?.sql).toBe('UPDATE requests.help_requests SET title = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 AND requester_id = $3 RETURNING *');
    expect(update?.params).toEqual(['T', 'req-1', 'requester']);
    expect(mockPublishEvent).not.toHaveBeenCalledWith('request_completed', expect.anything());
  });

  it('answers a foreign id 404 even with a status in the body: access is decided before validation', async () => {
    replies = [];
    reply(/^SELECT requester_id FROM requests\.help_requests WHERE id = \$1 AND requester_id = \$2$/, rows([], 0));
    const res = await request(await app()).put('/requests/req-1').set('x-test-user', 'stranger').send({ status: 'open' });
    expect(res.status).toBe(404);
    expect(writes()).toEqual([]);
  });
});

describe('DELETE /requests/:id (BUG-075)', () => {
  const DIBS_CANCEL_LOCK = /^SELECT id FROM requests\.dibs WHERE request_id = \$1 AND status = 'pending' FOR UPDATE$/;
  const DIBS_EXPIRE_ON_CANCEL = "UPDATE requests.dibs SET status = 'expired', updated_at = NOW() WHERE id IN (SELECT id FROM requests.dibs WHERE request_id = $1 AND status = 'pending' FOR UPDATE SKIP LOCKED)";
  beforeEach(() => {
    reply(/^SELECT requester_id FROM requests\.help_requests WHERE id = \$1 AND requester_id = \$2$/, rows([{ requester_id: 'requester' }]));
  });
  const cancel = async () => request(await app()).delete('/requests/req-1').set('x-test-user', 'requester');

  it('locks a pending dibs, then the request; cancels; closes its proposals; expires the dibs; publishes request_cancelled', async () => {
    reply(DERIVE, rows([{ status: 'dibs_pending' }]));
    const res = await cancel();
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, message: 'Request cancelled successfully' });
    const order = [DIBS_CANCEL_LOCK, LOCK, CANCEL_REQUEST, CLOSE_OFFERS, CLOSE_MATCHES, DIBS_EXPIRE_ON_CANCEL].map(at);
    expect(order.every((i) => i >= 0)).toBe(true);
    expect([...order].sort((x, y) => x - y)).toEqual(order);
    expect(statements().find((s) => CANCEL_REQUEST.test(s.sql))?.params).toEqual(['req-1', 'requester']);
    expect(mockPublishEvent).toHaveBeenCalledTimes(1);
    expect(mockPublishEvent).toHaveBeenCalledWith('request_cancelled', { request_id: 'req-1', requester_id: 'requester' });
  });

  it('expires the dibs with FOR UPDATE SKIP LOCKED, so holding the request lock it never waits on a dibs row', async () => {
    reply(DERIVE, rows([{ status: 'dibs_pending' }]));
    await cancel();
    const expiry = sqls().find((s) => /^UPDATE requests\.dibs SET status = 'expired'/.test(s));
    expect(expiry).toContain('FOR UPDATE SKIP LOCKED');
    expect(expiry).toBe(DIBS_EXPIRE_ON_CANCEL);
  });

  it('answers 404 with no event and no proposal or dibs write when the guarded cancel changes no row (a cancel race)', async () => {
    reply(DERIVE, rows([{ status: 'open' }]));
    reply(CANCEL_REQUEST, rows([], 0));
    const res = await cancel();
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ success: false, message: 'Request not found' });
    expect(mockPublishEvent).not.toHaveBeenCalled();
    expect(at(CANCEL_REQUEST)).toBeGreaterThanOrEqual(0);
    expect(at(CLOSE_OFFERS)).toBe(-1);
    expect(at(CLOSE_MATCHES)).toBe(-1);
    expect(at(/^UPDATE requests\.dibs\b/)).toBe(-1);
  });

  it.each(['completed', 'cancelled'])('refuses a %s request with 409 REQUEST_NOT_CANCELLABLE and writes nothing', async (status) => {
    reply(DERIVE, rows([{ status }]));
    const res = await cancel();
    expect(res.status).toBe(409);
    expect(res.body).toEqual({ success: false, message: 'Only an open request can be cancelled', error: 'REQUEST_NOT_CANCELLABLE' });
    expect(writes()).toEqual([]);
    expect(mockPublishEvent).not.toHaveBeenCalled();
  });

  it('refuses a request with an exchange in progress with 409 REQUEST_HAS_ACTIVE_EXCHANGE, writing nothing', async () => {
    reply(DERIVE, rows([{ status: 'matched' }]));
    const res = await cancel();
    expect(res.status).toBe(409);
    expect(res.body).toEqual({ success: false, message: 'This request has an exchange in progress, so it cannot be cancelled', error: 'REQUEST_HAS_ACTIVE_EXCHANGE' });
    expect(writes()).toEqual([]);
    expect(mockPublishEvent).not.toHaveBeenCalled();
  });
});
