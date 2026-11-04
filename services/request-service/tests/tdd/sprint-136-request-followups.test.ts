/**
 * Sprint 136 (BUG-085, BUG-084): an expired ask takes no new commitment, and POST /matches runs under the request lock.
 *
 * Mocked SQL contract: the exact statements, their order and parameters, and that every refusal is decided before the
 * first write. The real-row behaviour, including the races, runs in the root
 * tests/integration/sprint-136-request-followups.integration.test.ts.
 *
 * Lock order (Sprint 135 note 5), read before writing E on 2026-11-03: POST /matches takes the request lock, then the
 * offer row (its guarded UPDATE). The other requests.help_offers writers are closeProposals (requestStatus.ts; the
 * caller holds the request lock first), match reject (matches.ts; request, then match, then offer), match cancel
 * (matches.ts; match, then request, then the offer last), and offers.ts's update, withdraw and privacy writes plus
 * cleanup-service's expiration job (single autocommit statements that never take the request lock). None holds an
 * offer row lock and then waits on the request lock, so the new order cannot deadlock against them.
 */
const mockQuery = jest.fn();
// Which client issued each statement: the pool (false) or the transaction (true), and when the transaction ended.
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

// Propose-match's admin check. A plain function, so no resetMocks setting can wipe it.
jest.mock('../../src/db/liveRole', () => ({
  ...jest.requireActual('../../src/db/liveRole'),
  hasLiveRoleInRequestCommunities: async () => true,
}));

// POST /matches's fast-path reads. Plain functions over variables each test sets.
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

// The dibs and provider-offer routers carry their own authMiddleware: inject the caller from a header instead.
jest.mock('@karmyq/shared/middleware/auth', () => ({
  authMiddleware: (req: any, _res: any, next: any) => {
    req.user = { userId: req.headers['x-test-user'], email: 'u@test.com', communities: [] };
    next();
  },
}));

import { readFileSync } from 'fs';
import { join } from 'path';
import express from 'express';
import request from 'supertest';
import * as requestStatus from '../../src/db/requestStatus';

// Read through the namespace: before the export exists, each case fails on its own instead of the suite not compiling.
const lockRequestForCommitment = (q: any, id: string): Promise<string | null> =>
  (requestStatus as any).lockRequestForCommitment(q, id);

type Reply = { rowCount: number; rows: any[] };
const rows = (r: any[] = [], rowCount = r.length): Reply => ({ rowCount, rows: r });
const flat = (sql: unknown) => String(sql).replace(/\s+/g, ' ').trim();
let replies: Array<[RegExp, Reply]> = [];
const reply = (re: RegExp, r: Reply) => { replies.push([re, r]); };
/** Replies match first-registered-first, so a case that overrides a beforeEach reply puts its own in front. */
const override = (re: RegExp, r: Reply) => { replies.unshift([re, r]); };

const statements = () => mockQuery.mock.calls.map(([sql, params]) => ({ sql: flat(sql), params }));
const sqls = () => statements().map((s) => s.sql);
const at = (p: RegExp | string) => sqls().findIndex((s) => (typeof p === 'string' ? s === p : p.test(s)));
const writes = () => sqls().filter((s) => /^(UPDATE|INSERT|DELETE)\b/i.test(s));
/** Which client issued the statement at index i (statements only; commit and publish markers skipped). */
const clientOf = (i: number) => mockTrace.filter((t) => t === 'pool' || t === 'tx')[i];

const LOCK = 'SELECT id FROM requests.help_requests WHERE id = $1 FOR UPDATE';
const CASE_ARMS =
  "WHEN r.status = 'cancelled' THEN 'cancelled' " +
  "WHEN EXISTS (SELECT 1 FROM requests.matches m WHERE m.request_id = r.id AND m.status = 'matched') THEN 'matched' " +
  "WHEN EXISTS (SELECT 1 FROM requests.matches m WHERE m.request_id = r.id AND m.status = 'completed') THEN 'completed' " +
  "WHEN EXISTS (SELECT 1 FROM requests.dibs d WHERE d.request_id = r.id AND d.status = 'pending') THEN 'dibs_pending' ";
const DERIVE_WITH_EXPIRY =
  `SELECT CASE ${CASE_ARMS}ELSE 'open' END AS status, ` +
  '(r.expired IS TRUE OR (r.expires_at IS NOT NULL AND r.expires_at <= clock_timestamp())) AS past_expiry ' +
  'FROM requests.help_requests r WHERE r.id = $1';
