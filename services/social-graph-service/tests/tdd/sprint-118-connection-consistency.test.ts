/**
 * Sprint 118 / BUG-028 — the connection derivation and the belonging graph must agree.
 *
 * The bug: `computeShortestPath` BFS-walked ALL-TIME completed `requests.matches` (no decay, no
 * liveness, no membership filter) while the graph discloses only `social_graph.trust_edges_live`
 * with active-membership joins — so the badge said "Direct connection" for pairs the graph shows
 * nothing for (742 of 2103 completed-match pairs on the curated demo had no trust edge at all).
 *
 * The invariant: any pair the connection derivation reports as connected via the exchange path
 * must be substantiated by the SAME edge set the graph discloses — `trust_edges_live`, both
 * endpoints active members of the edge's community, both directions. Platform-wide topology
 * (union across communities) is preserved per ADR-077.
 *
 * Mocked-pool unit style, matching tests/regression/pathComputation-exchange-graph.test.ts.
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

describe('Sprint 118 / BUG-028: exchange-path adjacency = the edge set the graph discloses', () => {
  const communityId = 'community-123';

  beforeEach(() => {
    // mockReset (not clearAllMocks): unconsumed mockResolvedValueOnce entries must not leak
    // between tests — a returned-early call chain leaves its queue behind otherwise.
    pool.query.mockReset();
  });

  function mockAdjacency(rows: Array<{ user_a: string; user_b: string }>) {
    pool.query.mockResolvedValueOnce({ rows });
  }

  function mockUserDetails(users: Array<{ id: string; name: string }>) {
    pool.query.mockResolvedValueOnce({ rows: users });
  }

  it('builds adjacency from trust_edges_live, not raw completed matches or invitations', async () => {
    mockAdjacency([{ user_a: 'user-a', user_b: 'user-b' }]);
    mockUserDetails([
      { id: 'user-a', name: 'Alice' },
      { id: 'user-b', name: 'Bob' },
    ]);
    pool.query.mockResolvedValue({ rows: [] }); // exchanged_at metadata lookups

    const result = await computeShortestPath('user-a', 'user-b', communityId);

    expect(result).not.toBeNull();
    expect(result?.degrees).toBe(1);

    const adjacencySql = pool.query.mock.calls[0][0] as string;
    // Same source table the neighborhood graph discloses (decay-adjusted live view)
    expect(adjacencySql).toContain('social_graph.trust_edges_live');
    // NOT the all-time match history and NOT invitation links
    expect(adjacencySql).not.toContain('requests.matches');
    expect(adjacencySql).not.toContain('user_invitations');
  });

  it('adjacency requires BOTH endpoints to be active members of the edge community (graph parity)', async () => {
    mockAdjacency([]);

    await computeShortestPath('user-a', 'user-b', communityId);

    const adjacencySql = pool.query.mock.calls[0][0] as string;
    // Same active-membership contract as getTrustNeighborhood's links query
    expect(adjacencySql).toContain('communities.members');
    expect(adjacencySql).toContain(`'active'`);
    // Both endpoints joined (two membership joins)
    const memberJoinCount = (adjacencySql.match(/communities\.members/g) || []).length;
    expect(memberJoinCount).toBeGreaterThanOrEqual(2);
  });

  it('stays platform-wide: no community_id parameter on the adjacency query (ADR-077)', async () => {
    mockAdjacency([]);

    await computeShortestPath('user-a', 'user-b', communityId);

    const adjacencyArgs = (pool.query.mock.calls[0][1] ?? []) as unknown[];
    expect(adjacencyArgs).not.toContain(communityId);
  });

  it('is bidirectional: normalized (a<b) edge rows connect the pair queried in either direction', async () => {
    // trust_edges rows are stored normalized user_id_a < user_id_b; querying from the "b" side
    // must still find the 1° connection.
    mockAdjacency([{ user_a: 'alice', user_b: 'zed' }]);
    mockUserDetails([
      { id: 'zed', name: 'Zed' },
      { id: 'alice', name: 'Alice' },
    ]);
    pool.query.mockResolvedValue({ rows: [] });

    const result = await computeShortestPath('zed', 'alice', communityId);

    expect(result).not.toBeNull();
    expect(result?.degrees).toBe(1);
    expect(result?.userIds).toEqual(['zed', 'alice']);
  });

  it('finds a full 3-degree path (depth gate must not swallow the target at MAX_DEPTH)', async () => {
    // a — b — c — d is exactly 3°; the pre-fix BFS skipped the target when it popped at
    // distance === MAX_DEPTH, so 3° paths silently returned null.
    mockAdjacency([
      { user_a: 'a', user_b: 'b' },
      { user_a: 'b', user_b: 'c' },
      { user_a: 'c', user_b: 'd' },
    ]);
    mockUserDetails([
      { id: 'a', name: 'A' },
      { id: 'b', name: 'B' },
      { id: 'c', name: 'C' },
      { id: 'd', name: 'D' },
    ]);
    pool.query.mockResolvedValue({ rows: [] });

    const result = await computeShortestPath('a', 'd', communityId);

    expect(result).not.toBeNull();
    expect(result?.degrees).toBe(3);
    expect(result?.userIds).toEqual(['a', 'b', 'c', 'd']);
  });

  it('returns null beyond 3 degrees (a — b — c — d — e is 4°)', async () => {
    mockAdjacency([
      { user_a: 'a', user_b: 'b' },
      { user_a: 'b', user_b: 'c' },
      { user_a: 'c', user_b: 'd' },
      { user_a: 'd', user_b: 'e' },
    ]);

    const result = await computeShortestPath('a', 'e', communityId);

    expect(result).toBeNull();
  });

  it('returns null when the pair has no live-edge path (a completed match alone is not a connection)', async () => {
    // The adjacency now comes from trust_edges_live: a pair whose only history is a raw
    // completed match with no (or a swept) trust edge yields NO adjacency row → no path.
    mockAdjacency([{ user_a: 'alice', user_b: 'charlie' }]); // unrelated live edge

    const result = await computeShortestPath('alice', 'bob', communityId);

    expect(result).toBeNull();
  });

  it('deduplicates a multi-community pair to a single hop', async () => {
    // A pair with live edges in two communities appears once in the adjacency (DISTINCT) —
    // and even if the driver returns duplicate rows, BFS must still see one 1° hop.
    mockAdjacency([
      { user_a: 'a', user_b: 'b' },
      { user_a: 'a', user_b: 'b' },
    ]);
    mockUserDetails([
      { id: 'a', name: 'A' },
      { id: 'b', name: 'B' },
    ]);
    pool.query.mockResolvedValue({ rows: [] });

    const result = await computeShortestPath('a', 'b', communityId);

    expect(result).not.toBeNull();
    expect(result?.degrees).toBe(1);
    const adjacencySql = pool.query.mock.calls[0][0] as string;
    expect(adjacencySql).toContain('DISTINCT');
  });
});
