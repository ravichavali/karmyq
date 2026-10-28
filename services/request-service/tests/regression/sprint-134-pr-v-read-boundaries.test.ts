import express from 'express';
import request from 'supertest';
import jwt from 'jsonwebtoken';

const mockQuery = jest.fn();
jest.mock('../../src/database/db', () => ({
  __esModule: true,
  default: { query: (...args: unknown[]) => mockQuery(...args), connect: jest.fn() },
  query: (...args: unknown[]) => mockQuery(...args),
  withTransaction: (fn: any) => fn((...args: unknown[]) => mockQuery(...args)),
}));
jest.mock('../../src/events/publisher', () => ({ publishEvent: jest.fn() }));

import requestsRouter from '../../src/routes/requests';
import providersRouter from '../../src/routes/providers';
import { publishEvent } from '../../src/events/publisher';
import { requestReadableSql } from '../../src/db/eligibility';
import { buildRequestsQuery } from '../../src/utils/queryBuilder';
import * as liveRole from '../../src/db/liveRole';

const VIEWER = '11111111-1111-1111-1111-111111111111';
const OWNER = '22222222-2222-2222-2222-222222222222';
const ID = '33333333-3333-3333-3333-333333333333';
const COMMUNITY = '44444444-4444-4444-4444-444444444444';
const authorization = `Bearer ${jwt.sign({ userId: VIEWER, email: 'viewer@example.test', communities: [] },
  process.env.JWT_SECRET || 'dev-secret-key')}`;
const originalSecret = process.env.JWT_SECRET;
beforeAll(() => { process.env.JWT_SECRET = originalSecret || 'dev-secret-key'; });
afterAll(() => {
  if (originalSecret === undefined) delete process.env.JWT_SECRET;
  else process.env.JWT_SECRET = originalSecret;
});

function app(caller: string | null = VIEWER) {
  const server = express();
  server.use(express.json());
  server.use((req: any, _res, next) => {
    if (caller) req.user = { userId: caller, communities: [] };
    next();
  });
  server.use('/requests/providers', providersRouter);
  server.use('/requests', requestsRouter);
  return server;
}

beforeEach(() => { mockQuery.mockReset(); jest.mocked(publishEvent).mockClear(); });

const writes = [
  { method: 'put', suffix: '', body: { title: 'Updated', status: 'completed', user_id: OWNER } },
  { method: 'delete', suffix: '', body: { user_id: OWNER } },
  { method: 'put', suffix: '/privacy', body: { is_public: true, user_id: OWNER } },
] as const;

describe('request owner-write opacity', () => {
  it.each(writes)('$method :id$suffix hides foreign ids and ignores forged body identity', async ({ method, suffix, body }) => {
    // The DB boundary returns the foreign row only if the lookup fails to constrain its owner.
    mockQuery.mockImplementation(async (sql: string) => ({
      rowCount: /AND requester_id = \$2/.test(sql) ? 0 : 1,
      rows: /AND requester_id = \$2/.test(sql) ? [] : [{ requester_id: OWNER }],
    }));
    const foreign = await request(app())[method](`/requests/${ID}${suffix}`).send(body);
    expect(mockQuery).toHaveBeenCalledTimes(1);
    expect(mockQuery.mock.calls[0][1]).toEqual([ID, VIEWER]);
    expect(publishEvent).not.toHaveBeenCalled();
    mockQuery.mockReset();
    mockQuery.mockResolvedValue({ rowCount: 0, rows: [] });
    const missing = await request(app())[method](`/requests/${ID}${suffix}`).send(body);
    expect(foreign.status).toBe(404);
    expect(foreign.body).toEqual(missing.body);
  });

  it.each(writes)('$method :id$suffix binds ownership again on mutation and permits owner', async ({ method, suffix, body }) => {
    mockQuery.mockResolvedValueOnce({ rowCount: 1, rows: [{ requester_id: VIEWER }] })
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ id: ID }] });
    const res = await request(app())[method](`/requests/${ID}${suffix}`).send(body);
    expect(res.status).toBe(200);
    const [sql, params] = mockQuery.mock.calls[1];
    expect(sql).toMatch(/AND requester_id = \$\d+/);
    expect(params.slice(-2)).toEqual([ID, VIEWER]);
    expect(sql).toMatch(/RETURNING/);
    expect(publishEvent).toHaveBeenCalledTimes(1);
  });

  it.each(writes)('$method :id$suffix publishes nothing if the row vanishes before mutation', async ({ method, suffix, body }) => {
    mockQuery.mockResolvedValueOnce({ rowCount: 1, rows: [{ requester_id: VIEWER }] })
      .mockResolvedValueOnce({ rowCount: 0, rows: [] });
    const res = await request(app())[method](`/requests/${ID}${suffix}`).send(body);
    expect(res.status).toBe(404);
    expect(publishEvent).not.toHaveBeenCalled();
  });

  it.each(writes)('$method :id$suffix requires authentication before any SQL', async ({ method, suffix, body }) => {
    const res = await request(app(null))[method](`/requests/${ID}${suffix}`).send(body);
    expect(res.status).toBe(401);
    expect(mockQuery).not.toHaveBeenCalled();
  });
});

