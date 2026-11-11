/**
 * Sprint 138: reusable standing offers. A completed exchange no longer pins its offer: completion releases it
 * (match -> request -> offer lock order), both release statements hold only for 'proposed'/'matched' matches and
 * flag an elapsed expiry, and GET /offers hides flagged or elapsed offers. RED until Tasks 3-5 of the plan.
 * Expected literals are written by hand from the spec, never imported from production.
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
const override = (re: RegExp, r: Reply) => { replies.unshift([re, r]); };
const statements = () => mockQuery.mock.calls.map(([sql, params]) => ({ sql: flat(sql), params }));
const sqls = () => statements().map((s) => s.sql);
const at = (pattern: RegExp) => sqls().findIndex((sql) => pattern.test(sql));
const clientOf = (i: number) => mockTrace.filter((t) => t === 'pool' || t === 'tx')[i];
const OFFER_UPDATES = () => sqls().filter((sql) => /^UPDATE requests\.help_offers\b/.test(sql));

const PARTICIPANT_READ = /FROM requests\.matches m LEFT JOIN requests\.help_requests r/;
const DONE_MARK = /^UPDATE requests\.matches SET (requester|responder)_done_at = COALESCE/;
const COMPLETE = /^UPDATE requests\.matches SET status = 'completed'/;
const LOCK = /^SELECT id FROM requests\.help_requests WHERE id = \$1 FOR UPDATE$/;
const RECONCILE = /^UPDATE requests\.help_requests r SET status = CASE/;
const RELEASE = /^UPDATE requests\.help_offers o SET status = 'active'/;
const STATUS_READ = /^SELECT status FROM requests\.matches WHERE id = \$1$/;

const MATCH = { id: 'match-1', request_id: 'req-1', offer_id: 'offer-1', responder_id: 'helper',
  requester_id: 'requester', offerer_id: 'helper', status: 'matched' };

// Independent literals from spec A/B.
const EXPECTED_SET = "SET status = 'active', expired = (o.expired IS TRUE OR (o.expires_at IS NOT NULL AND " +
  "o.expires_at <= clock_timestamp())), updated_at = CURRENT_TIMESTAMP";
const EXPECTED_HOLD_SET = "m.status IN ('proposed', 'matched')";
const setClause = (sql: string) => sql.slice(sql.indexOf('SET '), sql.indexOf(' WHERE '));
const holdList = (sql: string) => (/m\.status IN \([^)]*\)/.exec(sql) ?? [''])[0];

async function app() {
  const { default: matches } = await import('../../src/routes/matches');
  const { default: offers } = await import('../../src/routes/offers');
  const a = express();
  a.use(express.json());
  a.use((req: any, _res: any, next: any) => {
    req.user = { userId: req.headers['x-test-user'], email: 'u@test.com', communities: [] };
    next();
  });
  a.use('/matches', matches);
  a.use('/offers', offers);
  return a;
}

beforeEach(() => {
  replies = [];
  mockTrace.length = 0;
  mockQuery.mockReset();
  mockQuery.mockImplementation(async (sql: unknown) => {
    const hit = replies.find(([re]) => re.test(flat(sql)));
    return hit ? hit[1] : rows([], 1);
  });
  mockPublishEvent.mockReset();
  mockPublishEvent.mockResolvedValue(undefined);
});
afterEach(async () => { await new Promise<void>((resolve) => setImmediate(resolve)); });

describe('A: PUT /matches/:id/complete releases the offer', () => {
  beforeEach(() => {
    reply(PARTICIPANT_READ, rows([MATCH]));
    reply(DONE_MARK, rows([{ requester_done_at: new Date(), responder_done_at: new Date() }]));
  });
  const complete = async (user = 'requester') =>
    request(await app()).put('/matches/match-1/complete').set('x-test-user', user).send({});

  it('runs done mark, completed, request lock, reconcile, then the release with [offer_id], in one transaction', async () => {
    const res = await complete();
    expect(res.status).toBe(200);
    expect(res.body.data.fully_completed).toBe(true);
    const order = [at(DONE_MARK), at(COMPLETE), at(LOCK), at(RECONCILE), at(RELEASE)];
    expect(order.every((i) => i >= 0)).toBe(true);
    order.slice(1).forEach((index, n) => expect(order[n]).toBeLessThan(index));
    expect(order.map(clientOf)).toEqual(['tx', 'tx', 'tx', 'tx', 'tx']);
    expect(statements()[at(RELEASE)].params).toEqual(['offer-1']);
  });

  it('a first done mark (one side only) issues no help_offers update', async () => {
    override(DONE_MARK, rows([{ requester_done_at: new Date(), responder_done_at: null }]));
    const res = await complete();
    expect(res.status).toBe(200);
    expect(res.body.data.fully_completed).toBe(false);
    expect(OFFER_UPDATES()).toEqual([]);
  });

  it('a match with offer_id = null issues no help_offers update', async () => {
    override(PARTICIPANT_READ, rows([{ ...MATCH, offer_id: null, offerer_id: null }]));
    const res = await complete();
    expect(res.status).toBe(200);
    expect(at(COMPLETE)).toBeGreaterThan(-1);
    expect(OFFER_UPDATES()).toEqual([]);
  });

  it('publishes match_completed after the commit', async () => {
    expect((await complete()).status).toBe(200);
    expect(mockTrace.indexOf('commit')).toBeGreaterThan(-1);
    expect(mockTrace.indexOf('publish')).toBeGreaterThan(mockTrace.indexOf('commit'));
    expect(mockPublishEvent).toHaveBeenCalledWith('match_completed', expect.objectContaining({ match_id: 'match-1', offer_id: 'offer-1' }));
  });

  it('404 for a non-participant issues no help_offers update', async () => {
    override(PARTICIPANT_READ, rows([], 0));
    expect((await complete('stranger')).status).toBe(404);
    expect(OFFER_UPDATES()).toEqual([]);
  });

  it('409 MATCH_NOT_COMPLETABLE issues no help_offers update', async () => {
    override(DONE_MARK, rows([], 0));
    reply(STATUS_READ, rows([{ status: 'cancelled' }]));
    const res = await complete();
    expect(res.status).toBe(409);
    expect(res.body.error).toBe('MATCH_NOT_COMPLETABLE');
    expect(OFFER_UPDATES()).toEqual([]);
  });

  it('the idempotent already-completed answer before the transaction issues no help_offers update', async () => {
    override(PARTICIPANT_READ, rows([{ ...MATCH, status: 'completed' }]));
    expect((await complete()).status).toBe(200);
    expect(mockTrace).not.toContain('tx');
    expect(OFFER_UPDATES()).toEqual([]);
  });

  it('the idempotent already-completed answer inside the transaction issues no help_offers update', async () => {
    override(DONE_MARK, rows([], 0));
    reply(STATUS_READ, rows([{ status: 'completed' }]));
    const res = await complete();
    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Match already completed');
    expect(mockTrace).toContain('tx');
    expect(OFFER_UPDATES()).toEqual([]);
  });
});

describe('A/B: the release SQL', () => {
  const recorded = async (which: 'releaseOffer' | 'closeProposals') => {
    const calls: string[] = [];
    const q = async (sql: string) => { calls.push(flat(sql)); return { rowCount: 0, rows: [] }; };
    const mod = await import('../../src/db/requestStatus');
    await mod[which](q as any, 'id-1');
    const offerUpdate = calls.find((sql) => RELEASE.test(sql));
    expect(offerUpdate).toBeDefined();
    return offerUpdate as string;
  };

  it.each(['releaseOffer', 'closeProposals'] as const)('%s holds only for proposed and matched matches', async (which) => {
    const sql = await recorded(which);
    expect(holdList(sql)).toBe(EXPECTED_HOLD_SET);
    expect(sql).not.toContain("'completed'");
  });

  it.each(['releaseOffer', 'closeProposals'] as const)('%s SET clause also flags an elapsed expiry', async (which) => {
    expect(setClause(await recorded(which))).toBe(EXPECTED_SET);
  });
});

describe('C: GET /offers hides expired standing offers', () => {
  const list = async (qs = '') => request(await app()).get(`/offers${qs}`).set('x-test-user', 'viewer');

  const listCall = async (qs: string) => {
    reply(/FROM requests\.help_offers o/, rows([]));
    expect((await list(qs)).status).toBe(200);
    const call = statements().find((s) => /FROM requests\.help_offers o/.test(s.sql));
    expect(call).toBeDefined();
    return call!;
  };

  it.each([['', 'active'], ['?status=withdrawn', 'withdrawn']])('keeps the readable boundary and [status, viewerId] leading params (%s)', async (qs, status) => {
    const { sql, params } = await listCall(qs);
    // The readable boundary is unchanged.
    expect(sql).toContain('o.offerer_id = $2 OR EXISTS ( SELECT 1 FROM communities.members cm');
    expect(sql).toContain("cm.user_id = $2 AND cm.status = 'active'");
    expect(params.slice(0, 2)).toEqual([status, 'viewer']);
  });

  // Sprint 139 (BUG-097) narrowed C: expiry hides an ACTIVE offer from other members only. The two
  // expiry fragments still occur inside the new OR, so `toContain` on them would stay green whatever
  // the grouping is; assert the whole WHERE clause instead (status AND audience AND scoped expiry).
  const tight = (s: string) => s.replace(/\(\s+/g, '(').replace(/\s+\)/g, ')');
  // Sprint 140 (BUG-099): the status predicate is null-aware so `status=all` can bind NULL.
  const EXPECTED_WHERE = "WHERE ($1::text IS NULL OR o.status = $1) AND (o.offerer_id = $2 OR EXISTS (SELECT 1 FROM communities.members cm " +
    "WHERE cm.community_id = o.community_id AND cm.user_id = $2 AND cm.status = 'active')) AND " +
    "(o.status <> 'active' OR o.offerer_id = $2 OR (o.expired IS NOT TRUE AND (o.expires_at IS NULL OR o.expires_at > NOW())))";

  it.each([[''], ['?status=withdrawn']])('hides a flagged or elapsed offer only when it is active and not the viewer\'s own; non-active statuses bypass expiry (%s)', async (qs) => {
    const { sql } = await listCall(qs);
    const where = tight(sql).slice(tight(sql).indexOf('WHERE '), tight(sql).indexOf(' ORDER BY '));
    expect(where).toBe(EXPECTED_WHERE);
  });
});
