import express from 'express';
import request from 'supertest';

// BUG-056: GET /requests/:id must gate on own ∨ any-status match responder ∨ reachability, keep the
// stricter directed-audience SQL predicate, and never return requester_email. `query` is mocked only
// at the DB boundary, so the real route and the real getRequestReachability run against it.
const mockQuery = jest.fn();
jest.mock('../../src/database/db', () => ({
  __esModule: true,
  default: { query: (...args: unknown[]) => mockQuery(...args), connect: jest.fn() },
  query: (...args: unknown[]) => mockQuery(...args),
  withTransaction: (fn: any) => fn((...args: unknown[]) => mockQuery(...args)),
}));
jest.mock('../../src/events/publisher', () => ({ publishEvent: jest.fn() }));

import requestsRouter from '../../src/routes/requests';

const VIEWER = '11111111-1111-1111-1111-111111111111';
const OWNER = '22222222-2222-2222-2222-222222222222';
const REQUEST_ID = '33333333-3333-3333-3333-333333333333';

function app(caller = VIEWER) {
  const server = express();
  server.use((req: any, _res, next) => {
    req.user = { userId: caller, email: 'caller@example.test', communities: [] };
    next();
  });
  server.use('/requests', requestsRouter);
  return server;
}

interface Scenario {
  requesterId?: string;
  anyMatch?: boolean;
  activeMatch?: { id: string; status: string } | null;
  isDirected?: boolean;
  status?: string;
  /** Reachability row: is_member / visibility_scope drive getRequestReachability. */
  isMember?: boolean;
  visibilityScope?: string;
}

function detailRow(s: Scenario) {
  return {
    id: REQUEST_ID,
    requester_id: s.requesterId ?? OWNER,
    title: 'Need a ladder',
    status: s.status ?? 'open',
    expired: false,
    category: 'generic',
    is_directed: s.isDirected ?? false,
    visibility_scope: s.visibilityScope ?? 'community',
    requester_name: 'Owner',
    viewer_any_match: s.anyMatch ?? false,
    viewer_match_id: s.activeMatch?.id ?? null,
    viewer_match_status: s.activeMatch?.status ?? null,
  };
}

function mockScenario(s: Scenario) {
  mockQuery.mockImplementation(async (sql: string) => {
    if (sql.includes('AS in_directed_audience')) {
      return {
        rowCount: 1,
        rows: [{
          requester_id: s.requesterId ?? OWNER,
          status: s.status ?? 'open',
          expired: false,
          visibility_scope: s.visibilityScope ?? 'community',
          is_directed: s.isDirected ?? false,
          in_directed_audience: s.isDirected ?? false,
          is_member: s.isMember ?? false,
          sister_reachable: false,
        }],
      };
    }
    return { rowCount: 1, rows: [detailRow(s)] };
  });
}

function detailSql(): string {
  const call = mockQuery.mock.calls.find(([sql]) => String(sql).includes('FROM requests.help_requests r')
    && !String(sql).includes('AS in_directed_audience'));
  return String(call?.[0] ?? '');
}

beforeEach(() => {
  mockQuery.mockReset();
});

