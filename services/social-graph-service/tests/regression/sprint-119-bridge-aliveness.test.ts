/**
 * Sprint 119 / ADR-086 — bridge aliveness on the inter-community depth graph.
 *
 * `/trust/communities` organic links gain `active_recently: boolean`, derived server-side from
 * `social_graph.community_trust_edges.last_interaction_at` inside the SAME exported 30-day window
 * S118 introduced (`FORMED_RECENTLY_WINDOW_DAYS` — never a second window constant). Fail-closed:
 * a missing/old/unparseable timestamp is never "alive". The raw timestamp never leaves the
 * server (ADR-082). Fission lineage links are untouched.
 *
 * Real derivation under test via `getCommunityDepthGraph` with a mocked pool (the service's
 * established unit style); the organic-query shape is pinned via the mocked-pool SQL.
 */

jest.mock('../../src/config/database', () => ({
  pool: {
    query: jest.fn(),
  },
}));

const { pool } = require('../../src/config/database');

import { FORMED_RECENTLY_WINDOW_DAYS } from '../../src/services/disclosureProjection';
import { getCommunityDepthGraph } from '../../src/database/trustEdgeDb';

const DAY_MS = 24 * 60 * 60 * 1000;
const daysAgo = (days: number) => new Date(Date.now() - days * DAY_MS);

const nodeRows = [
  { id: 'c1', name: 'Garden Co-op', member_count: '12', status: 'active', is_member: true },
  { id: 'c2', name: 'Tool Library', member_count: '40', status: 'active', is_member: true },
  { id: 'c3', name: 'Cycle Collective', member_count: '8', status: 'active', is_member: false },
];

/** Mocks the three queries in call order: nodes, then Promise.all([organic, fission]). */
function mockDepthGraphQueries(organicRows: unknown[], fissionRows: unknown[] = []) {
  pool.query
    .mockResolvedValueOnce({ rows: nodeRows })
    .mockResolvedValueOnce({ rows: organicRows })
    .mockResolvedValueOnce({ rows: fissionRows });
}

beforeEach(() => {
  pool.query.mockReset();
});

describe('Sprint 119: organic links carry a fail-closed active_recently boolean', () => {
  it('derives true inside the shared 30-day window and false outside it (same S118 constant)', async () => {
    mockDepthGraphQueries([
      {
        source: 'c1',
        target: 'c2',
        weight: '3',
        last_interaction_at: daysAgo(FORMED_RECENTLY_WINDOW_DAYS - 1),
      },
      {
        source: 'c1',
        target: 'c3',
        weight: '1',
        last_interaction_at: daysAgo(FORMED_RECENTLY_WINDOW_DAYS + 1),
      },
    ]);

    const graph = await getCommunityDepthGraph('user-1');
    const organic = graph.links.filter(l => l.type === 'organic');

    expect(organic).toHaveLength(2);
    expect(organic[0].active_recently).toBe(true);
    expect(organic[1].active_recently).toBe(false);
  });

  it('fails closed: missing, null, or unparseable last_interaction_at is never alive', async () => {
    mockDepthGraphQueries([
      { source: 'c1', target: 'c2', weight: '3', last_interaction_at: null },
      { source: 'c1', target: 'c3', weight: '1' },
      { source: 'c2', target: 'c3', weight: '2', last_interaction_at: 'not-a-date' },
    ]);

    const graph = await getCommunityDepthGraph('user-1');
    const organic = graph.links.filter(l => l.type === 'organic');

    expect(organic.map(l => l.active_recently)).toEqual([false, false, false]);
  });

  it('accepts ISO-string timestamps (pg drivers may return strings)', async () => {
    mockDepthGraphQueries([
      { source: 'c1', target: 'c2', weight: '3', last_interaction_at: daysAgo(3).toISOString() },
      { source: 'c1', target: 'c3', weight: '1', last_interaction_at: daysAgo(90).toISOString() },
    ]);

    const graph = await getCommunityDepthGraph('user-1');
    const organic = graph.links.filter(l => l.type === 'organic');

    expect(organic.map(l => l.active_recently)).toEqual([true, false]);
  });

  it('the organic query selects last_interaction_at from community_trust_edges', async () => {
    mockDepthGraphQueries([]);

    await getCommunityDepthGraph('user-1');

    // call order: [0] nodes, [1] organic, [2] fission
    const organicSql = pool.query.mock.calls[1][0] as string;
    expect(organicSql).toContain('last_interaction_at');
    expect(organicSql).toContain('community_trust_edges');
  });
});

describe('Sprint 119: ADR-082 — the raw timestamp never leaves the server', () => {
  it('organic links expose exactly source/target/weight/type/active_recently — no timestamp', async () => {
    mockDepthGraphQueries(
      [{ source: 'c1', target: 'c2', weight: '3', last_interaction_at: daysAgo(2) }],
      [{ parent: 'c1', child_a: 'c3', child_b: null }],
    );

    const graph = await getCommunityDepthGraph('user-1');
    const organic = graph.links.find(l => l.type === 'organic')!;

    expect(Object.keys(organic).sort()).toEqual(
      ['active_recently', 'source', 'target', 'type', 'weight'].sort(),
    );
    expect(Object.values(organic).some(v => v instanceof Date)).toBe(false);
    expect(JSON.stringify(graph)).not.toContain('last_interaction');
  });

  it('fission lineage links are untouched: no active_recently key, shape as shipped', async () => {
    mockDepthGraphQueries(
      [],
      [{ parent: 'c1', child_a: 'c3', child_b: null }],
    );

    const graph = await getCommunityDepthGraph('user-1');
    const fission = graph.links.find(l => l.type === 'fission')!;

    expect(fission).toEqual({ source: 'c1', target: 'c3', weight: 1, type: 'fission' });
    expect(Object.keys(fission)).not.toContain('active_recently');
  });
});
