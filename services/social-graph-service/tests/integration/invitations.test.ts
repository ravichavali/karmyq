import request from 'supertest';
import express from 'express';
import invitationRoutes from '../src/routes/invitations';
import { Pool } from 'pg';

// Mock the pool and logger
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

const { pool } = require('../src/index');

// Create test app
const app = express();
app.use(express.json());

// Mock auth middleware
app.use((req: any, res, next) => {
  req.user = {
    userId: 'test-user-123',
    currentCommunityId: 'test-community-123',
  };
  req.headers['x-community-id'] = 'test-community-123';
  next();
});

app.use('/invitations', invitationRoutes);

describe('Invitation Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /invitations/generate', () => {
    it('should generate invitation code successfully', async () => {
      // Mock user query
      pool.query.mockResolvedValueOnce({
        rows: [{ name: 'Test User' }],
      });

      // Mock code generation
      pool.query.mockResolvedValueOnce({
        rows: [{ code: 'KARMYQ-TESTUSER-2024-A7B3' }],
      });

      // Mock invitation insert
      pool.query.mockResolvedValueOnce({
        rows: [
          {
            id: 'invite-123',
            invitation_code: 'KARMYQ-TESTUSER-2024-A7B3',
            invited_at: new Date().toISOString(),
          },
        ],
      });

      // Mock inviter stats update
      pool.query.mockResolvedValueOnce({ rows: [] });

      const response = await request(app)
        .post('/invitations/generate')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.code).toBe('KARMYQ-TESTUSER-2024-A7B3');
      expect(response.body.data.url).toContain('KARMYQ-TESTUSER-2024-A7B3');
    });

    it('should return 404 if user not found', async () => {
      pool.query.mockResolvedValueOnce({
        rows: [], // No user found
      });

      const response = await request(app)
        .post('/invitations/generate')
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('User not found');
    });

    it('should handle database errors', async () => {
      pool.query.mockRejectedValueOnce(new Error('Database error'));

      const response = await request(app)
        .post('/invitations/generate')
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Failed to generate invitation code');
    });
  });

  describe('POST /invitations/accept', () => {
    it('should accept invitation code successfully', async () => {
      const invitationCode = 'KARMYQ-TESTUSER-2024-A7B3';

      // Mock find invitation
      pool.query.mockResolvedValueOnce({
        rows: [
          {
            id: 'invite-123',
            inviter_id: 'inviter-456',
            community_id: 'community-789',
            invitation_accepted_at: null,
          },
        ],
      });

      // Mock update invitation
      pool.query.mockResolvedValueOnce({ rows: [] });

      // Mock update user
      pool.query.mockResolvedValueOnce({ rows: [] });

      const response = await request(app)
        .post('/invitations/accept')
        .send({ invitation_code: invitationCode })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.inviter_id).toBe('inviter-456');
      expect(response.body.data.community_id).toBe('community-789');
    });

    it('should return 404 for invalid invitation code', async () => {
      pool.query.mockResolvedValueOnce({
        rows: [], // No invitation found
      });

      const response = await request(app)
        .post('/invitations/accept')
        .send({ invitation_code: 'INVALID-CODE' })
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Invalid invitation code');
    });

    it('should return 400 if code already used', async () => {
      pool.query.mockResolvedValueOnce({
        rows: [
          {
            id: 'invite-123',
            inviter_id: 'inviter-456',
            community_id: 'community-789',
            invitation_accepted_at: new Date().toISOString(), // Already accepted
          },
        ],
      });

      const response = await request(app)
        .post('/invitations/accept')
        .send({ invitation_code: 'KARMYQ-TESTUSER-2024-A7B3' })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('This invitation code has already been used');
    });

    it('should require invitation_code parameter', async () => {
      const response = await request(app)
        .post('/invitations/accept')
        .send({})
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /invitations', () => {
    it('should return invitation history', async () => {
      // Mock sent invitations
      pool.query.mockResolvedValueOnce({
        rows: [
          {
            id: 'invite-1',
            invitation_code: 'KARMYQ-TESTUSER-2024-A7B3',
            invited_at: new Date('2024-01-01').toISOString(),
            invitation_accepted_at: new Date('2024-01-02').toISOString(),
            invitee_id: 'invitee-1',
            invitee_name: 'Jane Doe',
            invitee_karma: 50,
          },
          {
            id: 'invite-2',
            invitation_code: 'KARMYQ-TESTUSER-2024-B8C4',
            invited_at: new Date('2024-01-03').toISOString(),
            invitation_accepted_at: null,
            invitee_id: null,
            invitee_name: null,
            invitee_karma: 0,
          },
        ],
      });

      // Mock received invitation
      pool.query.mockResolvedValueOnce({
        rows: [
          {
            id: 'invite-3',
            invitation_code: 'KARMYQ-ALICE-2024-C9D5',
            invited_at: new Date('2023-12-01').toISOString(),
            invitation_accepted_at: new Date('2023-12-02').toISOString(),
            inviter_id: 'alice-123',
            inviter_name: 'Alice Smith',
          },
        ],
      });

      const response = await request(app)
        .get('/invitations')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.sent).toHaveLength(2);
      expect(response.body.data.sent[0].invitee).toBeDefined();
      expect(response.body.data.sent[0].invitee.name).toBe('Jane Doe');
      expect(response.body.data.sent[1].invitee).toBeNull();
      expect(response.body.data.received).toBeDefined();
      expect(response.body.data.received.inviter.name).toBe('Alice Smith');
    });

    it('should return empty arrays when no invitations exist', async () => {
      pool.query.mockResolvedValueOnce({ rows: [] }); // No sent
      pool.query.mockResolvedValueOnce({ rows: [] }); // No received

      const response = await request(app)
        .get('/invitations')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.sent).toHaveLength(0);
      expect(response.body.data.received).toBeNull();
    });
  });

  describe('GET /invitations/stats', () => {
    it('should return inviter statistics', async () => {
      pool.query.mockResolvedValueOnce({
        rows: [
          {
            total_invitations_sent: 10,
            total_invitations_accepted: 7,
            acceptance_rate: 0.7,
            avg_invitee_karma: 65.5,
            avg_invitee_trust_score: 72.3,
            total_invitee_exchanges: 45,
            total_network_size: 23,
            bridge_score: 8.5,
            inviter_tier: 'silver',
            tier_updated_at: new Date('2024-01-15').toISOString(),
          },
        ],
      });

      const response = await request(app)
        .get('/invitations/stats')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.total_invitations_sent).toBe(10);
      expect(response.body.data.total_invitations_accepted).toBe(7);
      expect(response.body.data.inviter_tier).toBe('silver');
    });

    it('should return default stats for new users', async () => {
      pool.query.mockResolvedValueOnce({
        rows: [], // No stats yet
      });

      const response = await request(app)
        .get('/invitations/stats')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.total_invitations_sent).toBe(0);
      expect(response.body.data.total_invitations_accepted).toBe(0);
      expect(response.body.data.inviter_tier).toBe('bronze');
    });
  });
});
