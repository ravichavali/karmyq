/**
 * Sprint 139 — BUG-081: trust weights are numbers at the database and cache boundaries.
 *
 * pg returns NUMERIC columns as strings ("0.60"; pg-types registers no parser for OID 1700). The
 * community depth/breadth readers, the user override reader and the community evolution prior
 * passed those strings straight through, and the effective-params cache handed back whatever JSON
 * it had stored for four hours. BUG-079 patched one use site; this pins the boundaries:
 *   - readers return numbers, keep NULL as NULL where NULL means "inherit", keep a community 0;
 *   - a cache hit is normalized on read, so a legacy string-valued entry written before the deploy
 *     is returned as numbers without a flush; anything that is not exactly a decimal number string
 *     or a finite number falls through to the database and is replaced;
 *   - the three routes that expose these values send numbers and keep their denials.
 *
 * Fixtures obey the schema (infrastructure/postgres/init.sql): user overrides are 0.10–0.90 or NULL,
 * priors 0.05–0.95, community weights 0.0–1.0 — so a zero appears only as a community weight.
 * Only transports are faked: the SQL executor, Redis, Bull and the JWT middleware.
 */
export {};

let currentUser: { userId: string } | null = null;
jest.mock('@karmyq/shared/middleware/auth', () => ({
  authMiddleware: (req: any, _res: any, next: any) => {
    req.user = currentUser;
    next();
  },
}));
jest.mock('bull', () => function MockBull() {
  return { add: () => Promise.resolve(), on: () => undefined, process: () => undefined };
});

const mockQuery = jest.fn();
jest.mock('../../src/database/db', () => ({ query: (...a: unknown[]) => mockQuery(...a) }));

const mockGet = jest.fn();
const mockSetex = jest.fn();
jest.mock('ioredis', () => ({
  __esModule: true,
  // A plain class: the root jest config's resetMocks would wipe a jest.fn(impl) declared here.
  default: class FakeRedis {
    get(...a: unknown[]) { return mockGet(...a); }
    setex(...a: unknown[]) { return mockSetex(...a); }
    del() { return Promise.resolve(1); }
    quit() { return Promise.resolve('OK'); }
    disconnect() { return undefined; }
  },
}));

import express from 'express';
import request from 'supertest';
import { getCommunityTrustConfig, TRUST_CONFIG_DEFAULTS } from '../../src/database/trustConfigDb';
import { getUserTrustConfig, getCommunityEvolutionConfig } from '../../src/database/trustEvolutionDb';
import { getCachedEffectiveParams } from '../../src/services/effectiveParamsCache';
import reputationRouter from '../../src/routes/reputation';

const SELF = '11111111-1111-1111-1111-111111111111';
const OTHER = '22222222-2222-2222-2222-222222222222';
const COMMUNITY = 'cccccccc-cccc-cccc-cccc-cccccccccccc';

const flat = (s: unknown) => String(s).replace(/\s+/g, ' ').trim();

// What pg hands back: NUMERIC as strings, booleans and integers as JS values.
let communityTrustRow: Record<string, unknown> | null;
let userRow: Record<string, unknown> | null;
let evolutionRow: Record<string, unknown> | null;
let isMember: boolean;
let liveRole: string | null;

function route(text: string, params: unknown[] = []) {
  const sql = flat(text);
  const one = (row: Record<string, unknown> | null) => Promise.resolve(row ? { rows: [row], rowCount: 1 } : { rows: [], rowCount: 0 });
  if (/FROM communities\.members m JOIN communities\.communities c/.test(sql)) {
    return one(isMember && params[0] === SELF ? { community_id: COMMUNITY, role: 'member', community_name: 'Maple' } : null);
  }
  if (/^SELECT role FROM communities\.members/.test(sql)) return one(liveRole ? { role: liveRole } : null);
  if (/FROM reputation\.user_trust_configs WHERE user_id = \$1 AND community_id = \$2/.test(sql)) return one(userRow);
  if (/trust_depth_weight.*FROM communities\.community_configs WHERE community_id = \$1/.test(sql)) return one(communityTrustRow);
  if (/^SELECT community_evolution_enabled, cross_community_prior FROM communities\.community_configs/.test(sql)) return one(evolutionRow);
  if (/utc\.evolution_enabled = true/.test(sql)) return one({ opted_in: '1', total: '2' });
  return Promise.reject(new Error(`unrouted statement: ${sql}`));
}

