import request from 'supertest';
import express from 'express';
import pathRoutes from '../src/routes/paths';
import * as pathComputation from '../src/services/pathComputation';

// Mock dependencies
jest.mock('../src/index', () => ({
  pool: {
    query: jest.fn(),
  },
}));

jest.mock('../src/config/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
  },
}));

jest.mock('../src/services/pathComputation');

const { pool } = require('../src/index');

// Create test app
const app = express();
app.use(express.json());

// Mock auth middleware
app.use((req: any, res, next) => {
  req.user = {
    userId: 'current-user-123',
    currentCommunityId: 'test-community-123',
  };
  req.headers['x-community-id'] = 'test-community-123';
  next();
});

app.use('/paths', pathRoutes);

describe('Path Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /paths/:targetUserId', () => {
    const targetUserId = 'target-user-456';

    it('should return cached path if available', async () => {
      // Mock cached path
      pool.query.mockResolvedValueOnce({
        rows: [
          {
            degrees_of_separation: 2,
            shortest_path: ['current-user-123', 'middle-user-789', 'target-user-456'],
            path_trust_score: 85,
            computed_at: new Date().toISOString(),
          },
        ],
      });

      const response = await request(app)
        .get(`/paths/${targetUserId}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.degrees_of_separation).toBe(2);
      expect(response.body.data.cached).toBe(true);
      expect(response.body.data.trust_score).toBe(85);
    });

    it('should compute and cache path if not cached', async () => {
      // Mock empty cache
      pool.query.mockResolvedValueOnce({ rows: [] });

      // Mock path computation
      const mockPath = {
        degrees: 2,
        userIds: ['current-user-123', 'middle-user-789', 'target-user-456'],
        path: [
          { id: 'current-user-123', name: 'You' },
          { id: 'middle-user-789', name: 'Middle User' },
          { id: 'target-user-456', name: 'Target User' },
        ],
        trustScore: 85,
      };
      (pathComputation.computeShortestPath as jest.Mock).mockResolvedValueOnce(mockPath);

      // Mock cache insert
      pool.query.mockResolvedValueOnce({ rows: [] });

      const response = await request(app)
        .get(`/paths/${targetUserId}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.degrees_of_separation).toBe(2);
      expect(response.body.data.cached).toBe(false);
      expect(response.body.data.path).toHaveLength(3);

      // Verify path was cached
      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO auth.social_distances'),
        expect.any(Array)
      );
    });

    it('should return 400 when trying to find path to self', async () => {
      const response = await request(app)
        .get('/paths/current-user-123')
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Cannot compute path to yourself');
    });

    it('should return null for unconnected users', async () => {
      // Mock empty cache
      pool.query.mockResolvedValueOnce({ rows: [] });

      // Mock path computation returns null (no path)
      (pathComputation.computeShortestPath as jest.Mock).mockResolvedValueOnce(null);

      const response = await request(app)
        .get(`/paths/${targetUserId}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.degrees_of_separation).toBeNull();
      expect(response.body.data.path).toBeNull();
      expect(response.body.data.message).toContain('No connection found');
    });

    it('should handle database errors gracefully', async () => {
      pool.query.mockRejectedValueOnce(new Error('Database connection failed'));

      const response = await request(app)
        .get(`/paths/${targetUserId}`)
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Failed to compute path');
    });

    it('should use community context from header', async () => {
      pool.query.mockResolvedValueOnce({ rows: [] });
      (pathComputation.computeShortestPath as jest.Mock).mockResolvedValueOnce(null);

      await request(app)
        .get(`/paths/${targetUserId}`)
        .set('x-community-id', 'different-community-456')
        .expect(200);

      // Verify community ID was used in cache query
      expect(pool.query).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining(['current-user-123', targetUserId, 'different-community-456'])
      );
    });
  });

  describe('POST /paths/batch', () => {
    it('should return paths for multiple users', async () => {
      const targetUserIds = ['user-1', 'user-2', 'user-3'];

      // Mock cache query - user-1 and user-2 are cached, user-3 is not
      pool.query.mockResolvedValueOnce({
        rows: [
          {
            user_b_id: 'user-1',
            degrees_of_separation: 1,
            shortest_path: ['current-user-123', 'user-1'],
            path_trust_score: 90,
          },
          {
            user_b_id: 'user-2',
            degrees_of_separation: 2,
            shortest_path: ['current-user-123', 'middle-user', 'user-2'],
            path_trust_score: 75,
          },
        ],
      });

      // Mock path computation for user-3
      const mockPath = {
        degrees: 3,
        userIds: ['current-user-123', 'user-a', 'user-b', 'user-3'],
        trustScore: 60,
      };
      (pathComputation.computeShortestPath as jest.Mock).mockResolvedValueOnce(mockPath);

      // Mock cache insert for user-3
      pool.query.mockResolvedValueOnce({ rows: [] });

      const response = await request(app)
        .post('/paths/batch')
        .send({ target_user_ids: targetUserIds })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(3);

      // Check cached results
      expect(response.body.data[0].target_user_id).toBe('user-1');
      expect(response.body.data[0].cached).toBe(true);
      expect(response.body.data[1].target_user_id).toBe('user-2');
      expect(response.body.data[1].cached).toBe(true);

      // Check computed result
      expect(response.body.data[2].target_user_id).toBe('user-3');
      expect(response.body.data[2].cached).toBe(false);
      expect(response.body.data[2].degrees_of_separation).toBe(3);
    });

    it('should limit to 50 users', async () => {
      const targetUserIds = Array.from({ length: 100 }, (_, i) => `user-${i}`);

      pool.query.mockResolvedValueOnce({ rows: [] });

      await request(app)
        .post('/paths/batch')
        .send({ target_user_ids: targetUserIds })
        .expect(200);

      // Verify cache query only used first 50
      expect(pool.query).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining([
          'current-user-123',
          expect.arrayContaining(targetUserIds.slice(0, 50)),
          'test-community-123',
        ])
      );
    });

    it('should skip current user in batch results', async () => {
      const targetUserIds = ['current-user-123', 'user-1', 'user-2'];

      pool.query.mockResolvedValueOnce({
        rows: [
          {
            user_b_id: 'user-1',
            degrees_of_separation: 1,
            shortest_path: ['current-user-123', 'user-1'],
            path_trust_score: 90,
          },
        ],
      });

      (pathComputation.computeShortestPath as jest.Mock).mockResolvedValueOnce({
        degrees: 2,
        userIds: ['current-user-123', 'middle', 'user-2'],
        trustScore: 80,
      });

      pool.query.mockResolvedValueOnce({ rows: [] });

      const response = await request(app)
        .post('/paths/batch')
        .send({ target_user_ids: targetUserIds })
        .expect(200);

      expect(response.body.success).toBe(true);
      // Should only have user-1 and user-2, not current-user-123
      expect(response.body.data).toHaveLength(2);
      expect(response.body.data.find((r: any) => r.target_user_id === 'current-user-123')).toBeUndefined();
    });

    it('should handle users with no path', async () => {
      pool.query.mockResolvedValueOnce({ rows: [] });

      // Mock path computation returns null (no path)
      (pathComputation.computeShortestPath as jest.Mock).mockResolvedValueOnce(null);

      const response = await request(app)
        .post('/paths/batch')
        .send({ target_user_ids: ['unconnected-user'] })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].degrees_of_separation).toBeNull();
      expect(response.body.data[0].trust_score).toBe(0);
    });

    it('should return 400 for invalid input', async () => {
      const response = await request(app)
        .post('/paths/batch')
        .send({ target_user_ids: 'not-an-array' })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('target_user_ids array required');
    });

    it('should return 400 for empty array', async () => {
      const response = await request(app)
        .post('/paths/batch')
        .send({ target_user_ids: [] })
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });
});
