import { describe, it, expect, jest, beforeEach } from '@jest/globals';

jest.mock('../../src/config/database', () => ({ pool: { query: jest.fn() } }));

import { pool } from '../../src/config/database';
import { getFullCommunityGraph } from '../../src/database/trustEdgeDb';

// Loosely typed: @jest/globals infers mock resolved-values as `never` otherwise.
const mockQuery = (pool as any).query;

describe('Sprint 74: getFullCommunityGraph', () => {
  beforeEach(() => { jest.clearAllMocks(); });

  it('parses node and link rows into typed numbers and flags the current user', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [
        { id: 'ua', name: 'Alice', trust_score: '10', karma: '50', is_current_user: true, total_active_members: '2' },
        { id: 'ub', name: 'Bob',   trust_score: '8',  karma: '30', is_current_user: false, total_active_members: '2' },
      ] })
      .mockResolvedValueOnce({ rows: [
        { source: 'ua', target: 'ub', raw_weight: '5', effective_weight: '4.2' },
      ] });

    const result = await getFullCommunityGraph('comm-1', 'ua');

    expect(result.nodes).toHaveLength(2);
    // The caller's own node keeps its parsed reputation numbers...
    expect(result.nodes[0]).toEqual({ id: 'ua', name: 'Alice', trust_score: 10, karma: 50, isCurrentUser: true });
    // ...but another member's trust_score/karma are zeroed at the API boundary (Sprint 111 privacy).
    expect(result.nodes[1]).toEqual({ id: 'ub', name: 'Bob', trust_score: 0, karma: 0, isCurrentUser: false });
    expect(result.links).toHaveLength(1);
    expect(result.links[0]).toEqual({ source: 'ua', target: 'ub', raw_weight: 5, effective_weight: 4.2 });
    expect(result.meta).toEqual({ totalActiveMembers: 2, truncated: false });
  });

  it('coerces null/NaN weights to 0', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [
        { id: 'ua', name: 'Alice', trust_score: null, karma: null, is_current_user: false, total_active_members: '1' },
      ] })
      .mockResolvedValueOnce({ rows: [
        { source: 'ua', target: 'ub', raw_weight: null, effective_weight: null },
      ] });

    const result = await getFullCommunityGraph('comm-1', 'ua');

    expect(result.nodes[0].trust_score).toBe(0);
    expect(result.nodes[0].karma).toBe(0);
    expect(result.links[0].raw_weight).toBe(0);
    expect(result.links[0].effective_weight).toBe(0);
    expect(result.meta).toEqual({ totalActiveMembers: 1, truncated: false });
  });

  it('passes [communityId, callingUserId] to both the nodes and edges queries', async () => {
    mockQuery.mockResolvedValue({ rows: [] });

    await getFullCommunityGraph('comm-1', 'user-z');

    const calls = mockQuery.mock.calls;
    expect(calls).toHaveLength(2);
    expect(calls[0][1]).toEqual(['comm-1', 'user-z']);
    expect(calls[1][1]).toEqual(['comm-1', 'user-z']);
  });

  it('selects by normalized name/id and always includes the active calling user via UNION', async () => {
    mockQuery.mockResolvedValue({ rows: [] });

    await getFullCommunityGraph('comm-1', 'user-z');

    const nodesSql = mockQuery.mock.calls[0][0] as string;
    expect(nodesSql).toContain('LOWER(BTRIM(u.name))');
    expect(nodesSql).toMatch(/ORDER BY[\s\S]*normalized_name[\s\S]*user_id/);
    expect(nodesSql).toMatch(/LIMIT 149/);
    expect(nodesSql).toMatch(/UNION/);
    expect(nodesSql).toContain('$2::uuid');
    expect(nodesSql).not.toMatch(/ORDER BY\s+trust_score/i);
  });
});
