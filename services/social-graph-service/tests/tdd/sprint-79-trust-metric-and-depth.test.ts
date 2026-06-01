import { describe, it, expect, jest, beforeEach } from '@jest/globals';

jest.mock('../../src/config/database', () => ({ pool: { query: jest.fn() } }));

import { pool } from '../../src/config/database';
import {
  getTrustGraph,
  getTrustGraphAggregate,
  getTrustGraphAggregateForCenter,
  getCommunityDepthGraph,
} from '../../src/database/trustEdgeDb';

// Loosely typed: @jest/globals infers mock resolved-values as `never` otherwise.
const mockQuery = (pool as any).query;

/**
 * Sprint 79 — Trust Graph Viz Polish + Depth
 *
 * Two contracts under test:
 *  1. Node `trust_score` must be the DECAYED sum (SUM(current_weight) from the
 *     trust_edges_live view), NOT the raw sum (SUM(raw_weight) from trust_edges).
 *     The pool is mocked, so the SQL never executes — the meaningful invariant is
 *     the SQL the function emits for the node metric: it must aggregate the
 *     live/decayed source. Edges already use current_weight; only the node
 *     aggregate was wrong.
 *  2. getCommunityDepthGraph(userId) returns communities-as-nodes plus organic
 *     (undirected, from community_trust_edges) and fission (directed parent→child,
 *     from executed split_proposals) links, each tagged with `type`.
 */
describe('sprint-79 trust metric + community depth', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // The node-metric query is always the FIRST query issued (Promise.all evaluates
  // the nodes query before the edges query).
  const nodeSqlOf = () => mockQuery.mock.calls[0][0] as string;

  describe('decayed node metric (Phase 2)', () => {
    const decayedNodeRows = {
      // trust_score here is the decayed value the (real) SQL would return.
      rows: [{ id: 'u1', name: 'Alice', trust_score: '2.5', karma: '0', is_current_user: true }],
    };

    it('getTrustGraph aggregates the node trust_score from the decayed live view', async () => {
      mockQuery.mockResolvedValueOnce(decayedNodeRows).mockResolvedValueOnce({ rows: [] });

      const result = await getTrustGraph('c1', 'u1');

      const nodeSql = nodeSqlOf();
      expect(nodeSql).toMatch(/trust_edges_live/);
      expect(nodeSql).toMatch(/current_weight/);
      // The node trust_score must NOT be summed from raw_weight any more.
      expect(nodeSql).not.toMatch(/raw_weight/);

      // Decayed value passes through unchanged as a number.
      expect(result.nodes[0].trust_score).toBe(2.5);
    });

    it('getTrustGraphAggregate aggregates the node trust_score from the decayed live view', async () => {
      mockQuery.mockResolvedValueOnce(decayedNodeRows).mockResolvedValueOnce({ rows: [] });

      const result = await getTrustGraphAggregate('u1');

      const nodeSql = nodeSqlOf();
      expect(nodeSql).toMatch(/trust_edges_live/);
      expect(nodeSql).toMatch(/current_weight/);
      expect(nodeSql).not.toMatch(/raw_weight/);

      expect(result.nodes[0].trust_score).toBe(2.5);
    });

    it('getTrustGraphAggregateForCenter aggregates the node trust_score from the decayed live view', async () => {
      mockQuery.mockResolvedValueOnce(decayedNodeRows).mockResolvedValueOnce({ rows: [] });

      const result = await getTrustGraphAggregateForCenter('u1', 'center-1');

      const nodeSql = nodeSqlOf();
      expect(nodeSql).toMatch(/trust_edges_live/);
      expect(nodeSql).toMatch(/current_weight/);
      expect(nodeSql).not.toMatch(/raw_weight/);

      expect(result.nodes[0].trust_score).toBe(2.5);
    });
  });

  describe('getCommunityDepthGraph (Phase 3)', () => {
    it('returns the user communities as nodes with organic + fission links', async () => {
      mockQuery
        // Query 0: nodes (seed + edge-reachable communities)
        .mockResolvedValueOnce({
          rows: [
            { id: 'cA', name: 'Alpha', member_count: 10, status: 'active', is_member: true },
            { id: 'cB', name: 'Beta', member_count: 5, status: 'active', is_member: true },
            { id: 'cC', name: 'Gamma', member_count: 4, status: 'active', is_member: false },
          ],
        })
        // Query 1: organic edges
        .mockResolvedValueOnce({ rows: [{ source: 'cA', target: 'cB', weight: '3.5' }] })
        // Query 2: fission edges (executed split: parent cA → children cC and cZ)
        .mockResolvedValueOnce({ rows: [{ parent: 'cA', child_a: 'cC', child_b: 'cZ' }] });

      const result = await getCommunityDepthGraph('user-1');

      // Nodes: exact shape, member_count coerced to number, is_member boolean.
      expect(result.nodes).toHaveLength(3);
      expect(result.nodes[0]).toEqual({
        id: 'cA',
        name: 'Alpha',
        member_count: 10,
        status: 'active',
        is_member: true,
      });
      expect(result.nodes[2].is_member).toBe(false);

      // Organic link tagged 'organic', weight coerced to number.
      const organic = result.links.filter((l) => l.type === 'organic');
      expect(organic).toEqual([{ source: 'cA', target: 'cB', weight: 3.5, type: 'organic' }]);

      // Fission: directed parent→child, weight 1, type 'fission'. cZ is NOT in the
      // node set so the cA→cZ link is dropped; only cA→cC survives.
      const fission = result.links.filter((l) => l.type === 'fission');
      expect(fission).toEqual([{ source: 'cA', target: 'cC', weight: 1, type: 'fission' }]);

      // The node query must derive lineage from both edge sources.
      const nodeSql = mockQuery.mock.calls[0][0] as string;
      expect(nodeSql).toMatch(/communities\.communities/);
      expect(nodeSql).toMatch(/community_trust_edges/);
      expect(nodeSql).toMatch(/split_proposals/);

      // The fission query reads only executed splits.
      const fissionSql = mockQuery.mock.calls[2][0] as string;
      expect(fissionSql).toMatch(/communities\.split_proposals/);
      expect(fissionSql).toMatch(/'executed'/);
    });

    it('short-circuits to empty when the user has no active communities', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      const result = await getCommunityDepthGraph('lonely-user');

      expect(result).toEqual({ nodes: [], links: [] });
      // No link queries issued once the node set is empty.
      expect(mockQuery).toHaveBeenCalledTimes(1);
    });

    it('drops fission links whose child id is null', async () => {
      mockQuery
        .mockResolvedValueOnce({
          rows: [
            { id: 'cA', name: 'Alpha', member_count: 10, status: 'active', is_member: true },
            { id: 'cC', name: 'Gamma', member_count: 4, status: 'active', is_member: false },
          ],
        })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ parent: 'cA', child_a: 'cC', child_b: null }] });

      const result = await getCommunityDepthGraph('user-1');

      const fission = result.links.filter((l) => l.type === 'fission');
      expect(fission).toEqual([{ source: 'cA', target: 'cC', weight: 1, type: 'fission' }]);
    });
  });
});
