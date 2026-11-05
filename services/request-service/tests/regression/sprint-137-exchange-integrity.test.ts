/**
 * Sprint 137: edit refusals, offer expiry, guarded releases and provider-offer transaction contracts.
 * Real routes and requestStatus/providerOffersDb helpers emit the SQL recorded here; only the database,
 * eligibility/ownership fast paths, authentication and event transport are replaced. Real-row expiry,
 * shared-offer and concurrency proofs belong to the root integration suite.
 *
 * Lock order was re-read from Sprint 136's contract header and the real writers before adding these tests:
 * accept/reject take request first; cancel/complete update only matched matches before request; offer
 * edits/withdraw/privacy and cleanup's flags never wait for a request while holding an offer lock.
 */
const mockQuery = jest.fn();
const mockTrace: Array<'pool' | 'tx' | 'commit' | 'publish'> = [];
jest.mock('../../src/database/db', () => ({
  __esModule: true,
  default: {},
  query: (...args: any[]) => { mockTrace.push('pool'); return mockQuery(...args); },
  withTransaction: async (fn: any) => {
    const result = await fn((...args: any[]) => { mockTrace.push('tx'); return mockQuery(...args); });
    mockTrace.push('commit');
    return result;
  },
}));
const mockPublishEvent = jest.fn();
jest.mock('../../src/events/publisher', () => ({
  publishEvent: (...args: any[]) => { mockTrace.push('publish'); return mockPublishEvent(...args); },
}));
let mockReach: any;
jest.mock('../../src/db/eligibility', () => ({
  ...jest.requireActual('../../src/db/eligibility'),
  getRequestReachability: async () => mockReach,
}));
let mockOwnOffer: any;
jest.mock('../../src/db/helpOffersDb', () => ({
  ...jest.requireActual('../../src/db/helpOffersDb'),
  findOwnOffer: async () => mockOwnOffer,
}));
jest.mock('@karmyq/shared/middleware/auth', () => ({
  authMiddleware: (req: any, _res: any, next: any) => {
    req.user = { userId: req.headers['x-test-user'], email: 'u@test.com', communities: [] };
    next();
  },
}));

import express from 'express';
import request from 'supertest';

type Reply = { rowCount: number; rows: any[] };
type Replier = Reply | (() => Reply);
const rows = (r: any[] = [], rowCount = r.length): Reply => ({ rowCount, rows: r });
const flat = (sql: unknown) => String(sql).replace(/\s+/g, ' ').trim();
let replies: Array<[RegExp, Replier]> = [];
const reply = (re: RegExp, r: Replier) => { replies.push([re, r]); };
const override = (re: RegExp, r: Replier) => { replies.unshift([re, r]); };
const statements = () => mockQuery.mock.calls.map(([sql, params]) => ({ sql: flat(sql), params }));
const sqls = () => statements().map((s) => s.sql);
const at = (pattern: RegExp | string) => sqls().findIndex((sql) => typeof pattern === 'string' ? sql === pattern : pattern.test(sql));
/** Every index was found and they are strictly increasing. */
const expectInOrder = (...indices: number[]) => {
  expect(indices.every((i) => i >= 0)).toBe(true);
  indices.slice(1).forEach((index, n) => expect(indices[n]).toBeLessThan(index));
};
const clientOf = (i: number) => mockTrace.filter((t) => t === 'pool' || t === 'tx')[i];
const writes = () => sqls().filter((sql) => /^(UPDATE|INSERT|DELETE)\b/i.test(sql));
const LOCK = 'SELECT id FROM requests.help_requests WHERE id = $1 FOR UPDATE';
const DERIVE = /^SELECT CASE WHEN r\.status = 'cancelled'/;
const derived = (status: string, pastExpiry = false) => reply(DERIVE, rows([{ status, past_expiry: pastExpiry }]));
const OWN_REQUEST = /^SELECT requester_id FROM requests\.help_requests WHERE id = \$1 AND requester_id = \$2$/;
const EDIT_REQUEST = /^UPDATE requests\.help_requests SET/;
const EDIT_OFFER = /^UPDATE requests\.help_offers/;
const PARTICIPANT_READ = /FROM requests\.matches m LEFT JOIN requests\.help_requests r/;
const PROPOSED = { id: 'match-1', request_id: 'req-1', offer_id: 'offer-1', responder_id: 'helper',
  requester_id: 'requester', status: 'proposed', admin_proposed: false };
