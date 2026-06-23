import { describe, it, expect, jest, beforeEach } from '@jest/globals';

jest.mock('../../src/config/database', () => ({ pool: { query: jest.fn() } }));

import { pool } from '../../src/config/database';
import { getTrustNeighborhood } from '../../src/database/trustEdgeDb';
import { parseNeighborhoodDepth, resolveNeighborhoodScope } from '../../src/routes/trustGraph';

// Loosely typed: @jest/globals infers mock resolved-values as `never` otherwise.
const mockQuery = (pool as any).query;

/**
 * Sprint 111 — Belonging Graph System (ADR-081)
 *
 * Privacy-scoped recursive neighborhood read for the `/network` ego explorer:
 *   - traversal walks `trust_edges_live` ONLY inside allowed (shared-active) communities,
 *   - every node carries its shortest BFS `degrees_of_separation` (center = 0),
 *   - results are capped at `maxNodes` with `meta.truncated`,
 *   - depth validation + shared-community scope resolution gate the route before any traversal.
 *
 * pool is mocked, so the SQL never executes — the meaningful invariants are (a) the SQL the
 * helper emits (recursive, community-scoped, active-only, capped, min-depth) and (b) how it shapes
 * mocked rows into the canonical neighborhood payload.
 */
describe('sprint-111 privacy-scoped trust neighborhood', () => {
  beforeEach(() => {
    // mockReset (not clearAllMocks) so queued mockResolvedValueOnce values never leak between tests —
    // the helper issues a conditional second (links) query, so consumption counts vary per test.
    mockQuery.mockReset();
  });

  // getTrustNeighborhood runs the nodes (recursive) query first, then the links query.
  const nodeSqlOf = () => mockQuery.mock.calls[0][0] as string;
  const nodeParamsOf = () => mockQuery.mock.calls[0][1] as unknown[];
  const linkSqlOf = () => mockQuery.mock.calls[1][0] as string;

  describe('getTrustNeighborhood — recursive traversal contract', () => {
    it('returns center at depth 0 and the shortest depth for discovered nodes', async () => {
      mockQuery
        .mockResolvedValueOnce({
          rows: [
            { id: 'center', name: 'Me', trust_score: '0', karma: '0', degrees_of_separation: 0 },
            { id: 'peer-1', name: 'Peer One', trust_score: '2.5', karma: '4', degrees_of_separation: 1 },
          ],
        })
        .mockResolvedValueOnce({
          rows: [{ source: 'center', target: 'peer-1', raw_weight: '3', effective_weight: '2.5' }],
        });

      const result = await getTrustNeighborhood('center', ['c1', 'c2'], 2);

      expect(result).toEqual({
        nodes: expect.arrayContaining([
          expect.objectContaining({ id: 'center', degrees_of_separation: 0 }),
          expect.objectContaining({ id: 'peer-1', degrees_of_separation: 1 }),
        ]),
        links: expect.any(Array),
        meta: { depth: 2, truncated: false },
      });
      // Numeric fields are coerced from string rows.
      const peer = result.nodes.find(n => n.id === 'peer-1')!;
      expect(peer.trust_score).toBe(2.5);
      expect(peer.karma).toBe(4);
      expect(result.links[0]).toEqual({
        source: 'center',
        target: 'peer-1',
        raw_weight: 3,
        effective_weight: 2.5,
      });
    });

    it('emits a recursive, community-scoped, active-member, depth-bounded, min-depth query', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce({ rows: [] });

      await getTrustNeighborhood('center', ['c1'], 3);

      const sql = nodeSqlOf();
      expect(sql).toMatch(/RECURSIVE/i);
      expect(sql).toMatch(/trust_edges_live/);
      // The traversal is constrained to the allowed community array ($2) and active members only.
      expect(sql).toMatch(/= ANY\(\$2::uuid\[\]\)/);
      expect(sql).toMatch(/status = 'active'/);
      // Depth is bounded by the requested depth parameter.
      expect(sql).toMatch(/\$3/);
      // Each user collapses to its minimum (shortest) discovered depth.
      expect(sql).toMatch(/MIN\(/i);
    });

    it('passes [centerUserId, allowedCommunityIds, depth, maxNodes+1] to the nodes query', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce({ rows: [] });

      await getTrustNeighborhood('center', ['c1', 'c2'], 2, 80);

      const params = nodeParamsOf();
      expect(params[0]).toBe('center');
      expect(params[1]).toEqual(['c1', 'c2']);
      expect(params[2]).toBe(2);
      // Fetch one more than the cap so truncation can be detected.
      expect(params[3]).toBe(81);
    });

    it('caps at maxNodes and reports truncated=true when more rows are returned', async () => {
      const rows = Array.from({ length: 81 }, (_, i) => ({
        id: `u${i}`,
        name: `User ${i}`,
        trust_score: '0',
        karma: '0',
        degrees_of_separation: i === 0 ? 0 : 1,
      }));
      mockQuery.mockResolvedValueOnce({ rows }).mockResolvedValueOnce({ rows: [] });

      const result = await getTrustNeighborhood('u0', ['c1'], 2, 80);

      expect(result.nodes).toHaveLength(80);
      expect(result.meta.truncated).toBe(true);
    });

    it('fetches only links whose endpoints are in the retained node set', async () => {
      mockQuery
        .mockResolvedValueOnce({
          rows: [
            { id: 'center', name: 'Me', trust_score: '0', karma: '0', degrees_of_separation: 0 },
            { id: 'peer-1', name: 'Peer', trust_score: '0', karma: '0', degrees_of_separation: 1 },
          ],
        })
        .mockResolvedValueOnce({ rows: [] });

      await getTrustNeighborhood('center', ['c1'], 1);

      const linkSql = linkSqlOf();
      expect(linkSql).toMatch(/trust_edges_live/);
      // Both endpoints must be inside the retained node id set.
      expect(linkSql).toMatch(/user_id_a = ANY/);
      expect(linkSql).toMatch(/user_id_b = ANY/);
    });

    it('does not mark any node isCurrentUser (identity is applied by the route)', async () => {
      mockQuery
        .mockResolvedValueOnce({
          rows: [{ id: 'center', name: 'Me', trust_score: '0', karma: '0', degrees_of_separation: 0 }],
        })
        .mockResolvedValueOnce({ rows: [] });

      const result = await getTrustNeighborhood('center', ['c1'], 1);
      expect(result.nodes.every(n => !n.isCurrentUser)).toBe(true);
    });
  });

  describe('parseNeighborhoodDepth — depth validation', () => {
    it('defaults to 1 when absent', () => {
      expect(parseNeighborhoodDepth(undefined)).toBe(1);
    });

    it('accepts 1, 2, 3', () => {
      expect(parseNeighborhoodDepth('1')).toBe(1);
      expect(parseNeighborhoodDepth('2')).toBe(2);
      expect(parseNeighborhoodDepth('3')).toBe(3);
    });

    it('rejects out-of-range and non-numeric values', () => {
      expect(() => parseNeighborhoodDepth('0')).toThrow('depth must be between 1 and 3');
      expect(() => parseNeighborhoodDepth('4')).toThrow('depth must be between 1 and 3');
      expect(() => parseNeighborhoodDepth('abc')).toThrow('depth must be between 1 and 3');
    });
  });

  describe('resolveNeighborhoodScope — shared-community privacy gate', () => {
    it('explicit community: requires caller AND center active membership, returns [communityId]', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [{ ok: 1 }] });

      const scope = await resolveNeighborhoodScope('caller', 'center', 'comm-1');

      expect(scope).toEqual(['comm-1']);
      const sql = mockQuery.mock.calls[0][0] as string;
      expect(sql).toMatch(/communities\.members/);
      expect(sql).toMatch(/status = 'active'/);
      expect(mockQuery.mock.calls[0][1]).toEqual(['caller', 'center', 'comm-1']);
    });

    it('explicit community: returns null when membership is not shared', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });
      const scope = await resolveNeighborhoodScope('caller', 'center', 'comm-1');
      expect(scope).toBeNull();
    });

    it('aggregate: resolves the set of shared active communities', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [{ community_id: 'c1' }, { community_id: 'c2' }] });

      const scope = await resolveNeighborhoodScope('caller', 'center');

      expect(scope).toEqual(['c1', 'c2']);
      const sql = mockQuery.mock.calls[0][0] as string;
      expect(sql).toMatch(/JOIN communities\.members/);
      expect(sql).toMatch(/status = 'active'/);
      expect(mockQuery.mock.calls[0][1]).toEqual(['caller', 'center']);
    });

    it('aggregate: returns null when no community is shared (inaccessible center → 404)', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });
      const scope = await resolveNeighborhoodScope('caller', 'center');
      expect(scope).toBeNull();
    });
  });
});