/** The derive statement, with or without the expiry column. */
const DERIVE = /^SELECT CASE WHEN r\.status = 'cancelled'/;
const derived = (status: string, pastExpiry: boolean) => reply(DERIVE, rows([{ status, past_expiry: pastExpiry }]));

const PARTICIPANT_READ = /FROM requests\.matches m LEFT JOIN requests\.help_requests r/;
const PROPOSED = { id: 'match-1', request_id: 'req-1', offer_id: 'offer-1', responder_id: 'helper', requester_id: 'requester', status: 'proposed', admin_proposed: false };

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
  mockTrace.length = 0;
  mockQuery.mockReset();
  mockQuery.mockImplementation(async (sql: unknown) => {
    const text = flat(sql);
    const hit = replies.find(([re]) => re.test(text));
    return hit ? hit[1] : rows([], 1);
  });
  mockPublishEvent.mockReset();
  mockPublishEvent.mockResolvedValue(undefined);
});

describe('lockRequestForCommitment (BUG-085)', () => {
  const q = jest.fn();
  beforeEach(() => q.mockReset());

  it('locks the row, then derives the status and the expiry in one statement after the lock', async () => {
    q.mockResolvedValueOnce(rows([{ id: 'req-1' }])).mockResolvedValueOnce(rows([{ status: 'open', past_expiry: false }]));
    await expect(lockRequestForCommitment(q, 'req-1')).resolves.toBe('open');
    expect(q).toHaveBeenCalledTimes(2);
    expect(flat(q.mock.calls[0][0])).toBe(LOCK);
    expect(q.mock.calls[0][1]).toEqual(['req-1']);
    expect(flat(q.mock.calls[1][0])).toBe(DERIVE_WITH_EXPIRY);
    expect(q.mock.calls[1][1]).toEqual(['req-1']);
  });

  it("reads an open ask past its expiry as 'expired'", async () => {
    q.mockResolvedValueOnce(rows([{ id: 'req-1' }])).mockResolvedValueOnce(rows([{ status: 'open', past_expiry: true }]));
    await expect(lockRequestForCommitment(q, 'req-1')).resolves.toBe('expired');
  });

  it.each([
    ['matched', true], ['matched', false],
    ['completed', true], ['completed', false],
    ['dibs_pending', true], ['dibs_pending', false],
    ['cancelled', true], ['cancelled', false],
  ])('returns %s unchanged, past expiry %s', async (status, pastExpiry) => {
    q.mockResolvedValueOnce(rows([{ id: 'req-1' }])).mockResolvedValueOnce(rows([{ status, past_expiry: pastExpiry }]));
    await expect(lockRequestForCommitment(q, 'req-1')).resolves.toBe(status);
  });

  it('returns null when there is no such request', async () => {
    q.mockResolvedValue(rows([], 0));
    await expect(lockRequestForCommitment(q, 'missing')).resolves.toBeNull();
  });
});

describe('lockRequest still ignores the expiry (cancel, reject and dibs accept close an expired ask)', () => {
  it("returns 'open' for an open ask past its expiry, from the same statement", async () => {
    const q = jest.fn().mockResolvedValueOnce(rows([{ id: 'req-1' }]))
      .mockResolvedValueOnce(rows([{ status: 'open', past_expiry: true }]));
    await expect(requestStatus.lockRequest(q, 'req-1')).resolves.toBe('open');
    expect(flat(q.mock.calls[1][0])).toBe(DERIVE_WITH_EXPIRY);
  });
});