const OPEN_REACH = { exists: true, requesterId: 'requester', status: 'open', expired: false,
  visibilityScope: 'community', reachable: true, isDirected: false };
const CLOSED = { success: false, message: "A completed or cancelled request can't be edited", error: 'REQUEST_CLOSED' };
const OFFER_NOT_ACTIVE = { success: false, message: 'Offer is not active', error: 'OFFER_NOT_ACTIVE' };
// Independent literal from spec B5; no import of the not-yet-implemented helper or expected SQL from production.
const RELEASE = "UPDATE requests.help_offers o SET status = 'active', updated_at = CURRENT_TIMESTAMP " +
  "WHERE o.id = $1 AND o.status = 'matched' AND NOT EXISTS (SELECT 1 FROM requests.matches m " +
  "WHERE m.offer_id = o.id AND m.status IN ('proposed', 'matched', 'completed')) " +
  "AND o.ctid = (SELECT visible_offer.ctid FROM requests.help_offers visible_offer WHERE visible_offer.id = o.id)";
const INLINE_RELEASE = "UPDATE requests.help_offers SET status = 'active' WHERE id = $1 AND status = 'matched'";

async function app() {
  const { default: requests } = await import('../../src/routes/requests');
  const { default: offers } = await import('../../src/routes/offers');
  const { default: matches } = await import('../../src/routes/matches');
  const { default: providerOffers } = await import('../../src/routes/providerOffers');
  const a = express();
  a.use(express.json());
  a.use((req: any, _res: any, next: any) => {
    req.user = { userId: req.headers['x-test-user'], email: 'u@test.com', communities: [] };
    next();
  });
  a.use('/requests', requests);
  a.use('/offers', offers);
  a.use('/matches', matches);
  a.use('/providers', providerOffers);
  return a;
}

beforeEach(() => {
  replies = [];
  mockTrace.length = 0;
  mockReach = { ...OPEN_REACH };
  mockOwnOffer = rows([{ id: 'offer-1', status: 'active', expired: false }]);
  mockQuery.mockReset();
  mockQuery.mockImplementation(async (sql: unknown) => {
    const hit = replies.find(([re]) => re.test(flat(sql)));
    if (!hit) return rows([], 1); // same recording boundary as Sprint 136; branch-driving reads are explicit below.
    return typeof hit[1] === 'function' ? hit[1]() : hit[1];
  });
  mockPublishEvent.mockReset();
  mockPublishEvent.mockResolvedValue(undefined);
});
// Let POST /matches' fire-and-forget feed log finish before the next case resets its SQL recording.
afterEach(async () => { await new Promise<void>((resolve) => setImmediate(resolve)); });

