import express from 'express';
import request from 'supertest';

// Sprint 133 PR V (BUG-065, BUG-064), extended in Sprint 134 PR V. These local cases pin SQL text and
// parameter wiring only. The changed queries still need real-SQL execution in
// tests/integration/sprint-133-pr-v-read-boundary.integration.test.ts (pending CI, unavailable locally).
// `query` is mocked only at the DB boundary.
const mockQuery = jest.fn();
jest.mock('../../src/database/db', () => ({
  __esModule: true,
  default: { query: (...args: unknown[]) => mockQuery(...args), connect: jest.fn() },
  query: (...args: unknown[]) => mockQuery(...args),
  withTransaction: (fn: any) => fn((...args: unknown[]) => mockQuery(...args)),
}));
jest.mock('../../src/events/publisher', () => ({ publishEvent: jest.fn() }));

import { buildRequestsQuery, RequestsQueryFilters } from '../../src/utils/queryBuilder';
import { requestReadableSql, requestReachableSql } from '../../src/db/eligibility';
import { directedAudienceSql } from '../../src/db/directedAudience';
import requestsRouter from '../../src/routes/requests';
import offersRouter from '../../src/routes/offers';
import feedRouter from '../../src/routes/feed';

const VIEWER = '11111111-1111-1111-1111-111111111111';
const OTHER = '22222222-2222-2222-2222-222222222222';
const COMMUNITY = '33333333-3333-3333-3333-333333333333';

function paramRefs(sql: string): number[] {
  return [...sql.matchAll(/\$(\d+)/g)].map((m) => Number(m[1]));
}

describe('requestReadableSql: one boundary for list and detail', () => {
  it('embeds the directed-audience and reachability fragments verbatim (single source)', () => {
    const readable = requestReadableSql('r', '$9');
    expect(readable).toContain(directedAudienceSql('r', '$9'));
    expect(readable).toContain(requestReachableSql('r', '$9'));
  });

  it('admits own, any-status match responder and the pre-selected provider', () => {
    const readable = requestReadableSql('r', '$9');
    expect(readable).toContain('r.requester_id = $9');
    expect(readable).toMatch(/FROM requests\.matches \w+\s+WHERE \w+\.request_id = r\.id AND \w+\.responder_id = \$9\)/);
    expect(readable).not.toMatch(/responder_id = \$9\s+AND \w+\.status/);
    expect(readable).toMatch(/provider_profiles \w+\s+WHERE \w+\.id = r\.preferred_provider_id AND \w+\.user_id = \$9/);
  });

  it('reachability is live membership, an active sister link, or a wide scope', () => {
    const reachable = requestReachableSql('r', '$9');
    expect(reachable).toContain("cm.user_id = $9 AND cm.status = 'active'");
    expect(reachable).toContain("cl.status = 'active' AND cl.show_in_sister_feeds = TRUE");
    expect(reachable).toContain("r.visibility_scope IN ('trust_network', 'platform')");
  });
});

describe('buildRequestsQuery: the browse list carries the boundary', () => {
  const combos: RequestsQueryFilters[] = [
    {},
    { viewer_id: VIEWER },
    { status: 'open', viewer_id: VIEWER },
    { community_id: COMMUNITY, viewer_id: VIEWER },
    { community_id: COMMUNITY, include_admin_notes: 'true', status: 'open', type: 'borrow', viewer_id: VIEWER },
    { requester_id: OTHER, viewer_id: VIEWER },
    { requester_id: VIEWER, viewer_id: VIEWER, status: 'open', type: 'ride' },
    { requester_id: VIEWER, viewer_id: VIEWER, community_id: COMMUNITY, include_admin_notes: 'true' },
  ];

  it.each(combos)('binds every referenced parameter and references every bound one: %j', (filters) => {
    const { queryText, params } = buildRequestsQuery(filters);
    const refs = new Set(paramRefs(queryText));
    expect(Math.max(...refs)).toBe(params.length);
    for (let n = 1; n <= params.length; n++) expect(refs.has(n)).toBe(true);
  });

  it('binds the viewer even when absent and still gates the browse branch', () => {
    const { queryText, params } = buildRequestsQuery({ status: 'open' });
    expect(params).toEqual(['open', null, 50, 0]);
    expect(queryText).toContain(requestReadableSql('r', '$2'));
    expect(queryText).not.toContain('m_self');
  });

  it('gates a spoofed requester_id as browse', () => {
    const { queryText, params } = buildRequestsQuery({ requester_id: OTHER, viewer_id: VIEWER });
    expect(params).toEqual([OTHER, VIEWER, 50, 0]);
    expect(queryText).toContain(requestReadableSql('r', '$2'));
    expect(queryText).toContain('NOT r.is_directed');
  });

  it('does not add the boundary to the private own-requests list', () => {
    const { queryText } = buildRequestsQuery({ requester_id: VIEWER, viewer_id: VIEWER });
    expect(queryText).not.toContain('/* request-readable */');
    expect(queryText).toContain(directedAudienceSql('r', '$1'));
  });
});

function app(router: express.Router, mount: string, communities: Array<{ id: string; role: string }>) {
  const server = express();
  server.use(express.json());
  server.use((req: any, _res, next) => {
    req.user = { userId: VIEWER, email: 'viewer@example.test', communities };
    next();
  });
  server.use(mount, router);
  return server;
}

