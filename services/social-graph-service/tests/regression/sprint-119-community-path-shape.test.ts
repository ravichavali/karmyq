/**
 * Sprint 119 / BUG-029: a community_member trust path is two endpoints plus community_name.
 * No third person (the earliest-joined admin) is ever manufactured into it — the badge was
 * rendering "Fellow member via {admin}" for people the viewer never exchanged with.
 *
 * Server contract (maintainer-decided shape):
 *  - path = [source, target] exactly, names attached
 *  - community_name present
 *  - connection_type: 'community_member', degrees: 2 (feed proximity ranking preserved)
 *  - cache-hit responses (single + batch) carry community_name too — fresh computes always
 *    included it, cache hits omitted it until this sprint.
 */
import request from 'supertest';
import express from 'express';

jest.mock('../../src/config/database', () => ({
  pool: { query: jest.fn() },
}));

jest.mock('../../src/config/logger', () => ({
  logger: { info: jest.fn(), debug: jest.fn(), error: jest.fn(), warn: jest.fn() },
}));

const { pool } = require('../../src/config/database');

const SOURCE = '11111111-1111-1111-1111-111111111111';
const TARGET = '22222222-2222-2222-2222-222222222222';
const ADMIN = '99999999-9999-9999-9999-999999999999';
const COMMUNITY = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const COMMUNITY_NAME = 'Southeast PDX Helpers';

describe('Sprint 119 / BUG-029: computeCommunityPath endpoints-only shape', () => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { computeCommunityPath } = require('../../src/services/pathComputation');

  beforeEach(() => {
    jest.clearAllMocks();
    pool.query.mockReset();
    // Answer by SQL shape, not call order, so the assertions survive query rewrites. The
    // identity lookup is checked FIRST — it also joins communities.members (disclosure gate).
    pool.query.mockImplementation((sql: string) => {
      if (sql.includes('FROM auth.users')) {
        return Promise.resolve({
          rows: [
            { id: SOURCE, name: 'Maria Reyes' },
            { id: TARGET, name: 'Ben Okafor' },
            { id: ADMIN, name: 'Nadia Ito' },
          ],
        });
      }
      if (sql.includes('communities.members')) {
        // Shared-membership lookup, keyed by the target user. admin_id is included so the
        // pre-fix query shape is also satisfied — the assertions must fail against the
        // manufactured-admin path.
        return Promise.resolve({
          rows: [
            { user_id: TARGET, community_id: COMMUNITY, community_name: COMMUNITY_NAME, admin_id: ADMIN },
            { user_id: ADMIN, community_id: COMMUNITY, community_name: COMMUNITY_NAME, admin_id: ADMIN },
          ],
        });
      }
      return Promise.resolve({ rows: [] });
    });
  });

  it('returns EXACTLY the two endpoints — no admin node manufactured into the path', async () => {
    const result = await computeCommunityPath(SOURCE, TARGET);

    expect(result).not.toBeNull();
    expect(result!.path).toHaveLength(2);
    expect(result!.path.map((n: { id: string }) => n.id)).toEqual([SOURCE, TARGET]);
    expect(result!.userIds).toEqual([SOURCE, TARGET]);
    // Regression: the admin/member lookup result must not appear ANYWHERE in the path.
    expect(result!.path.some((n: { id: string }) => n.id === ADMIN)).toBe(false);
    expect(result!.path.some((n: { name: string }) => n.name === 'Nadia Ito')).toBe(false);
    expect(result!.userIds).not.toContain(ADMIN);
  });

  it('keeps connection_type, community_name and degrees: 2 (feed ranking input unchanged)', async () => {
    const result = await computeCommunityPath(SOURCE, TARGET);

    expect(result).not.toBeNull();
    expect(result!.connectionType).toBe('community_member');
    expect(result!.communityName).toBe(COMMUNITY_NAME);
    expect(result!.degrees).toBe(2);
  });

  it('returns degrees: 2 even when one endpoint happens to be the community admin', async () => {
    // The 1° special case existed only because of the admin lookup; with the lookup gone,
    // co-membership is uniformly a 2° proximity signal (never a claimed direct bond).
    const result = await computeCommunityPath(SOURCE, ADMIN);

    expect(result).not.toBeNull();
    expect(result!.degrees).toBe(2);
    expect(result!.path.map((n: { id: string }) => n.id)).toEqual([SOURCE, ADMIN]);
  });

  it('still returns null when the users share no community', async () => {
    pool.query.mockImplementation((sql: string) => {
      if (sql.includes('communities.members')) return Promise.resolve({ rows: [] });
      return Promise.resolve({ rows: [] });
    });

    const result = await computeCommunityPath(SOURCE, TARGET);
    expect(result).toBeNull();
  });
});

