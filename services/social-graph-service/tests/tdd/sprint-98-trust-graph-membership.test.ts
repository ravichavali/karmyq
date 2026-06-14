/**
 * Sprint 98 — Trust graph active-membership invariants (BUG-098-003)
 *
 * Audit finding: 325 trust edges have endpoints that are NOT active members of the
 * edge community (a user completed an exchange, a trust edge was written, then they
 * left the community). Community-scoped graph surfaces claim "your network in this
 * community" / "people in your communities", so their nodes and links must be backed
 * by active communities.members rows.
 *
 * Invariants:
 *  - Ego graph (getTrustGraph): neighbor nodes must be active members of the requested community.
 *  - Full community graph (getFullCommunityGraph): nodes are active members only (already enforced).
 *  - Aggregate graph (getTrustGraphAggregate): neighbor nodes must be active members of a
 *    community the caller is also active in.
 *  - Node trust_score and link effective_weight read decayed current_weight from trust_edges_live.
 */
import { describe, it, expect, jest, beforeEach } from '@jest/globals';

jest.mock('../../src/config/database', () => ({ pool: { query: jest.fn() } }));

import { pool } from '../../src/config/database';
import {
  getTrustGraph,
  getFullCommunityGraph,
  getTrustGraphAggregate,
} from '../../src/database/trustEdgeDb';

const mockQuery = (pool as any).query;

describe('Sprint 98: trust graph active-membership invariants', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockQuery.mockResolvedValue({ rows: [] });
  });

  describe('ego graph (getTrustGraph)', () => {
    it('restricts neighbors to active members of the requested community', async () => {
      await getTrustGraph('comm-1', 'user-z');
      const [nodesSql, edgesSql] = [
        mockQuery.mock.calls[0][0] as string,
        mockQuery.mock.calls[1][0] as string,
      ];
      // Both queries embed the neighbor CTE — it must prove active membership.
      for (const sql of [nodesSql, edgesSql]) {
        expect(sql).toContain('communities.members');
        expect(sql).toMatch(/status\s*=\s*'active'/);
        expect(sql).toContain('active_neighbors');
      }
    });

    it('every link connects two nodes in the resolved (active) node set', async () => {
      await getTrustGraph('comm-1', 'user-z');
      const edgesSql = mockQuery.mock.calls[1][0] as string;
      // Both endpoints must be constrained to the node set (caller ∪ active neighbors),
      // so a caller↔departed-member edge cannot dangle.
      expect(edgesSql).toMatch(/user_id_a\s+IN/i);
      expect(edgesSql).toMatch(/user_id_b\s+IN/i);
    });

    it('reads decayed current_weight from trust_edges_live for scores and links', async () => {
      await getTrustGraph('comm-1', 'user-z');
      const [nodesSql, edgesSql] = [
        mockQuery.mock.calls[0][0] as string,
        mockQuery.mock.calls[1][0] as string,
      ];
      expect(nodesSql).toContain('trust_edges_live');
      expect(nodesSql).toContain('current_weight');
      expect(edgesSql).toContain('trust_edges_live');
      expect(edgesSql).toContain('current_weight');
    });
  });

  describe('full community graph (getFullCommunityGraph)', () => {
    it('builds nodes from active members only', async () => {
      await getFullCommunityGraph('comm-1', 'user-z');
      const nodesSql = mockQuery.mock.calls[0][0] as string;
      expect(nodesSql).toContain('communities.members');
      expect(nodesSql).toMatch(/status\s*=\s*'active'/);
    });
  });

  describe('aggregate graph (getTrustGraphAggregate)', () => {
    it('restricts neighbors to active members of the caller\'s communities', async () => {
      await getTrustGraphAggregate('user-z');
      const [nodesSql, edgesSql] = [
        mockQuery.mock.calls[0][0] as string,
        mockQuery.mock.calls[1][0] as string,
      ];
      for (const sql of [nodesSql, edgesSql]) {
        expect(sql).toContain('communities.members');
        expect(sql).toMatch(/status\s*=\s*'active'/);
        expect(sql).toContain('active_neighbors');
      }
    });

    it('reads decayed current_weight from trust_edges_live', async () => {
      await getTrustGraphAggregate('user-z');
      const nodesSql = mockQuery.mock.calls[0][0] as string;
      expect(nodesSql).toContain('trust_edges_live');
      expect(nodesSql).toContain('current_weight');
    });
  });

  describe('row parsing (ego)', () => {
    it('coerces weights/karma to numbers and flags the current user', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [
          { id: 'user-z', name: 'Zoe', trust_score: '12', karma: '40', is_current_user: true },
          { id: 'ub', name: 'Bob', trust_score: null, karma: null, is_current_user: false },
        ] })
        .mockResolvedValueOnce({ rows: [
          { source: 'user-z', target: 'ub', raw_weight: '5', effective_weight: '4.1' },
        ] });
      const result = await getTrustGraph('comm-1', 'user-z');
      expect(result.nodes[0]).toEqual({ id: 'user-z', name: 'Zoe', trust_score: 12, karma: 40, isCurrentUser: true });
      expect(result.nodes[1].trust_score).toBe(0);
      expect(result.links[0]).toEqual({ source: 'user-z', target: 'ub', raw_weight: 5, effective_weight: 4.1 });
    });
  });
});