describe('community reads use live membership (stale JWT claim)', () => {
  beforeEach(() => {
    mockQuery.mockReset();
    // The viewer's live row says they left: every membership lookup finds nothing.
    mockQuery.mockImplementation(async () => ({ rowCount: 0, rows: [] }));
  });

  it.each([
    `/requests/community/${COMMUNITY}/pulse`,
    `/requests/community/${COMMUNITY}/open-asks`,
    `/requests/retention-policy?communityId=${COMMUNITY}`,
  ])('403s a claim-holding non-member on %s and asks the members table', async (url) => {
    const res = await request(app(requestsRouter, '/requests', [{ id: COMMUNITY, role: 'member' }])).get(url);
    expect(res.status).toBe(403);
    expect(res.body.error).toBe('NOT_A_MEMBER');
    const lookup = mockQuery.mock.calls.find(([sql]) => /FROM communities\.members/.test(sql));
    expect(lookup?.[1]).toEqual([COMMUNITY, VIEWER]);
  });

  it('403s a claim-holding non-member on the community feed view before scoring or logging impressions', async () => {
    const res = await request(app(requestsRouter, '/requests', [{ id: COMMUNITY, role: 'member' }]))
      .get(`/requests/curated?view=community&community_id=${COMMUNITY}`);
    expect(res.status).toBe(403);
    expect(res.body.error).toBe('NOT_A_MEMBER');
    // The membership lookup is the first query: no profile, ranking or feed read ran, and no impression was written.
    expect(mockQuery.mock.calls[0][0]).toMatch(/FROM communities\.members/);
    expect(mockQuery.mock.calls[0][1]).toEqual([COMMUNITY, VIEWER]);
    expect(mockQuery).toHaveBeenCalledTimes(1);
  });

  it('403s a claim-holding non-member on GET /requests/feed/community-health', async () => {
    const res = await request(app(feedRouter, '/requests/feed', [{ id: COMMUNITY, role: 'member' }]))
      .get(`/requests/feed/community-health?community_id=${COMMUNITY}`);
    expect(res.status).toBe(403);
    expect(res.body.error).toBe('NOT_A_MEMBER');
    expect(mockQuery.mock.calls.every(([sql]) => /FROM communities\.members/.test(sql))).toBe(true);
  });

  // Postgres rejects a non-UUID for a uuid column (22P02); the gate must still answer the plain 403.
  it.each([
    '/requests/community/not-a-uuid/pulse',
    '/requests/community/not-a-uuid/open-asks',
    '/requests/retention-policy?communityId=not-a-uuid',
    '/requests/curated?view=community&community_id=not-a-uuid',
  ])('403s a malformed community id on %s without reaching the database', async (url) => {
    mockQuery.mockImplementation(async () => { throw Object.assign(new Error('invalid input syntax for type uuid'), { code: '22P02' }); });
    const res = await request(app(requestsRouter, '/requests', [])).get(url);
    expect(res.status).toBe(403);
    expect(res.body.error).toBe('NOT_A_MEMBER');
    expect(mockQuery).not.toHaveBeenCalled();
  });
});

describe('standing offers: owner or live member', () => {
  beforeEach(() => {
    mockQuery.mockReset();
    mockQuery.mockImplementation(async () => ({ rowCount: 0, rows: [] }));
  });

  it('GET /offers binds the viewer into the owner-or-member predicate', async () => {
    const res = await request(app(offersRouter, '/offers', [])).get(`/offers?community_id=${COMMUNITY}`);
    expect(res.status).toBe(200);
    const [sql, params] = mockQuery.mock.calls[0];
    expect(sql).toMatch(/o\.offerer_id = \$(\d+) OR EXISTS \(\s*SELECT 1 FROM communities\.members cm\s+WHERE cm\.community_id = o\.community_id AND cm\.user_id = \$\1 AND cm\.status = 'active'/);
    const viewerParam = Number(/o\.offerer_id = \$(\d+)/.exec(sql)![1]);
    expect(params[viewerParam - 1]).toBe(VIEWER);
    expect(sql).toContain('o.community_id = $');
  });

  it('GET /offers/:id applies the same predicate in SQL', async () => {
    const res = await request(app(offersRouter, '/offers', [])).get(`/offers/${OTHER}`);
    expect(res.status).toBe(404);
    const [sql, params] = mockQuery.mock.calls[0];
    expect(sql).toMatch(/o\.offerer_id = \$2 OR EXISTS/);
    expect(params).toEqual([OTHER, VIEWER]);
  });

  it.each([
    ['put', `/offers/${OTHER}`],
    ['delete', `/offers/${OTHER}`],
    ['put', `/offers/${OTHER}/privacy`],
  ] as const)('%s %s looks the offer up by id AND owner', async (method, url) => {
    const res = await request(app(offersRouter, '/offers', []))[method](url).send({ title: 'x', is_public: true });
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ success: false, message: 'Offer not found' });
    const [sql, params] = mockQuery.mock.calls[0];
    expect(sql).toMatch(/WHERE id = \$1 AND offerer_id = \$2/);
    expect(params).toEqual([OTHER, VIEWER]);
  });
});
