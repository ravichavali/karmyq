import express from 'express';
import request from 'supertest';
import jwt from 'jsonwebtoken';

// Exercise index.ts's real mount and JWT middleware. Only DB/queue boot cross the boundary.
const mockQuery = jest.fn();
jest.mock('../../src/database/db', () => ({ query: (...args: unknown[]) => mockQuery(...args), initDatabase: async () => {} }));
jest.mock('../../src/events/publisher', () => ({ initEventPublisher: async () => {}, publishEvent: jest.fn() }));

const VIEWER = '11111111-1111-4111-8111-111111111111';
const OWNER = '22222222-2222-4222-8222-222222222222';
const COMMUNITY = '33333333-3333-4333-8333-333333333333';
const TAG = '44444444-4444-4444-8444-444444444444';
let app: express.Express;
const get = (url: string) => request(app).get(url).set('Authorization', `Bearer ${jwt.sign({
  userId: VIEWER, email: 'viewer@example.test', communities: [{ id: COMMUNITY, name: 'Stale claim', role: 'admin' }],
}, process.env.JWT_SECRET!)}`);

beforeAll(async () => {
  process.env.RATE_LIMIT_DISABLED = 'true';
  const booted = new Promise<express.Express>(resolve => {
    jest.spyOn(express.application, 'listen').mockImplementation(function (this: express.Express) {
      resolve(this);
      return {} as any;
    } as any);
  });
  require('../../src/index');
  app = await booted;
  jest.restoreAllMocks();
});

beforeEach(() => {
  mockQuery.mockReset();
  mockQuery.mockResolvedValue({ rows: [], rowCount: 0 });
});

const stableError = (res: request.Response) => ({ success: res.body.success, error: res.body.error, message: res.body.message });

describe('Sprint 133 skill reads through the real auth mount', () => {
  it.each([
    `/auth/skills/users/${OWNER}`,
    `/auth/skills/communities/${COMMUNITY}`,
    `/auth/skills/communities/${COMMUNITY}/search?skill=Carpentry`,
  ])('requires a JWT before DB access: %s', async url => {
    const res = await request(app).get(url);
    expect(res.status).toBe(401);
    expect(mockQuery).not.toHaveBeenCalled();
  });

  it('returns visible tags without other profile fields and binds the visibility fragment to the JWT caller', async () => {
    mockQuery.mockResolvedValue({ rows: [{ skills: [{ tag_id: TAG, label: 'Carpentry', skill_slug: 'carpentry' }] }], rowCount: 1 });
    const res = await get(`/auth/skills/users/${OWNER}?userId=${OWNER}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([{ tag_id: TAG, label: 'Carpentry', skill_slug: 'carpentry' }]);
    const calls = mockQuery.mock.calls.filter(([sql]) => String(sql).includes('auth.user_tags'));
    expect(calls.length).toBeGreaterThan(0);
    for (const [sql, params] of calls) {
      expect(sql).toContain('/* skill-visible */');
      expect(params).toContain(VIEWER);
      expect(sql).not.toContain(VIEWER);
    }
  });

  it('gives hidden owners and nonexistent owners the same 404', async () => {
    const hidden = await get(`/auth/skills/users/${OWNER}`);
    const unknown = await get('/auth/skills/users/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
    expect(hidden.status).toBe(404);
    expect(stableError(hidden)).toEqual(stableError(unknown));
    expect(hidden.body.error).toBe('NOT_FOUND');
    expect(mockQuery).toHaveBeenCalled();
  });

  it.each(['', '/search?skill=Carpentry'])('rejects a live non-member despite a stale admin claim: %s', async suffix => {
    const res = await get(`/auth/skills/communities/${COMMUNITY}${suffix}`);
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('NOT_FOUND');
    expect(mockQuery).toHaveBeenCalled();
    const [sql, params] = mockQuery.mock.calls[0];
    expect(sql).toContain('communities.members');
    expect(sql).toMatch(/status\s*=\s*'active'/);
    expect(params).toContain(VIEWER);
  });

  it('directory counts use the visibility predicate with the caller bound', async () => {
    mockQuery.mockImplementation(async (sql: string) => ({ rows: sql.includes('auth.user_tags')
      ? [{ skill_key: 'carpentry', label: 'Carpentry', member_count: 2 }] : [{ allowed: true }], rowCount: 1 }));
    const res = await get(`/auth/skills/communities/${COMMUNITY}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([{ skill_key: 'carpentry', label: 'Carpentry', member_count: 2 }]);
    const [sql, params] = mockQuery.mock.calls.find(([sql]) => String(sql).includes('auth.user_tags'))!;
    expect(sql).toContain('/* skill-visible */');
    expect(params).toContain(VIEWER);
  });

  it.each([['Carpentry', 'carpentry'], ['carp', 'carp'], [' Underwater Basket ', 'Underwater Basket']])(
    'search resolves exactly %j to %j and binds the visibility predicate', async (text, key) => {
      mockQuery.mockImplementation(async (sql: string) => ({ rows: sql.includes('FROM auth.skill_vocabulary')
        ? (text === 'Carpentry' ? [{ slug: 'carpentry' }] : [])
        : sql.includes('auth.user_tags') ? [] : [{ allowed: true }], rowCount: 1 }));
      const res = await get(`/auth/skills/communities/${COMMUNITY}/search?skill=${encodeURIComponent(text)}`);
      expect(res.status).toBe(200);
      expect(res.body.data).toEqual([]);
      const [sql, params] = mockQuery.mock.calls.find(([sql]) => String(sql).includes('auth.user_tags'))!;
      expect(sql).toContain('/* skill-visible */');
      expect(sql).not.toMatch(/\b(?:ILIKE|LIKE)\b/i);
      expect(params).toContain(VIEWER);
      expect(params).toContain(key);
    });

  it.each(['', '   ', 'x'.repeat(101)])('rejects invalid search text %j before querying', async text => {
    const res = await get(`/auth/skills/communities/${COMMUNITY}/search?skill=${encodeURIComponent(text)}`);
    expect(res.status).toBe(400);
    expect(mockQuery).not.toHaveBeenCalled();
  });

  it.each(['/auth/skills/users/not-a-uuid', '/auth/skills/communities/not-a-uuid'])('validates IDs before querying %s', async url => {
    expect((await get(url)).status).toBe(400);
    expect(mockQuery).not.toHaveBeenCalled();
  });

  it('normalizes an unresolved Unicode skill in SQL using the same operation order as tag keys', async () => {
    mockQuery.mockImplementation(async (sql: string) => ({ rows: sql.includes('FROM auth.skill_vocabulary') ? []
      : sql.includes('auth.user_tags') ? [] : [{ allowed: true }], rowCount: 1 }));
    const res = await get(`/auth/skills/communities/${COMMUNITY}/search?skill=${encodeURIComponent('İğne oyası')}`);
    expect(res.status).toBe(200);
    const [sql, params] = mockQuery.mock.calls.find(([sql]) => String(sql).includes('auth.user_tags'))!;
    expect(params).toContain('İğne oyası');
    expect(sql).toContain("lower(regexp_replace(trim($3::text), '[^a-zA-Z0-9]+', '_', 'g'))");
  });
});