describe('A: PUT /requests/:id protects closed and forgotten content', () => {
  beforeEach(() => {
    reply(OWN_REQUEST, rows([{ requester_id: 'requester' }]));
    reply(EDIT_REQUEST, rows([{ id: 'req-1', title: 'Updated title' }]));
  });
  const edit = async (body: object = { title: 'Updated title' }, user = 'requester') =>
    request(await app()).put('/requests/req-1').set('x-test-user', user).send(body);

  it.each(['completed', 'cancelled'])('refuses derived %s before the first write, under the transaction lock', async (status) => {
    derived(status);
    const res = await edit();
    expect(res.status).toBe(409);
    expect(res.body).toEqual(CLOSED);
    expect(writes()).toEqual([]);
    expect(at(LOCK)).toBeGreaterThan(-1);
    expect(at(DERIVE)).toBeGreaterThan(at(LOCK));
    expect([clientOf(at(LOCK)), clientOf(at(DERIVE))]).toEqual(['tx', 'tx']);
    expect(statements()[at(LOCK)].params).toEqual(['req-1']);
  });

  it.each(['open', 'matched', 'dibs_pending'])('edits derived %s only after the lock, with the forgotten-content guard', async (status) => {
    derived(status);
    const res = await edit();
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ id: 'req-1', title: 'Updated title' });
    const order = [at(LOCK), at(DERIVE), at(EDIT_REQUEST)];
    expectInOrder(...order);
    expect(order.map(clientOf)).toEqual(['tx', 'tx', 'tx']);
    expect(statements()[order[2]].sql).toContain('content_forgotten_at IS NULL');
    expect(statements()[order[2]].params).toEqual(['Updated title', 'req-1', 'requester']);
  });

  it('answers REQUEST_CLOSED when the guarded edit updates zero rows', async () => {
    derived('open');
    override(EDIT_REQUEST, rows([], 0));
    const res = await edit();
    expect(res.status).toBe(409);
    expect(res.body).toEqual(CLOSED);
    expect(clientOf(at(EDIT_REQUEST))).toBe('tx');
  });

  it('still refuses a body status before any transaction statement', async () => {
    const res = await edit({ status: 'completed' });
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ success: false, message: "A request's status changes through its exchanges, not an edit", error: 'STATUS_NOT_EDITABLE' });
    expect(mockTrace).toEqual(['pool']);
    expect(writes()).toEqual([]);
  });

  it('still hides a foreign request before status validation or any transaction statement', async () => {
    override(OWN_REQUEST, rows([], 0));
    const res = await edit({ status: 'completed' }, 'stranger');
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ success: false, message: 'Request not found' });
    expect(mockTrace).toEqual(['pool']);
    expect(statements()[0].params).toEqual(['req-1', 'stranger']);
    expect(writes()).toEqual([]);
  });
});

describe('B1: PUT /offers/:id leaves status to exchanges', () => {
  const edit = async (body: object, user = 'helper') =>
    request(await app()).put('/offers/offer-1').set('x-test-user', user).send(body);

  it('refuses the owner\'s body status without updating the offer', async () => {
    const res = await edit({ status: 'active' });
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ success: false, message: "An offer's status changes through its exchanges, not an edit", error: 'STATUS_NOT_EDITABLE' });
    expect(sqls().filter((sql) => EDIT_OFFER.test(sql))).toEqual([]);
  });

  it('hides a foreign offer before validating the same status body', async () => {
    mockOwnOffer = rows([], 0);
    const res = await edit({ status: 'active' }, 'stranger');
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ success: false, message: 'Offer not found' });
    expect(writes()).toEqual([]);
  });

  it('keeps a title-only edit working', async () => {
    reply(EDIT_OFFER, rows([{ id: 'offer-1', title: 'New offer title', status: 'active' }]));
    const res = await edit({ title: 'New offer title' });
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ id: 'offer-1', title: 'New offer title', status: 'active' });
    expect(statements()[at(EDIT_OFFER)].params).toEqual(['New offer title', 'offer-1']);
    expect(statements()[at(EDIT_OFFER)].sql).not.toMatch(/\bstatus\s*=/);
  });
});

