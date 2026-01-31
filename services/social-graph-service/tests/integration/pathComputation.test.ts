import { Pool } from 'pg';
import { computeShortestPath, TrustPath } from '../src/services/pathComputation';

// Mock the pool
jest.mock('../src/index', () => ({
  pool: {
    query: jest.fn(),
  },
}));

const { pool } = require('../src/index');

describe('Path Computation - BFS Algorithm', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('computeShortestPath', () => {
    const communityId = 'community-123';

    it('should find 1-degree connection (direct invite)', async () => {
      // Mock invitation graph: A -> B
      pool.query.mockResolvedValueOnce({
        rows: [
          { inviter_id: 'user-a', invitee_id: 'user-b' },
        ],
      });

      // Mock user details
      pool.query.mockResolvedValueOnce({
        rows: [
          { id: 'user-a', name: 'Alice' },
          { id: 'user-b', name: 'Bob' },
        ],
      });

      const result = await computeShortestPath('user-a', 'user-b', communityId);

      expect(result).not.toBeNull();
      expect(result?.degrees).toBe(1);
      expect(result?.path).toEqual([
        { id: 'user-a', name: 'Alice' },
        { id: 'user-b', name: 'Bob' },
      ]);
      expect(result?.userIds).toEqual(['user-a', 'user-b']);
    });

    it('should find 2-degree connection (friend of friend)', async () => {
      // Mock invitation graph: A -> B -> C
      pool.query.mockResolvedValueOnce({
        rows: [
          { inviter_id: 'user-a', invitee_id: 'user-b' },
          { inviter_id: 'user-b', invitee_id: 'user-c' },
        ],
      });

      // Mock user details
      pool.query.mockResolvedValueOnce({
        rows: [
          { id: 'user-a', name: 'Alice' },
          { id: 'user-b', name: 'Bob' },
          { id: 'user-c', name: 'Charlie' },
        ],
      });

      const result = await computeShortestPath('user-a', 'user-c', communityId);

      expect(result).not.toBeNull();
      expect(result?.degrees).toBe(2);
      expect(result?.path).toHaveLength(3);
      expect(result?.userIds).toEqual(['user-a', 'user-b', 'user-c']);
    });

    it('should find 3-degree connection', async () => {
      // Mock invitation graph: A -> B -> C -> D
      pool.query.mockResolvedValueOnce({
        rows: [
          { inviter_id: 'user-a', invitee_id: 'user-b' },
          { inviter_id: 'user-b', invitee_id: 'user-c' },
          { inviter_id: 'user-c', invitee_id: 'user-d' },
        ],
      });

      // Mock user details
      pool.query.mockResolvedValueOnce({
        rows: [
          { id: 'user-a', name: 'Alice' },
          { id: 'user-b', name: 'Bob' },
          { id: 'user-c', name: 'Charlie' },
          { id: 'user-d', name: 'Dave' },
        ],
      });

      const result = await computeShortestPath('user-a', 'user-d', communityId);

      expect(result).not.toBeNull();
      expect(result?.degrees).toBe(3);
      expect(result?.userIds).toEqual(['user-a', 'user-b', 'user-c', 'user-d']);
    });

    it('should return null for connections beyond 4 degrees', async () => {
      // Mock invitation graph: A -> B -> C -> D -> E -> F (5 degrees)
      pool.query.mockResolvedValueOnce({
        rows: [
          { inviter_id: 'user-a', invitee_id: 'user-b' },
          { inviter_id: 'user-b', invitee_id: 'user-c' },
          { inviter_id: 'user-c', invitee_id: 'user-d' },
          { inviter_id: 'user-d', invitee_id: 'user-e' },
          { inviter_id: 'user-e', invitee_id: 'user-f' },
        ],
      });

      const result = await computeShortestPath('user-a', 'user-f', communityId);

      expect(result).toBeNull();
    });

    it('should return null when no connection exists', async () => {
      // Mock invitation graph with two disconnected components
      pool.query.mockResolvedValueOnce({
        rows: [
          { inviter_id: 'user-a', invitee_id: 'user-b' },
          { inviter_id: 'user-c', invitee_id: 'user-d' },
        ],
      });

      const result = await computeShortestPath('user-a', 'user-d', communityId);

      expect(result).toBeNull();
    });

    it('should find shortest path in complex graph', async () => {
      // Mock invitation graph with multiple paths:
      // A -> B -> C -> D (3 degrees)
      // A -> E -> D (2 degrees) <- Should choose this one
      pool.query.mockResolvedValueOnce({
        rows: [
          { inviter_id: 'user-a', invitee_id: 'user-b' },
          { inviter_id: 'user-b', invitee_id: 'user-c' },
          { inviter_id: 'user-c', invitee_id: 'user-d' },
          { inviter_id: 'user-a', invitee_id: 'user-e' },
          { inviter_id: 'user-e', invitee_id: 'user-d' },
        ],
      });

      // Mock user details
      pool.query.mockResolvedValueOnce({
        rows: [
          { id: 'user-a', name: 'Alice' },
          { id: 'user-e', name: 'Eve' },
          { id: 'user-d', name: 'Dave' },
        ],
      });

      const result = await computeShortestPath('user-a', 'user-d', communityId);

      expect(result).not.toBeNull();
      expect(result?.degrees).toBe(2);
      expect(result?.userIds).toEqual(['user-a', 'user-e', 'user-d']);
    });

    it('should handle bidirectional edges correctly', async () => {
      // Mock invitation graph: A invited B, but path can go both ways
      pool.query.mockResolvedValueOnce({
        rows: [
          { inviter_id: 'user-a', invitee_id: 'user-b' },
          { inviter_id: 'user-b', invitee_id: 'user-c' },
        ],
      });

      // Mock user details
      pool.query.mockResolvedValueOnce({
        rows: [
          { id: 'user-c', name: 'Charlie' },
          { id: 'user-b', name: 'Bob' },
          { id: 'user-a', name: 'Alice' },
        ],
      });

      // Should find path from C back to A
      const result = await computeShortestPath('user-c', 'user-a', communityId);

      expect(result).not.toBeNull();
      expect(result?.degrees).toBe(2);
    });

    it('should calculate trust score based on karma', async () => {
      // Mock invitation graph: A -> B
      pool.query.mockResolvedValueOnce({
        rows: [
          { inviter_id: 'user-a', invitee_id: 'user-b' },
        ],
      });

      // Mock user details with karma
      pool.query.mockResolvedValueOnce({
        rows: [
          { id: 'user-a', name: 'Alice', karma: 100 },
          { id: 'user-b', name: 'Bob', karma: 80 },
        ],
      });

      const result = await computeShortestPath('user-a', 'user-b', communityId);

      expect(result).not.toBeNull();
      expect(result?.trustScore).toBeGreaterThan(0);
      expect(result?.trustScore).toBeLessThanOrEqual(100);
    });

    it('should filter by community_id', async () => {
      const mockQuery = pool.query as jest.Mock;

      pool.query.mockResolvedValueOnce({ rows: [] });

      await computeShortestPath('user-a', 'user-b', 'community-xyz');

      // Verify that community_id is used in the query
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('community_id'),
        expect.arrayContaining(['community-xyz'])
      );
    });
  });
});