describe('GET /requests/:id visibility gate (BUG-056)', () => {
  it('keeps the directed-audience predicate in the detail SQL and selects no requester email', async () => {
    mockScenario({ isMember: true });
    await request(app()).get(`/requests/${REQUEST_ID}`);
    const sql = detailSql();
    expect(sql).toContain('/* directed-audience */');
    expect(sql).not.toMatch(/email/i);
  });

  it('returns the same 404 as not-found for an unreachable non-directed request', async () => {
    mockScenario({ isMember: false, visibilityScope: 'community' });
    const gated = await request(app()).get(`/requests/${REQUEST_ID}`);

    mockQuery.mockReset();
    mockQuery.mockResolvedValue({ rowCount: 0, rows: [] });
    const missing = await request(app()).get(`/requests/${REQUEST_ID}`);

    expect(gated.status).toBe(404);
    expect(missing.status).toBe(404);
    expect(gated.body).toEqual(missing.body);
  });

  it('returns 200 to the owner without consulting reachability', async () => {
    mockScenario({ requesterId: VIEWER, isMember: false });
    const res = await request(app()).get(`/requests/${REQUEST_ID}`);
    expect(res.status).toBe(200);
    expect(res.body.data.viewer_relation).toBe('own_request');
    expect(mockQuery.mock.calls.some(([sql]) => String(sql).includes('AS in_directed_audience'))).toBe(false);
  });

  it.each(['proposed', 'matched', 'completed', 'cancelled'])(
    'returns 200 to a match responder whose match is %s even when unreachable',
    async (status) => {
      const active = status === 'proposed' || status === 'matched';
      mockScenario({
        anyMatch: true,
        activeMatch: active ? { id: 'match-1', status } : null,
        status: active ? 'open' : 'completed',
        isMember: false,
      });
      const res = await request(app()).get(`/requests/${REQUEST_ID}`);
      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(REQUEST_ID);
    },
  );

  it('returns 200 to a reachable community member with can_offer', async () => {
    mockScenario({ isMember: true });
    const res = await request(app()).get(`/requests/${REQUEST_ID}`);
    expect(res.status).toBe(200);
    expect(res.body.data.viewer_relation).toBe('can_offer');
  });

  it('returns 200 for a platform-scope request to a non-member', async () => {
    mockScenario({ isMember: false, visibilityScope: 'platform' });
    const res = await request(app()).get(`/requests/${REQUEST_ID}`);
    expect(res.status).toBe(200);
  });

  it('returns 200 for a closed request the viewer can still reach (gate is not lifecycle)', async () => {
    mockScenario({ isMember: true, status: 'completed' });
    const res = await request(app()).get(`/requests/${REQUEST_ID}`);
    expect(res.status).toBe(200);
    expect(res.body.data.viewer_relation).toBe('not_actionable');
  });

  it('returns 404 for a closed request outside the viewer audience', async () => {
    mockScenario({ isMember: false, status: 'completed' });
    const res = await request(app()).get(`/requests/${REQUEST_ID}`);
    expect(res.status).toBe(404);
  });

  it('never returns requester_email or the internal match columns', async () => {
    mockScenario({ isMember: true });
    const res = await request(app()).get(`/requests/${REQUEST_ID}`);
    expect(res.status).toBe(200);
    expect(res.body.data).not.toHaveProperty('requester_email');
    expect(res.body.data).not.toHaveProperty('viewer_any_match');
    expect(res.body.data).not.toHaveProperty('viewer_match_id');
  });

  it('calls reachability at most once per request', async () => {
    mockScenario({ isMember: true });
    await request(app()).get(`/requests/${REQUEST_ID}`);
    const reachCalls = mockQuery.mock.calls.filter(([sql]) => String(sql).includes('AS in_directed_audience'));
    expect(reachCalls).toHaveLength(1);
  });
});

// BUG-062 class, found by the PR S `.email` inventory: GET /offers/:id returned the offerer's email to
// any authenticated caller. No client reads it (the list endpoint never selected it), so it is removed.
describe('GET /offers/:id email exposure (BUG-062)', () => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const offersRouter = require('../../src/routes/offers').default;

  it('never selects or returns the offerer email', async () => {
    mockQuery.mockImplementation(async (sql: string) => ({
      rowCount: 1,
      rows: [{ id: 'offer-1', offerer_id: OWNER, helper_name: 'Helper',
        ...(/email/i.test(sql) ? { helper_email: 'helper@private.test' } : {}) }],
    }));
    const server = express();
    server.use((req: any, _res, next) => { req.user = { userId: VIEWER, communities: [] }; next(); });
    server.use('/offers', offersRouter);
    const res = await request(server).get('/offers/offer-1');
    expect(res.status).toBe(200);
    expect(res.body.data).not.toHaveProperty('helper_email');
    expect(String(mockQuery.mock.calls[0][0])).not.toMatch(/email/i);
  });
});