const COMMUNITY_TRUST_ROW = {
  trust_depth_weight: '0.70',
  trust_breadth_weight: '0.30',
  trust_feedback_threshold: '3.0',
  min_interactions_for_trust: 1,
  trust_negative_allowed: false,
  trust_carry_enabled: true,
  trust_carry_factor: '0.40',
  trust_carry_cap: 59,
};
const USER_ROW = {
  user_id: SELF, community_id: COMMUNITY, depth_weight: '0.25', breadth_weight: null,
  cross_community_prior: '0.55', evolution_enabled: true,
};

beforeEach(() => {
  communityTrustRow = { ...COMMUNITY_TRUST_ROW };
  userRow = { ...USER_ROW };
  evolutionRow = { community_evolution_enabled: true, cross_community_prior: '0.65' };
  isMember = true;
  liveRole = 'admin';
  currentUser = { userId: SELF };
  mockQuery.mockImplementation(route);
  mockGet.mockResolvedValue(null);
  mockSetex.mockResolvedValue('OK');
});

// ---------------------------------------------------------------------------------------------

describe('getCommunityTrustConfig: depth/breadth are numbers; NULL takes the default; 0 stays 0', () => {
  it('parses NUMERIC strings', async () => {
    const c = await getCommunityTrustConfig(COMMUNITY);
    expect(c.depth_weight).toBe(0.7);
    expect(c.breadth_weight).toBe(0.3);
    expect(c.carry_factor).toBe(0.4);
    expect(c.feedback_threshold).toBe(3);
    expect({ min: c.min_interactions_for_bonus, neg: c.negative_allowed, carry: c.carry_enabled, cap: c.carry_cap })
      .toEqual({ min: 1, neg: false, carry: true, cap: 59 });
  });

  it('a community weight of "0.00" is the number 0, not the default', async () => {
    communityTrustRow = { ...COMMUNITY_TRUST_ROW, trust_depth_weight: '0.00', trust_breadth_weight: '1.00' };
    const c = await getCommunityTrustConfig(COMMUNITY);
    expect(c.depth_weight).toBe(0);
    expect(c.breadth_weight).toBe(1);
  });

  it('NULL weights take the defaults, as numbers', async () => {
    communityTrustRow = { ...COMMUNITY_TRUST_ROW, trust_depth_weight: null, trust_breadth_weight: null };
    const c = await getCommunityTrustConfig(COMMUNITY);
    expect(c.depth_weight).toBe(TRUST_CONFIG_DEFAULTS.depth_weight);
    expect(c.breadth_weight).toBe(TRUST_CONFIG_DEFAULTS.breadth_weight);
  });

  it('no config row returns the defaults', async () => {
    communityTrustRow = null;
    await expect(getCommunityTrustConfig(COMMUNITY)).resolves.toEqual(TRUST_CONFIG_DEFAULTS);
  });
});

describe('getUserTrustConfig: overrides are numbers or NULL (inherit); the prior is a number', () => {
  it('parses NUMERIC strings and keeps NULL inheritance, identity and booleans', async () => {
    await expect(getUserTrustConfig(SELF, COMMUNITY)).resolves.toEqual({
      user_id: SELF, community_id: COMMUNITY, depth_weight: 0.25, breadth_weight: null,
      cross_community_prior: 0.55, evolution_enabled: true,
    });
  });

  it('queries the given user and community', async () => {
    await getUserTrustConfig(SELF, COMMUNITY);
    const call = mockQuery.mock.calls.find(([s]) => /user_trust_configs/.test(String(s)));
    expect(call?.[1]).toEqual([SELF, COMMUNITY]);
  });

  it('no row is still null', async () => {
    userRow = null;
    await expect(getUserTrustConfig(SELF, COMMUNITY)).resolves.toBeNull();
  });
});