describe('Sprint 119: computeInvitationPath names resolve through the ADR-082 identity gate', () => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { computeInvitationPath } = require('../../src/services/pathComputation');

  it('renders a departed chain member as Unknown, keeping active members named', async () => {
    pool.query.mockReset();
    pool.query.mockImplementation((sql: string) => {
      if (sql.includes('auth.user_invitations')) {
        return Promise.resolve({
          rows: [
            { user_a: SOURCE, user_b: ADMIN },
            { user_a: ADMIN, user_b: TARGET },
          ],
        });
      }
      if (sql.includes('FROM auth.users')) {
        // ADMIN is no longer an active member anywhere — the gate excludes them.
        return Promise.resolve({
          rows: [
            { id: SOURCE, name: 'Maria Reyes' },
            { id: TARGET, name: 'Ben Okafor' },
          ],
        });
      }
      return Promise.resolve({ rows: [] });
    });

    const result = await computeInvitationPath(SOURCE, TARGET);

    expect(result).not.toBeNull();
    expect(result!.path.map((n: { name: string }) => n.name)).toEqual([
      'Maria Reyes',
      'Unknown',
      'Ben Okafor',
    ]);
  });
});

describe('Sprint 119 / BUG-029: cache-hit responses carry community_name and stale rows recompute', () => {
  // Route-level: pre-seeded community_member auth.social_distances rows. Component tests with a
  // mocked community_name cannot catch these — the cache-hit branch responded without the name
  // until this sprint, and pre-fix rows carry shapes current computation can't produce.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const pathRoutes = require('../../src/routes/paths').default;

  // Post-fix cached shape: two endpoints, degrees 2.
  const VALID_CACHED_PATH = [
    { id: SOURCE, name: 'Maria Reyes' },
    { id: TARGET, name: 'Ben Okafor' },
  ];
  // Pre-fix cached shape: the manufactured admin node in the middle.
  const OLD_CACHED_PATH = [
    { id: SOURCE, name: 'Maria Reyes' },
    { id: ADMIN, name: 'Nadia Ito' },
    { id: TARGET, name: 'Ben Okafor' },
  ];

  const app = express();
  app.use(express.json());
  app.use((req: any, _res, next) => {
    req.user = { userId: SOURCE, currentCommunityId: COMMUNITY };
    next();
  });
  app.use('/paths', pathRoutes);

  /** SQL-shape mock: cached row configurable; shared-membership + identity lookups canned. */
  function mockQueries({ cachedRow, sharesCommunity = true }: { cachedRow: object | null; sharesCommunity?: boolean }) {
    pool.query.mockImplementation((sql: string) => {
      if (sql.includes('auth.social_distances')) {
        return Promise.resolve({ rows: cachedRow ? [cachedRow] : [] });
      }
      if (sql.includes('FROM auth.users')) {
        return Promise.resolve({
          rows: [
            { id: SOURCE, name: 'Maria Reyes' },
            { id: TARGET, name: 'Ben Okafor' },
          ],
        });
      }
      if (sql.includes('communities.members')) {
        return Promise.resolve({
          rows: sharesCommunity
            ? [{ user_id: TARGET, community_id: COMMUNITY, community_name: COMMUNITY_NAME }]
            : [],
        });
      }
      return Promise.resolve({ rows: [] });
    });
  }

  const cachedRow = (overrides: object = {}) => ({
    user_b_id: TARGET,
    degrees_of_separation: 2,
    shortest_path: VALID_CACHED_PATH,
    path_trust_score: 0,
    connection_type: 'community_member',
    computed_at: '2026-07-01T00:00:00.000Z',
    ...overrides,
  });

  beforeEach(() => {
    jest.clearAllMocks();
    pool.query.mockReset();
  });

  it('GET /paths/:targetUserId enriches a valid cached community_member row with community_name', async () => {
    mockQueries({ cachedRow: cachedRow() });

    const response = await request(app).get(`/paths/${TARGET}`).expect(200);

    expect(response.body.data).toMatchObject({
      degrees_of_separation: 2,
      connection_type: 'community_member',
      community_name: COMMUNITY_NAME,
      cached: true,
    });
    expect(Array.isArray(response.body.data.path)).toBe(true);

    // The enrichment prefers the resolved request scope when the pair shares several communities.
    const enrichmentCall = pool.query.mock.calls.find(([sql]: [string]) => sql.includes('DISTINCT ON'));
    expect(enrichmentCall).toBeDefined();
    expect(enrichmentCall![1]).toEqual([SOURCE, [TARGET], COMMUNITY]);
  });

  it('GET: a pre-fix 3-node cached row is deleted and recomputed truthfully (no admin node outward)', async () => {
    mockQueries({ cachedRow: cachedRow({ shortest_path: OLD_CACHED_PATH }) });

    const response = await request(app).get(`/paths/${TARGET}`).expect(200);

    expect(pool.query).toHaveBeenCalledWith(
      expect.stringContaining('DELETE FROM auth.social_distances'),
      [SOURCE, TARGET, COMMUNITY],
    );
    expect(response.body.data).toMatchObject({
      degrees_of_separation: 2,
      connection_type: 'community_member',
      community_name: COMMUNITY_NAME,
      cached: false,
    });
    expect(response.body.data.path.map((n: { id: string }) => n.id)).toEqual([SOURCE, TARGET]);
  });

  it('GET: a pre-fix 1° admin-endpoint cached row is deleted and recomputed as uniform 2°', async () => {
    mockQueries({ cachedRow: cachedRow({ degrees_of_separation: 1 }) });

    const response = await request(app).get(`/paths/${TARGET}`).expect(200);

    expect(pool.query).toHaveBeenCalledWith(
      expect.stringContaining('DELETE FROM auth.social_distances'),
      [SOURCE, TARGET, COMMUNITY],
    );
    expect(response.body.data).toMatchObject({
      degrees_of_separation: 2,
      cached: false,
    });
  });

  it('GET: a cached community_member row for a pair that no longer shares ANY community is stale, not "Fellow community member"', async () => {
    mockQueries({ cachedRow: cachedRow(), sharesCommunity: false });

    const response = await request(app).get(`/paths/${TARGET}`).expect(200);

    expect(pool.query).toHaveBeenCalledWith(
      expect.stringContaining('DELETE FROM auth.social_distances'),
      [SOURCE, TARGET, COMMUNITY],
    );
    // Recompute finds no exchange, no shared community, no invitation chain → no connection.
    expect(response.body.data).toMatchObject({
      degrees_of_separation: null,
      connection_type: null,
      cached: false,
    });
  });

  it('POST /paths/batch enriches valid cached community_member entries with community_name', async () => {
    mockQueries({ cachedRow: cachedRow() });

    const response = await request(app)
      .post('/paths/batch')
      .send({ target_user_ids: [TARGET] })
      .expect(200);

    expect(response.body.data).toEqual([
      expect.objectContaining({
        target_user_id: TARGET,
        degrees_of_separation: 2,
        connection_type: 'community_member',
        community_name: COMMUNITY_NAME,
        cached: true,
      }),
    ]);
  });

  it('POST /paths/batch recomputes a pre-fix 3-node cached row instead of serving it', async () => {
    mockQueries({ cachedRow: cachedRow({ shortest_path: OLD_CACHED_PATH }) });

    const response = await request(app)
      .post('/paths/batch')
      .send({ target_user_ids: [TARGET] })
      .expect(200);

    expect(pool.query).toHaveBeenCalledWith(
      expect.stringContaining('DELETE FROM auth.social_distances'),
      [SOURCE, TARGET, COMMUNITY],
    );
    expect(response.body.data).toEqual([
      expect.objectContaining({
        target_user_id: TARGET,
        degrees_of_separation: 2,
        connection_type: 'community_member',
        community_name: COMMUNITY_NAME,
        cached: false,
      }),
    ]);
  });

  it('GET: cached invitation_chain names re-project through the identity gate (departed member → Unknown)', async () => {
    // ADR-082 adoption (Sprint 119 review decision): a cached chain written before the gate can
    // carry a departed member's name — it must not stay disclosed for the 7-day TTL.
    pool.query.mockImplementation((sql: string) => {
      if (sql.includes('auth.social_distances')) {
        return Promise.resolve({
          rows: [{
            user_b_id: TARGET,
            degrees_of_separation: 2,
            shortest_path: OLD_CACHED_PATH, // includes ADMIN ("Nadia Ito"), who has departed
            path_trust_score: 0,
            connection_type: 'invitation_chain',
            computed_at: '2026-07-01T00:00:00.000Z',
          }],
        });
      }
      if (sql.includes('FROM auth.users')) {
        // Identity gate: only SOURCE and TARGET are still active members anywhere.
        return Promise.resolve({
          rows: [
            { id: SOURCE, name: 'Maria Reyes' },
            { id: TARGET, name: 'Ben Okafor' },
          ],
        });
      }
      return Promise.resolve({ rows: [] });
    });

    const response = await request(app).get(`/paths/${TARGET}`).expect(200);

    expect(response.body.data).toMatchObject({
      degrees_of_separation: 2,
      connection_type: 'invitation_chain',
      cached: true,
    });
    const names = response.body.data.path.map((n: { name: string }) => n.name);
    expect(names).toEqual(['Maria Reyes', 'Unknown', 'Ben Okafor']);
    expect(JSON.stringify(response.body.data)).not.toContain('Nadia Ito');
  });

  it('POST /paths/batch includes community_name on FRESH community_member computes too', async () => {
    pool.query.mockImplementation((sql: string) => {
      if (sql.includes('auth.social_distances')) {
        // No cached row; the INSERT ... ON CONFLICT write also matches this branch harmlessly.
        return Promise.resolve({ rows: [] });
      }
      if (sql.includes('FROM auth.users')) {
        return Promise.resolve({
          rows: [
            { id: SOURCE, name: 'Maria Reyes' },
            { id: TARGET, name: 'Ben Okafor' },
            { id: ADMIN, name: 'Nadia Ito' },
          ],
        });
      }
      if (sql.includes('communities.members')) {
        return Promise.resolve({
          rows: [{ user_id: TARGET, community_id: COMMUNITY, community_name: COMMUNITY_NAME, admin_id: ADMIN }],
        });
      }
      return Promise.resolve({ rows: [] });
    });

    const response = await request(app)
      .post('/paths/batch')
      .send({ target_user_ids: [TARGET] })
      .expect(200);

    expect(response.body.data).toEqual([
      expect.objectContaining({
        target_user_id: TARGET,
        degrees_of_separation: 2,
        connection_type: 'community_member',
        community_name: COMMUNITY_NAME,
        cached: false,
      }),
    ]);
  });
});
