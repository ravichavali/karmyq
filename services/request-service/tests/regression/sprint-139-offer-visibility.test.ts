/**
 * Sprint 139 — BUG-097: GET /offers scopes expiry by status and ownership.
 *
 * Sprint 138 hid every flagged or elapsed offer from every list, whatever status was asked for and
 * whoever asked. That hid an owner's own expired offer from them and dropped expired offers from
 * the matched/withdrawn history. The approved rule (spec A) keeps the readable audience as an outer
 * AND and bypasses the expiry conjunction only for a non-active status or the offer's own owner:
 *
 *   AND (o.status <> 'active' OR o.offerer_id = $2
 *        OR (o.expired IS NOT TRUE AND (o.expires_at IS NULL OR o.expires_at > NOW())))
 *
 * This file captures the SQL and params the route builds (construction, not execution). The real
 * audience/status/expiry matrix runs against PostgreSQL in
 * tests/integration/sprint-139-offer-visibility.integration.test.ts. Expected literals are written by
 * hand from the spec, never imported from production.
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

const OWNER = '11111111-1111-1111-1111-111111111111';
const MEMBER = '22222222-2222-2222-2222-222222222222';
const OUTSIDER = '33333333-3333-3333-3333-333333333333';
const COMMUNITY = 'cccccccc-cccc-cccc-cccc-cccccccccccc';

/** Collapse whitespace, including just inside parentheses, so grouping is compared and not layout. */
const norm = (sql: unknown) =>
  String(sql).replace(/\s+/g, ' ').replace(/\(\s+/g, '(').replace(/\s+\)/g, ')').trim();

const AUDIENCE =
  "(o.offerer_id = $2 OR EXISTS (SELECT 1 FROM communities.members cm WHERE cm.community_id = o.community_id " +
  "AND cm.user_id = $2 AND cm.status = 'active'))";
const EXPIRY =
  "(o.status <> 'active' OR o.offerer_id = $2 OR (o.expired IS NOT TRUE AND (o.expires_at IS NULL OR o.expires_at > NOW())))";

/**
 * The complete WHERE clause up to the first optional filter or ORDER BY. Sprint 140 (BUG-099) made the status
 * predicate null-aware so `status=all` can bind NULL; every status this file asks for still binds a value.
 */
const EXPECTED_WHERE = `WHERE ($1::text IS NULL OR o.status = $1) AND ${AUDIENCE} AND ${EXPIRY}`;

async function app() {
  const { default: offers } = await import('../../src/routes/offers');
  const a = express();
  a.use(express.json());
  a.use((req: any, _res: any, next: any) => {
    req.user = { userId: req.headers['x-test-user'], email: 'u@test.com', communities: [] };
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

describe('GET /offers — expiry is scoped by status and ownership (spec A)', () => {
  it.each([
    ['default (active)', '', 'active'],
    ['?status=active', '?status=active', 'active'],
    ['?status=matched', '?status=matched', 'matched'],
    ['?status=withdrawn', '?status=withdrawn', 'withdrawn'],
  ])('%s: the complete WHERE grouping is status AND audience AND the scoped expiry OR', async (_l, qs, status) => {
    const res = await request(await app()).get(`/offers${qs}`).set('x-test-user', MEMBER);
    expect(res.status).toBe(200);
    const { sql, params } = listCall();
    expect(whereOf(sql)).toBe(EXPECTED_WHERE);
    expect(params.slice(0, 2)).toEqual([status, MEMBER]);
  });

  it('no unconditional expiry conjunction survives outside the OR', async () => {
    await request(await app()).get('/offers').set('x-test-user', MEMBER);
    const { sql } = listCall();
    const outside = whereOf(sql).replace(EXPIRY, '<scoped>');
    expect(outside).not.toContain('o.expired IS NOT TRUE');
    expect(outside).not.toContain('o.expires_at > NOW()');
  });

  it.each([
    ['owner', OWNER],
    ['current member', MEMBER],
    ['outsider', OUTSIDER],
  ])('binds the %s as $2 — the owner bypass and the audience both key off the caller', async (_l, viewer) => {
    await request(await app()).get('/offers').set('x-test-user', viewer);
    const { sql, params } = listCall();
    expect(params[1]).toBe(viewer);
    expect(sql.match(/o\.offerer_id = \$2/g)).toHaveLength(2); // audience + owner bypass, same binding
  });

  it('a query-string offerer_id cannot claim ownership: it is never bound', async () => {
    await request(await app()).get(`/offers?offerer_id=${OWNER}`).set('x-test-user', MEMBER);
    expect(listCall().params).not.toContain(OWNER);
  });

  it('keeps optional filters, pagination and their numbering after the two leading params', async () => {
    await request(await app())
      .get(`/offers?status=matched&community_id=${COMMUNITY}&type=skills&limit=10&offset=20`)
      .set('x-test-user', MEMBER);
    const { sql, params } = listCall();
    expect(sql).toContain(`${EXPECTED_WHERE} AND o.community_id = $3 AND o.category = $4 ORDER BY o.created_at DESC LIMIT $5 OFFSET $6`);
    expect(params).toEqual(['matched', MEMBER, COMMUNITY, 'skills', '10', '20']);
  });

  it('selects expires_at and expired additively, keeping every existing list field', async () => {
    await request(await app()).get('/offers').set('x-test-user', MEMBER);
    const { sql } = listCall();
    const select = sql.slice(0, sql.indexOf(' FROM requests.help_offers o'));
    for (const field of [
      'o.id', 'o.community_id', 'o.offerer_id', 'o.title', 'o.description', 'o.category', 'o.status',
      'o.created_at', 'o.updated_at', 'u.name as helper_name', 'c.name as community_name',
      'o.expires_at', 'o.expired',
    ]) {
      expect(select).toContain(field);
    }
  });

  it('returns the rows, expiry fields included, in the unchanged { offers, count, total } envelope', async () => {
    const row = {
      id: 'o1', community_id: COMMUNITY, offerer_id: OWNER, title: 'Ladder', description: 'd', category: 'other',
      status: 'active', created_at: '2026-11-01T00:00:00.000Z', updated_at: '2026-11-01T00:00:00.000Z',
      helper_name: 'Owner', community_name: 'Maple', expires_at: '2026-11-02T00:00:00.000Z', expired: true,
    };
    mockQuery.mockResolvedValue({ rowCount: 1, rows: [row] });
    const res = await request(await app()).get('/offers').set('x-test-user', OWNER);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toEqual({ offers: [row], count: 1, total: 1 });
  });
});
