/**
 * Sprint 125 — GET /providers/community/:communityId, the provider reach gate.
 *
 * WHAT THIS FILE CAN AND CANNOT PROVE
 * -----------------------------------
 * The three reach conditions live in SQL (community opt-in × personal trust floor × service-type
 * allowlist). With `query` mocked, the database never evaluates them, so a test here that fed in
 * two rows and asserted one came back would be asserting the behaviour of `mockResolvedValueOnce`
 * — a gate proven by its own stub. That is the false-green shape this repo has shipped before.
 *
 * So this file proves the things that genuinely live in the route:
 *   - the auth and live-membership gates, which run BEFORE the query and can reject on their own;
 *   - that a missing `community_configs` row yields an empty layer, not a 404;
 *   - Express route ordering, which decides whether the endpoint is reachable at all;
 *   - that the SQL actually handed to the driver still carries each of the three conditions in the
 *     exact form the semantics depend on (LEFT JOIN + COALESCE, cardinality-means-all).
 *
 * The proof that the gate REJECTS the right rows against a real planner — both directions, per
 * condition — is `tests/integration/sprint-125-provider-reach-gate.integration.test.ts`, which
 * needs Postgres with RLS on. Neither file is sufficient alone and neither is redundant.
 */

import request from 'supertest';
import express from 'express';
import jwt from 'jsonwebtoken';

jest.mock('../../src/database/db', () => ({
  query: jest.fn(),
}));

import { query } from '../../src/database/db';
const mockQuery = query as jest.Mock;

const JWT_SECRET = 'test-secret';
const COMMUNITY = '11111111-1111-1111-1111-111111111111';
const VIEWER = '22222222-2222-2222-2222-222222222222';

function buildApp() {
  const app = express();
  app.use(express.json());
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const providersRouter = require('../../src/routes/providers').default;
  app.use('/providers', providersRouter);
  return app;
}

function makeToken(userId = VIEWER, communities: unknown[] = []) {
  return jwt.sign({ userId, email: 'v@test.com', communities }, JWT_SECRET);
}

/** The membership pre-check resolves first; the layer query resolves second. */
function mockMemberThen(rows: unknown[]) {
  mockQuery
    .mockResolvedValueOnce({ rows: [{ community_id: COMMUNITY }] }) // active membership
    .mockResolvedValueOnce({ rows }); // the reach layer
}

