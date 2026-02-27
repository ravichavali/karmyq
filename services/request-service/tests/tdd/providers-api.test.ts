/**
 * TDD Tests: Provider Profiles API (ADR-041)
 *
 * Tests CRUD behavior for /requests/providers endpoints.
 * DB interactions are mocked.
 */

import request from 'supertest';
import express from 'express';
import jwt from 'jsonwebtoken';

// Mock the database module
jest.mock('../../src/database/db', () => ({
  query: jest.fn(),
}));

import { query } from '../../src/database/db';
const mockQuery = query as jest.Mock;

// Minimal app with just the providers router
function buildApp() {
  const app = express();
  app.use(express.json());
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const providersRouter = require('../../src/routes/providers').default;
  app.use('/providers', providersRouter);
  return app;
}

const JWT_SECRET = 'test-secret';

function makeToken(userId = 'user-123') {
  return jwt.sign({ userId, email: 'test@test.com', communities: [] }, JWT_SECRET);
}

describe('Provider Profiles API (TDD)', () => {
  let app: express.Express;

  beforeAll(() => {
    process.env.JWT_SECRET = JWT_SECRET;
    app = buildApp();
  });

  afterEach(() => {
    mockQuery.mockReset();
  });

  describe('GET /providers', () => {
    it('returns provider list without auth', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [
        { id: 'p1', display_name: 'Ali Rickshaw', service_type: 'ride', trust_score: 80 }
      ]});

      const res = await request(app).get('/providers');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].display_name).toBe('Ali Rickshaw');
    });

    it('filters by service_type', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      await request(app).get('/providers?service_type=tutor');
      const callArgs = mockQuery.mock.calls[0][0] as string;
      expect(callArgs).toContain('pp.service_type = $');
    });
  });

  describe('GET /providers/:providerId', () => {
    it('returns 404 when provider not found', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      const res = await request(app).get('/providers/nonexistent-id');
      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });

    it('returns provider with ride details when found', async () => {
      const provider = {
        id: 'p1', display_name: 'Ali', service_type: 'ride',
        vehicle_type: 'rickshaw', max_passengers: 2
      };
      mockQuery.mockResolvedValueOnce({ rows: [provider] });

      const res = await request(app).get('/providers/p1');
      expect(res.status).toBe(200);
      expect(res.body.data.vehicle_type).toBe('rickshaw');
    });
  });

  describe('POST /providers', () => {
    it('returns 401 without auth token', async () => {
      const res = await request(app)
        .post('/providers')
        .send({ service_type: 'ride', display_name: 'Ali' });
      expect(res.status).toBe(401);
    });

    it('returns 400 when required fields missing', async () => {
      const res = await request(app)
        .post('/providers')
        .set('Authorization', `Bearer ${makeToken()}`)
        .send({ service_type: 'ride' }); // missing display_name

      expect(res.status).toBe(400);
    });

    it('creates provider profile and initializes trust score', async () => {
      const newProfile = { id: 'p-new', user_id: 'user-123', service_type: 'ride', display_name: 'Ali' };
      mockQuery
        .mockResolvedValueOnce({ rows: [newProfile] })  // INSERT provider_profiles
        .mockResolvedValueOnce({ rows: [] })              // INSERT provider_ride_details
        .mockResolvedValueOnce({ rows: [] });             // INSERT provider_trust_scores

      const res = await request(app)
        .post('/providers')
        .set('Authorization', `Bearer ${makeToken()}`)
        .send({ service_type: 'ride', display_name: 'Ali', ride_details: { max_passengers: 2 } });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.display_name).toBe('Ali');
      // Should have called query 3 times
      expect(mockQuery).toHaveBeenCalledTimes(3);
    });

    it('returns 409 on duplicate service_type for user', async () => {
      const pgError = new Error('duplicate') as any;
      pgError.code = '23505';
      mockQuery.mockRejectedValueOnce(pgError);

      const res = await request(app)
        .post('/providers')
        .set('Authorization', `Bearer ${makeToken()}`)
        .send({ service_type: 'ride', display_name: 'Ali' });

      expect(res.status).toBe(409);
    });
  });

  describe('DELETE /providers/:providerId', () => {
    it('returns 403 when user does not own the profile', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [{ id: 'p1', user_id: 'other-user' }] });

      const res = await request(app)
        .delete('/providers/p1')
        .set('Authorization', `Bearer ${makeToken('user-123')}`);

      expect(res.status).toBe(403);
    });

    it('deletes profile when owner requests', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [{ id: 'p1', user_id: 'user-123' }] })
        .mockResolvedValueOnce({ rows: [] });

      const res = await request(app)
        .delete('/providers/p1')
        .set('Authorization', `Bearer ${makeToken('user-123')}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });
});