// Note 8: the derivation CASE stays byte-identical to Sprint 135's, and reconcile's is unchanged. The two differ by
// design (the lock's has a cancelled arm; reconcile's WHERE keeps a cancelled ask cancelled), so compare arms.
describe('the derive CASE and the reconcile CASE agree arm by arm (note 8)', () => {
  type Arms = { arms: string[]; tail: string };
  const armsOf = (body: string): string[] => body.split('\n').map((l) => l.trim()).filter(Boolean);
  function cases(source: string): { lock: Arms; reconcile: Arms } | null {
    const lock = /SELECT CASE\n([\s\S]*?)\n\s*(ELSE 'open' END) AS status/.exec(source);
    const reconcile = /SET status = CASE\n([\s\S]*?)\n\s*(ELSE 'open' END)\n/.exec(source);
    if (!lock || !reconcile) return null;
    return { lock: { arms: armsOf(lock[1]), tail: lock[2] }, reconcile: { arms: armsOf(reconcile[1]), tail: reconcile[2] } };
  }
  function agree(source: string): boolean {
    const c = cases(source);
    if (!c) return false;
    const [first, ...rest] = c.lock.arms;
    return first === "WHEN r.status = 'cancelled' THEN 'cancelled'"
      && JSON.stringify(rest) === JSON.stringify(c.reconcile.arms)
      && c.lock.tail === "ELSE 'open' END" && c.reconcile.tail === "ELSE 'open' END";
  }
  const source = readFileSync(join(__dirname, '../../src/db/requestStatus.ts'), 'utf8');

  it('the source has exactly one derive CASE, and its arms are the cancelled arm plus reconcile\'s three, in order', () => {
    expect(source.match(/SELECT CASE\n/g)).toHaveLength(1);
    const c = cases(source)!;
    expect(c.reconcile.arms).toHaveLength(3);
    expect(agree(source)).toBe(true);
  });

  it('fails on an extra arm in the derive CASE (an expired arm would change the status vocabulary)', () => {
    const injected = source.replace("THEN 'cancelled'\n", "THEN 'cancelled'\n       WHEN r.expired THEN 'expired'\n");
    expect(injected).not.toBe(source);
    expect(agree(injected)).toBe(false);
  });

  it('fails when a reconcile arm drifts', () => {
    const drifted = source.replace(/(SET status = CASE\n\s*WHEN EXISTS \(SELECT 1 FROM requests\.matches m WHERE m\.request_id = r\.id AND m\.status = )'matched'/, "$1'proposed'");
    expect(drifted).not.toBe(source);
    expect(agree(drifted)).toBe(false);
  });
});

describe('the commitment writers refuse an ask past its expiry with 409 REQUEST_NOT_OPEN, before any write (BUG-085)', () => {
  const NOT_OPEN = { success: false, message: 'This request is no longer open', error: 'REQUEST_NOT_OPEN' };

  describe('PUT /matches/:id/accept', () => {
    beforeEach(() => {
      reply(PARTICIPANT_READ, rows([PROPOSED]));
      reply(/^SELECT request_type, payload FROM requests\.help_requests/, rows([{ request_type: 'generic', payload: null }]));
      reply(/^SELECT m\.\*, r\.request_type/, rows([{ id: 'match-1' }]));
    });
    const accept = async () => request(await app()).put('/matches/match-1/accept').set('x-test-user', 'requester').send({});

    it('refuses', async () => {
      derived('open', true);
      const res = await accept();
      expect(res.status).toBe(409);
      expect(res.body).toEqual(NOT_OPEN);
      expect(writes()).toEqual([]);
    });
    it('accepts the unexpired twin (positive control)', async () => {
      derived('open', false);
      expect((await accept()).status).toBe(200);
    });
  });

  describe('POST /requests/:id/propose-match', () => {
    beforeEach(() => {
      reply(/^SELECT id FROM requests\.help_requests r WHERE/, rows([{ id: 'req-1' }]));
      reply(/FROM communities\.members cm JOIN requests\.request_communities rc/, rows([{ '?column?': 1 }]));
      reply(/^INSERT INTO requests\.matches \(request_id, responder_id, status, admin_proposed\)/, rows([{ id: 'match-new' }]));
    });
    const propose = async () => request(await app()).post('/requests/req-1/propose-match').set('x-test-user', 'admin').send({ user_id: 'helper' });

    it('refuses', async () => {
      derived('open', true);
      const res = await propose();
      expect(res.status).toBe(409);
      expect(res.body).toEqual(NOT_OPEN);
      expect(writes()).toEqual([]);
    });
    it('proposes on the unexpired twin (positive control)', async () => {
      derived('open', false);
      expect((await propose()).status).toBe(201);
    });
  });

  describe('POST /requests/:id/dibs', () => {
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

    it('refuses', async () => {
      derived('open', true);
      const res = await send();
      expect(res.status).toBe(409);
      expect(res.body).toEqual({ success: false, message: 'Request is not available for dibs', error: 'REQUEST_NOT_OPEN' });
      expect(writes()).toEqual([]);
      expect(mockPublishEvent).not.toHaveBeenCalled();
    });
    it('sends the dibs on the unexpired twin (positive control)', async () => {
      derived('open', false);
      expect((await send()).status).toBe(201);
    });
  });

  describe('PUT /requests/offers/:id/accept (provider offer)', () => {
    beforeEach(() => {
      reply(/^SELECT o\.\*, hr\.requester_id as requester_user_id/, rows([{ id: 'off-1', request_id: 'req-1',
        provider_user_id: 'provider', requester_user_id: 'requester', status: 'pending' }]));
    });
    const accept = async () => request(await app()).put('/requests/offers/off-1/accept').set('x-test-user', 'requester').send({});

    it('refuses', async () => {
      derived('open', true);
      const res = await accept();
      expect(res.status).toBe(409);
      expect(res.body).toEqual(NOT_OPEN);
      expect(writes()).toEqual([]);
    });
    it('accepts on the unexpired twin (positive control)', async () => {
      derived('open', false);
      expect((await accept()).status).toBe(200);
    });
  });
});

describe('an expired ask can still be closed: reject, requester cancel and dibs accept read lockRequest (BUG-085)', () => {
  it('PUT /matches/:id/reject rejects the proposal', async () => {
    reply(PARTICIPANT_READ, rows([PROPOSED]));
    derived('open', true);
    const res = await request(await app()).put('/matches/match-1/reject').set('x-test-user', 'helper').send({});
    expect(res.status).toBe(200);
    expect(at(/^UPDATE requests\.matches SET status = 'rejected' WHERE id = \$1 AND status = 'proposed'$/)).toBeGreaterThan(-1);
  });

  it('DELETE /requests/:id cancels the ask', async () => {
    reply(/^SELECT requester_id FROM requests\.help_requests WHERE id = \$1 AND requester_id = \$2$/, rows([{ requester_id: 'requester' }]));
    derived('open', true);
    const res = await request(await app()).delete('/requests/req-1').set('x-test-user', 'requester');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, message: 'Request cancelled successfully' });
  });

  it('PUT /requests/dibs/:id/accept accepts a dibs on an ask whose own expiry has passed', async () => {
    reply(/^SELECT \* FROM requests\.dibs WHERE id = \$1$/, rows([{ id: 'dibs-1', request_id: 'req-1', provider_user_id: 'helper',
      status: 'pending', expires_at: new Date(Date.now() + 3_600_000).toISOString() }]));
    reply(/^SELECT status, expires_at > clock_timestamp\(\) AS live FROM requests\.dibs WHERE id = \$1 FOR UPDATE$/, rows([{ status: 'pending', live: true }]));
    derived('dibs_pending', true);
    const res = await request(await app()).put('/requests/dibs/dibs-1/accept').set('x-test-user', 'helper').send({});
    expect(res.status).toBe(200);
  });
});