describe('GET /providers/community/:communityId — access gates', () => {
  let app: express.Express;

  beforeAll(() => {
    process.env.JWT_SECRET = JWT_SECRET;
    app = buildApp();
  });

  afterEach(() => mockQuery.mockReset());

  it('rejects an anonymous caller with 401', async () => {
    const res = await request(app).get(`/providers/community/${COMMUNITY}`);

    expect(res.status).toBe(401);
    // The membership lookup must not even be attempted for an unauthenticated caller.
    expect(mockQuery).not.toHaveBeenCalled();
  });

  it('rejects a non-member with 403 and never runs the layer query', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] }); // no active membership

    const res = await request(app)
      .get(`/providers/community/${COMMUNITY}`)
      .set('Authorization', `Bearer ${makeToken()}`);

    expect(res.status).toBe(403);
    // One call only: the membership check. Reaching the provider query would mean the gate ran
    // after the data was already fetched.
    expect(mockQuery).toHaveBeenCalledTimes(1);
  });

  it('re-derives membership from communities.members, NOT the JWT claim', async () => {
    // The token claims an active admin membership. The live table says otherwise, and the live
    // table wins — a removed member keeps a stale claim until their next refresh.
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const token = makeToken(VIEWER, [{ id: COMMUNITY, name: 'Stale', role: 'admin' }]);
    const res = await request(app)
      .get(`/providers/community/${COMMUNITY}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);

    const sql = String(mockQuery.mock.calls[0][0]);
    expect(sql).toContain('communities.members');
    expect(sql).toMatch(/status\s*=\s*'active'/);
    expect(mockQuery.mock.calls[0][1]).toEqual([VIEWER, COMMUNITY]);
  });

  it('allows an active member through to the layer', async () => {
    mockMemberThen([]);

    const res = await request(app)
      .get(`/providers/community/${COMMUNITY}`)
      .set('Authorization', `Bearer ${makeToken()}`);

    expect(res.status).toBe(200);
    expect(mockQuery).toHaveBeenCalledTimes(2);
  });
});

describe('GET /providers/community/:communityId — response contract', () => {
  let app: express.Express;

  beforeAll(() => {
    process.env.JWT_SECRET = JWT_SECRET;
    app = buildApp();
  });

  afterEach(() => mockQuery.mockReset());

  it('returns 200 with an empty array when the community has no config row', async () => {
    // A community that never enabled provider services is DISABLED, not missing. `config.ts`
    // returns 404 for an absent row; this surface must not, or the UI cannot tell "switched off"
    // from "no such community" — and a 404 here would leak which communities exist to members.
    mockMemberThen([]);

    const res = await request(app)
      .get(`/providers/community/${COMMUNITY}`)
      .set('Authorization', `Bearer ${makeToken()}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, data: [] });
  });

  it('returns the ADR-074 success envelope with provider rows', async () => {
    mockMemberThen([
      { id: 'p1', user_id: 'u1', display_name: 'Ali Rickshaw', service_type: 'ride', trust_score: 80 },
    ]);

    const res = await request(app)
      .get(`/providers/community/${COMMUNITY}`)
      .set('Authorization', `Bearer ${makeToken()}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].display_name).toBe('Ali Rickshaw');
  });

  it('binds communityId, limit and offset as parameters, never interpolated', async () => {
    mockMemberThen([]);

    await request(app)
      .get(`/providers/community/${COMMUNITY}?limit=5&offset=10`)
      .set('Authorization', `Bearer ${makeToken()}`);

    const [sql, params] = mockQuery.mock.calls[1];
    // Coerced to integers, not passed through as the raw query strings.
    expect(params).toEqual([COMMUNITY, 5, 10]);
    // The raw values must not appear in the SQL text itself.
    expect(String(sql)).not.toContain(COMMUNITY);
  });

  it('clamps an oversized limit rather than serving the whole directory', async () => {
    mockMemberThen([]);

    await request(app)
      .get(`/providers/community/${COMMUNITY}?limit=100000`)
      .set('Authorization', `Bearer ${makeToken()}`);

    expect(mockQuery.mock.calls[1][1]).toEqual([COMMUNITY, 100, 0]);
  });

  it('falls back to defaults for a non-numeric limit instead of 500ing', async () => {
    // `?limit=abc` reaching Postgres as a bound param raises, turning a typo into a 500.
    mockMemberThen([]);

    const res = await request(app)
      .get(`/providers/community/${COMMUNITY}?limit=abc&offset=-5`)
      .set('Authorization', `Bearer ${makeToken()}`);

    expect(res.status).toBe(200);
    expect(mockQuery.mock.calls[1][1]).toEqual([COMMUNITY, 20, 0]);
  });
});

describe('GET /providers/community/:communityId — the SQL keeps its three conditions', () => {
  let app: express.Express;

  beforeAll(() => {
    process.env.JWT_SECRET = JWT_SECRET;
    app = buildApp();
  });

  afterEach(() => mockQuery.mockReset());

  async function layerSql(): Promise<string> {
    mockMemberThen([]);
    await request(app)
      .get(`/providers/community/${COMMUNITY}`)
      .set('Authorization', `Bearer ${makeToken()}`);
    return String(mockQuery.mock.calls[1][0]);
  }

  it('gates on the community opt-in flag', async () => {
    expect(await layerSql()).toMatch(/c\.provider_services_enabled\s*=\s*TRUE/i);
  });

  it('scores a missing trust row as 0 via LEFT JOIN + COALESCE, never an INNER JOIN', async () => {
    const sql = await layerSql();

    // COALESCE is the whole fail-closed rule (ADR-037): unknown standing is 0, not "absent".
    expect(sql).toMatch(/COALESCE\(\s*ts\.score\s*,\s*0\s*\)\s*>=\s*c\.provider_min_personal_trust_score/i);
    // An INNER JOIN here would silently drop every provider with no trust row even when the floor
    // is 0 — the opposite failure, and invisible in a green run.
    expect(sql).toMatch(/LEFT JOIN\s+reputation\.trust_scores\s+ts/i);
    expect(sql).not.toMatch(/(?<!LEFT )JOIN\s+reputation\.trust_scores/i);
  });

  it('treats an empty provider_services_list as "all types allowed"', async () => {
    // Default is '{}'. A deny-all reading switches off every community that opted in without
    // curating a list — which is most of them.
    expect(await layerSql()).toMatch(
      /cardinality\(\s*c\.provider_services_list\s*\)\s*=\s*0\s+OR\s+pp\.service_type\s*=\s*ANY\(\s*c\.provider_services_list\s*\)/i
    );
  });

  it('filters the provider to active membership of the SAME community', async () => {
    const sql = await layerSql();
    expect(sql).toMatch(/JOIN\s+communities\.members\s+pm/i);
    expect(sql).toMatch(/pm\.status\s*=\s*'active'/i);
  });

  it('only lists active provider profiles', async () => {
    expect(await layerSql()).toMatch(/pp\.is_active\s*=\s*TRUE/i);
  });
});

describe('Express route ordering', () => {
  let app: express.Express;

  beforeAll(() => {
    process.env.JWT_SECRET = JWT_SECRET;
    app = buildApp();
  });

  afterEach(() => mockQuery.mockReset());

  it('resolves /community/:id to the layer, not to GET /:providerId', async () => {
    // `GET /:providerId` would happily match the literal segment "community" and 404 on it. This
    // is the same ordering hazard `/providers/my` already depends on.
    mockMemberThen([]);

    const res = await request(app)
      .get(`/providers/community/${COMMUNITY}`)
      .set('Authorization', `Bearer ${makeToken()}`);

    expect(res.status).toBe(200);
    // The single-provider route takes one param and would never issue the membership pre-check.
    expect(mockQuery.mock.calls[0][1]).toEqual([VIEWER, COMMUNITY]);
  });
});