describe('B2: POST /matches refuses expired standing offers', () => {
  const HOLD = /^UPDATE requests\.help_offers SET status = 'matched'/;
  const INSERT = /^INSERT INTO requests\.matches/;
  beforeEach(() => {
    derived('open');
    reply(/^SELECT 1 FROM requests\.matches WHERE/, rows([], 0));
    reply(INSERT, rows([{ id: 'match-new', request_id: 'req-1' }]));
  });
  const offer = async () => request(await app()).post('/matches').set('x-test-user', 'helper')
    .send({ request_id: 'req-1', offer_id: 'offer-1' });

  it('refuses an active but flagged-expired offer before any transaction statement', async () => {
    mockOwnOffer = rows([{ id: 'offer-1', status: 'active', expired: true }]);
    const res = await offer();
    expect(res.status).toBe(400);
    expect(res.body).toEqual(OFFER_NOT_ACTIVE);
    expect(mockTrace).not.toContain('tx');
    expect(writes()).toEqual([]);
  });

  it('holds only an unflagged offer whose expiry has not passed at the writing statement', async () => {
    expect((await offer()).status).toBe(201);
    const hold = statements()[at(HOLD)];
    expect(hold.sql).toContain('expired IS NOT TRUE');
    expect(hold.sql).toContain('(expires_at IS NULL OR expires_at > clock_timestamp())');
    expect(hold.params).toEqual(['offer-1', 'helper']);
    expect(clientOf(at(HOLD))).toBe('tx');
    expectInOrder(at(DERIVE), at(HOLD), at(INSERT));
  });

  it('inserts no match when the guarded hold misses', async () => {
    reply(HOLD, rows([], 0));
    const res = await offer();
    expect(res.status).toBe(400);
    expect(res.body).toEqual(OFFER_NOT_ACTIVE);
    expect(at(INSERT)).toBe(-1);
    expect(writes()).toHaveLength(1);
    expect(mockTrace).not.toContain('publish');
  });
});

describe('B5: every release preserves another match\'s hold', () => {
  beforeEach(() => {
    reply(PARTICIPANT_READ, rows([PROPOSED]));
    derived('open');
  });

  it.each([
    ['reject', 'put', '/matches/match-1/reject', "UPDATE requests.matches SET status = 'rejected' WHERE id = $1 AND status = 'proposed'"],
    ['cancel', 'delete', '/matches/match-1', "UPDATE requests.matches SET status = 'cancelled' WHERE id = $1 AND status = 'matched'"],
  ])('%s releases through the guarded statement after updating its own match, in tx', async (_label, method, path, ownUpdate) => {
    const api = request(await app());
    const res = await (method === 'put' ? api.put(path).send({}) : api.delete(path)).set('x-test-user', 'helper');
    expect(res.status).toBe(200);
    expect(sqls().filter((sql) => EDIT_OFFER.test(sql))).toEqual([RELEASE]);
    expect(at(ownUpdate)).toBeGreaterThan(-1);
    expect(at(RELEASE)).toBeGreaterThan(at(ownUpdate));
    expect([clientOf(at(ownUpdate)), clientOf(at(RELEASE))]).toEqual(['tx', 'tx']);
    expect(statements()[at(ownUpdate)].params).toEqual(['match-1']);
    expect(statements()[at(RELEASE)].params).toEqual(['offer-1']);
    expect(sqls()).not.toContain(INLINE_RELEASE);
  });

  it('accept frees sibling proposals only when no other hold remains, before closing their matches', async () => {
    reply(/^SELECT request_type, payload FROM requests\.help_requests/, rows([{ request_type: 'generic', payload: null }]));
    reply(/^SELECT m\.\*, r\.request_type/, rows([{ id: 'match-1' }]));
    const res = await request(await app()).put('/matches/match-1/accept').set('x-test-user', 'requester').send({});
    expect(res.status).toBe(200);
    const freeIndex = at(EDIT_OFFER);
    const closeIndex = at("UPDATE requests.matches SET status = 'rejected', updated_at = CURRENT_TIMESTAMP WHERE request_id = $1 AND status = 'proposed'");
    expect(freeIndex).toBeGreaterThan(-1);
    expect(closeIndex).toBeGreaterThan(freeIndex);
    expect([clientOf(freeIndex), clientOf(closeIndex)]).toEqual(['tx', 'tx']);
    expect(statements()[freeIndex].params).toEqual(['req-1']);
    expect(statements()[freeIndex].sql).toContain("m.status IN ('proposed', 'matched', 'completed')");
    expect(statements()[freeIndex].sql).toContain("AND NOT (m.request_id = $1 AND m.status = 'proposed')");
    // A new hold after a matched -> active -> matched cycle must not pass a stale release snapshot (I1).
    expect(statements()[freeIndex].sql).toContain(
      'AND o.ctid = (SELECT visible_offer.ctid FROM requests.help_offers visible_offer WHERE visible_offer.id = o.id)');
  });
});

