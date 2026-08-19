/**
 * Sprint 125 — providerReachService unit tests.
 *
 * These assert the two things that are true of the module regardless of any database: the paging
 * clamp, and the exact shape of the reach SQL. The SQL assertions are not decoration — each one
 * pins a condition whose "obvious simplification" silently changes who can see whom:
 *
 *   INNER JOIN instead of LEFT   -> every provider without a trust row vanishes, at ANY floor
 *   bare ts.score instead of COALESCE -> right answer today, wrong the moment the join changes
 *   cardinality read as deny-all -> every community that opted in without a list goes dark
 *
 * None of those show up as a failure in a green run against seeded data that happens to have trust
 * rows for everyone. They show up in production as an empty tab.
 *
 * Whether the gate actually REJECTS against a real planner is proven separately, in
 * tests/integration/sprint-125-provider-reach-gate.integration.test.ts.
 */

jest.mock('../../src/database/db', () => ({
  query: jest.fn(),
}));

import { query } from '../../src/database/db';
import {
  COMMUNITY_PROVIDER_QUERY,
  getCommunityProviders,
  isActiveMember,
} from '../../src/services/providerReachService';

const mockQuery = query as jest.Mock;

const COMMUNITY = '11111111-1111-1111-1111-111111111111';
const USER = '22222222-2222-2222-2222-222222222222';

describe('isActiveMember', () => {
  afterEach(() => mockQuery.mockReset());

  it('queries the live members table with both ids bound and status active', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ community_id: COMMUNITY }] });

    await expect(isActiveMember(USER, COMMUNITY)).resolves.toBe(true);

    const [sql, params] = mockQuery.mock.calls[0];
    expect(String(sql)).toContain('communities.members');
    expect(String(sql)).toMatch(/status\s*=\s*'active'/);
    expect(params).toEqual([USER, COMMUNITY]);
  });

  it('returns false when no active membership row exists', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });

    await expect(isActiveMember(USER, COMMUNITY)).resolves.toBe(false);
  });

  it('does not treat a non-active membership as membership', async () => {
    // The status filter is in SQL, so an inactive member simply yields no rows. Asserted here so
    // that moving the filter into JS (or dropping it) fails rather than passing on a helpful mock.
    mockQuery.mockResolvedValueOnce({ rows: [] });

    await expect(isActiveMember(USER, COMMUNITY)).resolves.toBe(false);
    expect(String(mockQuery.mock.calls[0][0])).toMatch(/status\s*=\s*'active'/);
  });
});

describe('getCommunityProviders — paging clamp', () => {
  afterEach(() => mockQuery.mockReset());

  const paramsFor = async (options: Record<string, unknown>) => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    await getCommunityProviders(COMMUNITY, options);
    return mockQuery.mock.calls[0][1];
  };

  it.each([
    ['defaults when absent', {}, [COMMUNITY, 20, 0]],
    ['parses numeric strings', { limit: '5', offset: '10' }, [COMMUNITY, 5, 10]],
    ['clamps an oversized limit to 100', { limit: '100000' }, [COMMUNITY, 100, 0]],
    ['clamps a zero limit up to 1', { limit: '0' }, [COMMUNITY, 1, 0]],
    ['clamps a negative offset to 0', { offset: '-40' }, [COMMUNITY, 20, 0]],
    ['falls back on non-numeric input', { limit: 'abc', offset: 'xyz' }, [COMMUNITY, 20, 0]],
  ])('%s', async (_label, options, expected) => {
    expect(await paramsFor(options as Record<string, unknown>)).toEqual(expected);
  });

  it('returns the driver rows unchanged', async () => {
    const rows = [{ id: 'p1', display_name: 'Ali Rickshaw' }];
    mockQuery.mockResolvedValueOnce({ rows });

    await expect(getCommunityProviders(COMMUNITY)).resolves.toEqual(rows);
  });
});

