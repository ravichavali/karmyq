/**
 * TDD tests for the trust-path adjacency graph in pathComputation.ts
 *
 * Trust paths are built from LIVE trust edges (social_graph.trust_edges_live — the same
 * decay-adjusted edge set the belonging graph discloses; Sprint 118 / BUG-028),
 * NOT from invitation links (auth.user_invitations).
 *
 * Graph edges: user_id_a <-> user_id_b for each live trust edge with both endpoints
 * active members of the edge's community
 * Graph scope: platform-wide (not community-scoped) — ADR-077
 */

jest.mock('../../src/config/database', () => ({
  pool: {
    query: jest.fn(),
  },
}));

jest.mock('../../src/config/logger', () => ({
  logger: {
    info: jest.fn(),
    debug: jest.fn(),
    error: jest.fn(),
  },
}));

const { pool } = require('../../src/config/database');
import { computeShortestPath } from '../../src/services/pathComputation';

describe('pathComputation - exchange-based trust graph', () => {
  const communityId = 'community-123';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('builds graph from live trust edges, not invitations', async () => {
    // Two users connected by a live trust edge (user-a helped user-b)
    pool.query
      .mockResolvedValueOnce({
        rows: [{ user_a: 'user-a', user_b: 'user-b' }], // live-edge adjacency
      })
      .mockResolvedValueOnce({
        rows: [
          { id: 'user-a', name: 'Alice', karma: 50 },
          { id: 'user-b', name: 'Bob', karma: 40 },
        ],
      })
      .mockResolvedValueOnce({ rows: [] }); // exchanged_at lookup

    const result = await computeShortestPath('user-a', 'user-b', communityId);

    expect(result).not.toBeNull();
    expect(result?.degrees).toBe(1);

    // The adjacency must come from the graph's edge set and NOT auth.user_invitations
    const firstCallSql = pool.query.mock.calls[0][0] as string;
    expect(firstCallSql).toContain('social_graph.trust_edges_live');
    expect(firstCallSql).not.toContain('user_invitations');
  });

  it('finds 2-degree path through a mutual exchange partner', async () => {
    // Admin exchanged with both Alice and Bob → path: Alice → Admin → Bob
    pool.query
      .mockResolvedValueOnce({
        rows: [
          { user_a: 'alice', user_b: 'admin' },
          { user_a: 'admin', user_b: 'bob' },
        ],
      })
      .mockResolvedValueOnce({
        rows: [
          { id: 'alice', name: 'Alice', karma: 30 },
          { id: 'admin', name: 'Admin User', karma: 200 },
          { id: 'bob', name: 'Bob', karma: 25 },
        ],
      })
      .mockResolvedValueOnce({ rows: [] }) // exchanged_at lookup for alice→admin edge
      .mockResolvedValueOnce({ rows: [] }); // exchanged_at lookup for admin→bob edge

    const result = await computeShortestPath('alice', 'bob', communityId);

    expect(result).not.toBeNull();
    expect(result?.degrees).toBe(2);
    expect(result?.userIds).toEqual(['alice', 'admin', 'bob']);
  });

  it('returns null when no exchange path exists', async () => {
    // Two isolated users — no shared exchange history
    pool.query.mockResolvedValueOnce({
      rows: [{ user_a: 'alice', user_b: 'charlie' }], // unrelated exchange
    });

    const result = await computeShortestPath('alice', 'bob', communityId);

    expect(result).toBeNull();
  });

  it('graph query does not filter by community_id', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });

    await computeShortestPath('user-a', 'user-b', communityId);

    // The graph query should NOT include community_id as a parameter
    // (exchange-based trust is platform-wide, not community-scoped)
    const firstCallArgs = pool.query.mock.calls[0][1] as unknown[];
    expect(firstCallArgs).not.toContain(communityId);
  });
});