describe('C: POST /providers/offers makes its decision under the request lock', () => {
  const DUPLICATE = /^SELECT id FROM provider\.offers WHERE provider_user_id = \$1 AND request_id = \$2/;
  const INSERT = /^INSERT INTO provider\.offers/;
  const PROVIDER_OFFER = { id: 'provider-offer-1', provider_id: 'profile-1', provider_user_id: 'provider',
    request_id: 'req-1', price: 12.5, note: 'Available', status: 'pending' };
  beforeEach(() => {
    reply(/^SELECT id FROM requests\.provider_profiles WHERE/, rows([{ id: 'profile-1' }]));
    reply(DUPLICATE, rows([], 0));
    reply(INSERT, rows([PROVIDER_OFFER]));
    reply(/^SELECT requester_id FROM requests\.help_requests WHERE id = \$1$/, rows([{ requester_id: 'requester' }]));
  });
  const offer = async () => request(await app()).post('/providers/offers').set('x-test-user', 'provider')
    .send({ request_id: 'req-1', price: '12.50', note: 'Available' });

  it('locks, derives, checks duplicates and inserts in tx in that order', async () => {
    derived('open');
    const res = await offer();
    expect(res.status).toBe(201);
    expect(res.body.data).toEqual(PROVIDER_OFFER);
    const order = [at(LOCK), at(DERIVE), at(DUPLICATE), at(INSERT)];
    expectInOrder(...order);
    expect(order.map(clientOf)).toEqual(['tx', 'tx', 'tx', 'tx']);
    expect(statements()[at(LOCK)].params).toEqual(['req-1']);
    expect(statements()[at(DUPLICATE)].params).toEqual(['provider', 'req-1']);
    expect(statements()[at(INSERT)].params).toEqual(['profile-1', 'provider', 'req-1', 12.5, 'Available']);
  });

  it.each([
    ['expired', 'open', true],
    ['matched', 'matched', false],
  ])('refuses a request that became %s since the fast path without inserting or publishing', async (_label, status, pastExpiry) => {
    derived(String(status), Boolean(pastExpiry));
    const res = await offer();
    expect(res.status).toBe(409);
    expect(res.body).toEqual({ success: false, message: 'This request is no longer open', error: 'REQUEST_NOT_OPEN' });
    expect(writes()).toEqual([]);
    expect(at(DUPLICATE)).toBe(-1);
    expect(at(INSERT)).toBe(-1);
    expect(mockTrace).not.toContain('publish');
  });

  it('answers DUPLICATE_OFFER for the duplicate read under the lock, without inserting', async () => {
    derived('open');
    override(DUPLICATE, rows([{ id: 'existing-offer' }]));
    const res = await offer();
    expect(res.status).toBe(409);
    expect(res.body).toEqual({ success: false, message: 'You already have an active offer for this request', error: 'DUPLICATE_OFFER' });
    expect(at(DUPLICATE)).toBeGreaterThan(at(DERIVE));
    expect(at(DERIVE)).toBeGreaterThan(at(LOCK));
    expect(clientOf(at(DUPLICATE))).toBe('tx');
    expect(writes()).toEqual([]);
    expect(mockTrace).not.toContain('publish');
  });

  it('publishes offer_submitted only after a successful transaction commits', async () => {
    derived('open');
    expect((await offer()).status).toBe(201);
    expect(mockPublishEvent).toHaveBeenCalledWith('offer_submitted', {
      offerId: 'provider-offer-1', requestId: 'req-1', requesterUserId: 'requester', providerName: 'u@test.com', price: 12.5,
    });
    expect(mockTrace.indexOf('commit')).toBeGreaterThan(-1);
    expect(mockTrace.indexOf('publish')).toBeGreaterThan(mockTrace.indexOf('commit'));
  });
});