describe('POST /matches runs under the request lock (BUG-084, BUG-085)', () => {
  const OPEN_REACH = { exists: true, requesterId: 'requester', status: 'open', expired: false, visibilityScope: 'community', reachable: true, isDirected: false };
  const DUPE = "SELECT 1 FROM requests.matches WHERE request_id = $1 AND responder_id = $2 AND status IN ('proposed', 'matched') LIMIT 1";
  const HOLD_OFFER = "UPDATE requests.help_offers SET status = 'matched' WHERE id = $1 AND offerer_id = $2 AND status = 'active'";
  const INSERT = "INSERT INTO requests.matches (request_id, offer_id, responder_id, status) VALUES ($1, $2, $3, 'proposed') RETURNING *";
  const NOT_OPEN_FAST = { success: false, message: 'Request is not open', error: 'REQUEST_NOT_OPEN' };

  beforeEach(() => {
    mockReach = { ...OPEN_REACH };
    mockOwnOffer = rows([{ id: 'offer-1', status: 'active' }]);
    // No duplicate by default: the harness's default reply (rowCount 1) would otherwise read as one.
    reply(/^SELECT 1 FROM requests\.matches WHERE request_id = \$1 AND responder_id = \$2/, rows([], 0));
    reply(/^INSERT INTO requests\.matches \(request_id, offer_id, responder_id, status\)/, rows([{ id: 'match-new', request_id: 'req-1' }]));
  });
  const offer = async (body: object = { request_id: 'req-1', offer_id: 'offer-1' }) =>
    request(await app()).post('/matches').set('x-test-user', 'helper').send(body);

  it('locks, checks the duplicate, holds the offer while active, then inserts, all in one transaction, in that order', async () => {
    derived('open', false);
    const res = await offer();
    expect(res.status).toBe(201);
    const order = [LOCK, DERIVE, DUPE, HOLD_OFFER, INSERT].map(at);
    expect(order.every((i) => i >= 0)).toBe(true);
    expect([...order].sort((x, y) => x - y)).toEqual(order);
    expect(order.map(clientOf)).toEqual(['tx', 'tx', 'tx', 'tx', 'tx']);
    expect(statements()[at(DUPE)].params).toEqual(['req-1', 'helper']);
    expect(statements()[at(HOLD_OFFER)].params).toEqual(['offer-1', 'helper']);
    expect(statements()[at(INSERT)].params).toEqual(['req-1', 'offer-1', 'helper']);
    // No other write to the offer: the old unguarded UPDATE is gone.
    expect(sqls().filter((s) => /^UPDATE requests\.help_offers/.test(s))).toEqual([HOLD_OFFER]);
  });

  it('publishes match_created only after the commit', async () => {
    derived('open', false);
    expect((await offer()).status).toBe(201);
    expect(mockPublishEvent).toHaveBeenCalledWith('match_created', expect.objectContaining({ match_id: 'match-new', request_id: 'req-1' }));
    expect(mockTrace.indexOf('commit')).toBeGreaterThan(-1);
    expect(mockTrace.indexOf('publish')).toBeGreaterThan(mockTrace.indexOf('commit'));
  });

  it('without an offer_id, inserts a bare proposal and touches no offer', async () => {
    derived('open', false);
    expect((await offer({ request_id: 'req-1' })).status).toBe(201);
    expect(sqls().filter((s) => /requests\.help_offers/.test(s))).toEqual([]);
    expect(statements()[at(INSERT)].params).toEqual(['req-1', null, 'helper']);
  });

  it("refuses an ask that expired since the read (the sweep has not flagged it) with 409, writing nothing", async () => {
    derived('open', true);
    const res = await offer();
    expect(res.status).toBe(409);
    expect(res.body).toEqual(NOT_OPEN_FAST);
    expect(writes()).toEqual([]);
    expect(mockPublishEvent).not.toHaveBeenCalled();
  });

  it.each(['matched', 'completed', 'dibs_pending', 'cancelled'])('refuses an ask that became %s since the read with 409, writing nothing', async (status) => {
    derived(status, false);
    const res = await offer();
    expect(res.status).toBe(409);
    expect(res.body).toEqual(NOT_OPEN_FAST);
    expect(writes()).toEqual([]);
    expect(mockPublishEvent).not.toHaveBeenCalled();
  });

  it('the duplicate check runs under the lock: a hit answers 409 ALREADY_OFFERED, writing nothing', async () => {
    derived('open', false);
    override(/^SELECT 1 FROM requests\.matches WHERE request_id = \$1 AND responder_id = \$2/, rows([{ '?column?': 1 }]));
    const res = await offer();
    expect(res.status).toBe(409);
    expect(res.body).toEqual({ success: false, message: 'You have already offered to help on this request', error: 'ALREADY_OFFERED' });
    expect(at(LOCK)).toBeGreaterThan(-1);
    expect(at(DUPE)).toBeGreaterThan(at(LOCK));
    expect(clientOf(at(DUPE))).toBe('tx');
    expect(writes()).toEqual([]);
  });

  it('an offer that stopped being active since the read answers 400 OFFER_NOT_ACTIVE and inserts no proposal', async () => {
    derived('open', false);
    reply(/^UPDATE requests\.help_offers SET status = 'matched' WHERE id = \$1 AND offerer_id = \$2 AND status = 'active'$/, rows([], 0));
    const res = await offer();
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ success: false, message: 'Offer is not active', error: 'OFFER_NOT_ACTIVE' });
    expect(writes()).toEqual([HOLD_OFFER]);
    expect(mockPublishEvent).not.toHaveBeenCalled();
  });

  describe('the fast path keeps its responses', () => {
    it.each([
      ['a closed ask', { status: 'matched' }],
      ['an ask the sweep flagged expired', { expired: true }],
    ])('%s answers 400 REQUEST_NOT_OPEN without taking the lock', async (_label, change) => {
      mockReach = { ...OPEN_REACH, ...change };
      const res = await offer();
      expect(res.status).toBe(400);
      expect(res.body).toEqual(NOT_OPEN_FAST);
      expect(statements()).toEqual([]);
    });

    it('an inactive offer answers 400 OFFER_NOT_ACTIVE without taking the lock', async () => {
      mockOwnOffer = rows([{ id: 'offer-1', status: 'withdrawn' }]);
      const res = await offer();
      expect(res.status).toBe(400);
      expect(res.body).toEqual({ success: false, message: 'Offer is not active', error: 'OFFER_NOT_ACTIVE' });
      expect(at(LOCK)).toBe(-1);
      expect(writes()).toEqual([]);
    });

    it("a foreign or missing offer still answers 404, like a missing one (BUG-064)", async () => {
      mockOwnOffer = rows([], 0);
      const res = await offer();
      expect(res.status).toBe(404);
      expect(res.body).toEqual({ success: false, message: 'Offer not found' });
      expect(writes()).toEqual([]);
    });
  });
});