describe('getCommunityEvolutionConfig: the prior is a number; the missing-row defaults are unchanged', () => {
  it('parses the prior', async () => {
    await expect(getCommunityEvolutionConfig(COMMUNITY)).resolves.toEqual({ community_evolution_enabled: true, cross_community_prior: 0.65 });
  });

  it('no row keeps { false, 0.50 }', async () => {
    evolutionRow = null;
    await expect(getCommunityEvolutionConfig(COMMUNITY)).resolves.toEqual({ community_evolution_enabled: false, cross_community_prior: 0.5 });
  });
});

// ---------------------------------------------------------------------------------------------

const KEY = `trust_params:${SELF}:${COMMUNITY}`;
// From the DB: user depth 0.25 overrides; breadth NULL inherits community 0.30; prior 0.55.
const FROM_DB = { depth_weight: 0.25, breadth_weight: 0.3, cross_community_prior: 0.55 };

describe('getCachedEffectiveParams: a hit is normalized on read', () => {
  it('a legacy string-valued entry is returned as numbers, without touching the DB or rewriting Redis', async () => {
    mockGet.mockResolvedValue('{"depth_weight":"0.60","breadth_weight":"0.40","cross_community_prior":"0.50"}');
    await expect(getCachedEffectiveParams(SELF, COMMUNITY)).resolves.toEqual({ depth_weight: 0.6, breadth_weight: 0.4, cross_community_prior: 0.5 });
    expect(mockQuery).not.toHaveBeenCalled();
    expect(mockSetex).not.toHaveBeenCalled();
  });

  it('"0.00" and negative decimal strings are valid decimal numbers', async () => {
    mockGet.mockResolvedValue('{"depth_weight":"0.00","breadth_weight":"-1.5","cross_community_prior":"1"}');
    await expect(getCachedEffectiveParams(SELF, COMMUNITY)).resolves.toEqual({ depth_weight: 0, breadth_weight: -1.5, cross_community_prior: 1 });
  });

  it('a numeric entry is returned exactly, and only the three contract fields', async () => {
    mockGet.mockResolvedValue('{"depth_weight":0.6,"breadth_weight":0.4,"cross_community_prior":0.5,"extra":"x"}');
    await expect(getCachedEffectiveParams(SELF, COMMUNITY)).resolves.toEqual({ depth_weight: 0.6, breadth_weight: 0.4, cross_community_prior: 0.5 });
    expect(mockQuery).not.toHaveBeenCalled();
  });

  const field = (v: string) => `{"depth_weight":${v},"breadth_weight":0.4,"cross_community_prior":0.5}`;
  it.each([
    ['malformed JSON', '{"depth_weight":'],
    ['JSON null', 'null'],
    ['a bare string', '"0.6"'],
    ['an array', '[0.6,0.4,0.5]'],
    ['a missing field', '{"depth_weight":0.6,"breadth_weight":0.4}'],
    ['a NULL field', field('null')],
    ['a boolean field', field('true')],
    ['an array field', field('[0.6]')],
    ['a blank string', field('""')],
    ['a non-numeric string', field('"abc"')],
    ['hex', field('"0x1A"')],
    ['exponent notation', field('"1e2"')],
    ['padded exponent', field('" 1e2 "')],
    ['a padded decimal', field('" 0.60 "')],
    ['a leading plus', field('"+0.6"')],
    ['a bare leading dot', field('".6"')],
    ['a trailing dot', field('"1."')],
    ['a non-finite number', field('1e400')],
  ])('%s falls through to the DB, and the numeric result replaces it', async (_l, cached) => {
    mockGet.mockResolvedValue(cached);
    const params = await getCachedEffectiveParams(SELF, COMMUNITY);
    expect(params).toEqual(FROM_DB);
    expect(mockSetex).toHaveBeenCalledWith(KEY, 14400, JSON.stringify(FROM_DB));
  });

  it('a cold miss reads the DB as numbers and caches them', async () => {
    const params = await getCachedEffectiveParams(SELF, COMMUNITY);
    expect(params).toEqual(FROM_DB);
    for (const v of Object.values(params)) expect(typeof v).toBe('number');
    expect(mockSetex).toHaveBeenCalledWith(KEY, 14400, JSON.stringify(FROM_DB));
  });

  it('a Redis read failure falls back to the DB; a write failure still returns the params', async () => {
    mockGet.mockRejectedValue(new Error('ECONNREFUSED'));
    mockSetex.mockRejectedValue(new Error('ECONNREFUSED'));
    await expect(getCachedEffectiveParams(SELF, COMMUNITY)).resolves.toEqual(FROM_DB);
  });
});