describe('canonical detail boundary', () => {
  it('uses the shared read predicate in SQL and returns opaque 404 without a second query', async () => {
    mockQuery.mockResolvedValue({ rowCount: 0, rows: [] });
    const res = await request(app()).get(`/requests/${ID}`);
    expect(res.status).toBe(404);
    expect(mockQuery).toHaveBeenCalledTimes(1);
    const [sql, params] = mockQuery.mock.calls[0];
    expect(sql).toContain(requestReadableSql('r', '$2'));
    expect(sql).not.toContain('AS viewer_any_match');
    expect(sql).not.toContain('AS viewer_is_preferred_provider');
    expect(params).toEqual([ID, VIEWER]);
  });
});

describe('canonical membership', () => {
  it('exports one community-first helper that treats an active null role as membership', async () => {
    mockQuery.mockResolvedValue({ rowCount: 1, rows: [{ role: null }] });
    await expect(liveRole.isActiveMember(COMMUNITY, VIEWER)).resolves.toBe(true);
    expect(mockQuery.mock.calls[0][1]).toEqual([COMMUNITY, VIEWER]);
  });

  it('rejects malformed provider community ids before SQL', async () => {
    mockQuery.mockResolvedValue({ rowCount: 0, rows: [] });
    const res = await request(app()).get('/requests/providers/community/not-a-uuid').set('Authorization', authorization);
    expect(res.status).toBe(403);
    expect(mockQuery).not.toHaveBeenCalled();
  });

  it('provider membership lookup binds community before caller', async () => {
    mockQuery.mockResolvedValue({ rowCount: 0, rows: [] });
    const res = await request(app()).get(`/requests/providers/community/${COMMUNITY}`).set('Authorization', authorization);
    expect(res.status).toBe(403);
    expect(mockQuery.mock.calls[0][1]).toEqual([COMMUNITY, VIEWER]);
  });
});

describe('list candidate page', () => {
  it('filters and pages readable requests before joining names and aggregating communities', () => {
    const { queryText, params } = buildRequestsQuery({ viewer_id: VIEWER, community_id: COMMUNITY,
      include_admin_notes: 'true', status: 'open', limit: 7, offset: 3 });
    expect(queryText).toMatch(/WITH candidate_requests AS \(/);
    const pageEnd = queryText.indexOf('OFFSET');
    expect(pageEnd).toBeGreaterThan(0);
    expect(queryText).toContain(requestReadableSql('r', '$3'));
    expect(queryText.indexOf('/* request-readable */')).toBeLessThan(pageEnd);
    expect(queryText.indexOf('STRING_AGG')).toBeGreaterThan(pageEnd);
    expect(queryText).toMatch(/FROM candidate_requests r/);
    expect(queryText).toMatch(/page_community\.community_id = \$1/);
    expect(queryText).toMatch(/rc\.community_id = \$1/);
    expect(params).toEqual([COMMUNITY, 'open', VIEWER, 7, 3]);
  });
});
