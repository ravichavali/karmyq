/**
 * Sprint 140 — BUG-099: GET /offers?status=all lists every readable status.
 *
 * The offers page's "All" option sent no status, and an omitted status means `active`, so "All" showed only
 * active offers. The page now sends the explicit value `all`. The route binds NULL for exactly `all` behind a
 * null-aware predicate, `($1::text IS NULL OR o.status = $1)`, so:
 *   - $1 stays the status and $2 stays the viewer for every request; optional filters keep numbering from $3;
 *   - an omitted status still defaults to `active` (simulation, mobile and other clients rely on it);
 *   - every other value, unknown ones included, keeps plain equality;
 *   - the readable audience and the Sprint 139 owner/status/expiry OR remain mandatory outer ANDs, so `all`
 *     never shows an outsider's row or another member's expired active offer.
 *
 * This file captures the SQL and params the route builds (construction, not execution). Real rows run against
 * PostgreSQL in tests/integration/sprint-140-offer-status-all.integration.test.ts. Expected literals are written
 * by hand from the spec, never imported from production.
 */
export {};

const mockQuery = jest.fn();
jest.mock('../../src/database/db', () => ({
  __esModule: true,
  default: {},
  query: (...args: any[]) => mockQuery(...args),
  withTransaction: async (fn: any) => fn((...args: any[]) => mockQuery(...args)),
}));
jest.mock('../../src/events/publisher', () => ({ publishEvent: jest.fn() }));

import express from 'express';
import request from 'supertest';

const MEMBER = '22222222-2222-2222-2222-222222222222';
const COMMUNITY = 'cccccccc-cccc-cccc-cccc-cccccccccccc';

/** Collapse whitespace, including just inside parentheses, so grouping is compared and not layout. */
const norm = (sql: unknown) =>
  String(sql).replace(/\s+/g, ' ').replace(/\(\s+/g, '(').replace(/\s+\)/g, ')').trim();

const STATUS = '($1::text IS NULL OR o.status = $1)';
const AUDIENCE =
  "(o.offerer_id = $2 OR EXISTS (SELECT 1 FROM communities.members cm WHERE cm.community_id = o.community_id " +
  "AND cm.user_id = $2 AND cm.status = 'active'))";
const EXPIRY =
  "(o.status <> 'active' OR o.offerer_id = $2 OR (o.expired IS NOT TRUE AND (o.expires_at IS NULL OR o.expires_at > NOW())))";
const EXPECTED_WHERE = `WHERE ${STATUS} AND ${AUDIENCE} AND ${EXPIRY}`;

async function app() {
  const { default: offers } = await import('../../src/routes/offers');
  const a = express();
  a.use(express.json());
  a.use((req: any, _res: any, next: any) => {
    req.user = { userId: MEMBER, email: 'u@test.com', communities: [] };
    next();
  });
  a.use('/offers', offers);
  return a;
}

const listCall = () => {
  const call = mockQuery.mock.calls.find(([sql]) => /FROM requests\.help_offers o/.test(String(sql)));
  expect(call).toBeDefined();
  return { sql: norm(call![0]), params: call![1] as unknown[] };
};
const whereOf = (sql: string) => sql.slice(sql.indexOf('WHERE '), sql.search(/ AND o\.community_id = | AND o\.category = | ORDER BY /));

beforeEach(() => {
  mockQuery.mockReset();
  mockQuery.mockResolvedValue({ rowCount: 0, rows: [] });
});

describe('GET /offers status binding (BUG-099)', () => {
  it.each([
    ['omitted (defaults to active)', '', 'active'],
    ['active', '?status=active', 'active'],
    ['matched', '?status=matched', 'matched'],
    ['withdrawn', '?status=withdrawn', 'withdrawn'],
    ['all', '?status=all', null],
    // Only the exact value `all` widens; anything else — unknown or differently cased — stays equality.
    ['an unknown status', '?status=bogus', 'bogus'],
    ['ALL (not the exact value)', '?status=ALL', 'ALL'],
  ])('%s: same WHERE grouping; $1 is the status binding, $2 the viewer', async (_label, qs, expectedStatus) => {
    const res = await request(await app()).get(`/offers${qs}`);
    expect(res.status).toBe(200);
    const { sql, params } = listCall();
    expect(whereOf(sql)).toBe(EXPECTED_WHERE);
    expect(params.slice(0, 2)).toEqual([expectedStatus, MEMBER]);
  });

  it('all + community/type/limit/offset keeps the optional numbering from $3', async () => {
    await request(await app()).get(`/offers?status=all&community_id=${COMMUNITY}&type=skills&limit=10&offset=20`);
    const { sql, params } = listCall();
    expect(sql).toContain(
      `${EXPECTED_WHERE} AND o.community_id = $3 AND o.category = $4 ORDER BY o.created_at DESC LIMIT $5 OFFSET $6`);
    expect(params).toEqual([null, MEMBER, COMMUNITY, 'skills', '10', '20']);
  });

  it('all with only pagination numbers LIMIT/OFFSET $3/$4', async () => {
    await request(await app()).get('/offers?status=all&limit=5&offset=0');
    const { sql, params } = listCall();
    expect(sql).toContain(`${EXPECTED_WHERE} ORDER BY o.created_at DESC LIMIT $3 OFFSET $4`);
    expect(params).toEqual([null, MEMBER, '5', '0']);
  });

  it('there is no unconditional status equality left for all to bypass', async () => {
    await request(await app()).get('/offers?status=all');
    const where = whereOf(listCall().sql);
    expect(where.replace(STATUS, '<status>')).not.toMatch(/o\.status = \$1/);
  });

  it('keeps the envelope: offers, count and total from the query result', async () => {
    const rows = [{ id: 'a', status: 'active' }, { id: 'm', status: 'matched' }, { id: 'w', status: 'withdrawn' }];
    mockQuery.mockResolvedValue({ rowCount: rows.length, rows });
    const res = await request(await app()).get('/offers?status=all');
    expect(res.body).toMatchObject({ success: true, data: { offers: rows, count: 3, total: 3 } });
  });
});