// ---------------------------------------------------------------------------------------------

function app() {
  const a = express();
  a.use(express.json());
  a.use('/reputation', reputationRouter);
  return a;
}
const DENIAL = { success: false, message: 'Reputation not found', error: 'REPUTATION_NOT_FOUND' };
const allNumbers = (o: Record<string, unknown>) => Object.values(o).every((v) => typeof v === 'number');

describe('routes send numbers and keep their denials', () => {
  it('GET /trust-config/:userId/:communityId: numeric overrides (NULL kept) and numeric effective params', async () => {
    const res = await request(app()).get(`/reputation/trust-config/${SELF}/${COMMUNITY}`);
    expect(res.status).toBe(200);
    expect(res.body.data.user_config).toEqual(expect.objectContaining({ depth_weight: 0.25, breadth_weight: null, cross_community_prior: 0.55 }));
    expect(res.body.data.effective_params).toEqual(FROM_DB);
    expect(allNumbers(res.body.data.effective_params)).toBe(true);
  });

  it.each([
    ['another user', () => { currentUser = { userId: OTHER }; }],
    ['a non-member', () => { isMember = false; }],
  ])('GET /trust-config denies %s with the same 404 body', async (_l, arrange) => {
    arrange();
    const res = await request(app()).get(`/reputation/trust-config/${SELF}/${COMMUNITY}`);
    expect({ status: res.status, body: res.body }).toEqual({ status: 404, body: DENIAL });
  });

  it.each([
    ['cold', null],
    ['legacy string cache', '{"depth_weight":"0.60","breadth_weight":"0.40","cross_community_prior":"0.50"}'],
  ])('GET /users/:userId/effective-params (%s) returns three numbers', async (_l, cached) => {
    mockGet.mockResolvedValue(cached);
    const res = await request(app()).get(`/reputation/users/${SELF}/effective-params?communityId=${COMMUNITY}`);
    expect(res.status).toBe(200);
    expect(Object.keys(res.body.data).sort()).toEqual(['breadth_weight', 'cross_community_prior', 'depth_weight']);
    expect(allNumbers(res.body.data)).toBe(true);
  });

  it.each([
    ['another user', () => { currentUser = { userId: OTHER }; }],
    ['a non-member', () => { isMember = false; }],
  ])('GET /effective-params denies %s with the same 404 body', async (_l, arrange) => {
    arrange();
    const res = await request(app()).get(`/reputation/users/${SELF}/effective-params?communityId=${COMMUNITY}`);
    expect({ status: res.status, body: res.body }).toEqual({ status: 404, body: DENIAL });
  });

  it('GET /communities/:communityId/trust-evolution: a live admin sees a numeric prior', async () => {
    const res = await request(app()).get(`/reputation/communities/${COMMUNITY}/trust-evolution`);
    expect(res.status).toBe(200);
    expect(res.body.data.cross_community_prior).toBe(0.65);
  });

  it('GET /communities/:communityId/trust-evolution still refuses a non-admin', async () => {
    liveRole = 'member';
    const res = await request(app()).get(`/reputation/communities/${COMMUNITY}/trust-evolution`);
    expect(res.status).toBe(403);
  });
});