describe('COMMUNITY_PROVIDER_QUERY — the three conditions', () => {
  it('condition 1: gates on the community opt-in flag', () => {
    expect(COMMUNITY_PROVIDER_QUERY).toMatch(/c\.provider_services_enabled\s*=\s*TRUE/);
  });

  it('condition 1: joins community_configs INNER so a missing row yields an empty layer', () => {
    // An unconfigured community is DISABLED, not an error. The inner join is what produces zero
    // rows instead of the 404 that config.ts returns for an absent row.
    expect(COMMUNITY_PROVIDER_QUERY).toMatch(/\n\s*JOIN\s+communities\.community_configs\s+c/);
    expect(COMMUNITY_PROVIDER_QUERY).not.toMatch(/LEFT JOIN\s+communities\.community_configs/);
  });

  it('condition 2: scores an absent trust row as 0 rather than dropping the provider', () => {
    expect(COMMUNITY_PROVIDER_QUERY).toMatch(
      /COALESCE\(\s*ts\.score\s*,\s*0\s*\)\s*>=\s*c\.provider_min_personal_trust_score/
    );
  });

  it('condition 2: the trust_scores join is LEFT, never INNER', () => {
    expect(COMMUNITY_PROVIDER_QUERY).toMatch(/LEFT JOIN\s+reputation\.trust_scores\s+ts/);
    // Catches a future edit that adds a second, inner join to the same table.
    const innerTrustJoin = /(^|\n)\s*JOIN\s+reputation\.trust_scores/;
    expect(COMMUNITY_PROVIDER_QUERY).not.toMatch(innerTrustJoin);
  });

  it('condition 2: filters personal standing, NOT provider profile quality', () => {
    // The two scores are separately named for a reason. `provider_trust_scores.trust_score` must
    // never appear in the WHERE clause; it belongs to ORDER BY only.
    const whereClause = COMMUNITY_PROVIDER_QUERY.slice(
      COMMUNITY_PROVIDER_QUERY.indexOf('WHERE'),
      COMMUNITY_PROVIDER_QUERY.indexOf('ORDER BY')
    );
    expect(whereClause).toContain('ts.score');
    expect(whereClause).not.toContain('pts.trust_score');
  });

  it('condition 3: an empty allowlist means all service types', () => {
    expect(COMMUNITY_PROVIDER_QUERY).toMatch(
      /cardinality\(\s*c\.provider_services_list\s*\)\s*=\s*0\s*\n?\s*OR\s+pp\.service_type\s*=\s*ANY\(\s*c\.provider_services_list\s*\)/
    );
  });

  it('requires the PROVIDER to be an active member of the same community', () => {
    expect(COMMUNITY_PROVIDER_QUERY).toMatch(
      /JOIN\s+communities\.members\s+pm\s*\n?\s*ON\s+pm\.user_id\s*=\s*pp\.user_id\s+AND\s+pm\.community_id\s*=\s*\$1\s+AND\s+pm\.status\s*=\s*'active'/
    );
  });

  it('lists only active provider profiles', () => {
    expect(COMMUNITY_PROVIDER_QUERY).toMatch(/pp\.is_active\s*=\s*TRUE/);
  });

  it('binds the community id rather than interpolating it', () => {
    expect(COMMUNITY_PROVIDER_QUERY).toContain('$1');
    expect(COMMUNITY_PROVIDER_QUERY).toContain('LIMIT $2 OFFSET $3');
  });

  it('selects an explicit column list, never pp.*', () => {
    // `SELECT pp.*` would ship every future column on provider_profiles to every community member
    // the moment it is added — including one added for an unrelated internal purpose.
    expect(COMMUNITY_PROVIDER_QUERY).not.toMatch(/pp\.\*/);
    expect(COMMUNITY_PROVIDER_QUERY).toMatch(/pp\.id,\s*pp\.user_id,\s*pp\.service_type/);
  });
});
