/** Sprint 116 — SQL boundary for platform-wide, active-identity relationship context. */
jest.mock('../../src/config/database', () => ({
  pool: { query: jest.fn() },
}));

import { pool } from '../../src/config/database';
import {
  getPlatformShortestPath,
  getPublicIdentities,
  getPublicOneHop,
  getVisibleCommunities,
} from '../../src/database/relationshipContextDb';

const query = pool.query as jest.Mock;
const A = '11111111-1111-1111-1111-111111111111';
const B = '22222222-2222-2222-2222-222222222222';
const C = '33333333-3333-3333-3333-333333333333';

beforeEach(() => query.mockReset());

it('reads one-hop topology from completed matches across the platform and bands rich inputs later', async () => {
  query.mockResolvedValue({
    rows: [{
      source_id: A,
      target_id: B,
      interaction_count: '4',
      current_weight: '1.25',
      disappearance_threshold: '0.5',
    }],
  });

  await expect(getPublicOneHop([A, B])).resolves.toEqual([{
    sourceId: A,
    targetId: B,
    interactionCount: 4,
    currentWeight: 1.25,
    disappearanceThreshold: 0.5,
  }]);
  const [sql, params] = query.mock.calls[0];
  expect(sql).toContain("m.status = 'completed'");
  expect(sql).toContain("communities.members");
  expect(sql).toContain("status = 'active'");
  expect(sql).toContain('social_graph.trust_edges_live');
  expect(sql).toContain('LEFT JOIN LATERAL');
  expect(sql).toContain('LIMIT 1');
  expect(sql).not.toMatch(/WHERE[^;]*community_id\s*=\s*\$\d/i);
  expect(params).toEqual([[A, B]]);
});

it('uses bounded canonical BFS so reciprocal calls choose the same platform path', async () => {
  query.mockResolvedValue({
    rows: [
      { source_id: A, target_id: C },
      { source_id: B, target_id: C },
    ],
  });

  await expect(getPlatformShortestPath([A, B], 6)).resolves.toEqual([A, C, B]);
  await expect(getPlatformShortestPath([B, A], 6)).resolves.toEqual([B, C, A]);
  const [sql, params] = query.mock.calls[0];
  expect(sql).not.toContain('WITH RECURSIVE');
  expect(sql).toContain("m.status = 'completed'");
  expect(sql).not.toContain('request_communities');
  expect(params).toEqual([]);
});

it('returns active identity and affiliation only, with no member metrics', async () => {
  query
    .mockResolvedValueOnce({ rows: [{ id: A, name: 'Asha' }] })
    .mockResolvedValueOnce({ rows: [{ user_id: A, id: B, name: 'Garden Circle' }] });

  await expect(getPublicIdentities([A])).resolves.toEqual([{ id: A, name: 'Asha' }]);
  await expect(getVisibleCommunities([A])).resolves.toEqual(
    new Map([[A, [{ id: B, name: 'Garden Circle' }]]]),
  );

  for (const [sql] of query.mock.calls) {
    expect(sql).toContain("m.status = 'active'");
    expect(sql).not.toMatch(/karma|trust_score|raw_weight|current_weight/i);
  }
});
