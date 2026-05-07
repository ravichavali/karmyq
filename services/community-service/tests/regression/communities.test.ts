process.env.JWT_SECRET = 'test-secret';
process.env.NODE_ENV = 'test';

import request from 'supertest';
import jwt from 'jsonwebtoken';

jest.mock('../../src/database/db', () => {
  const mockPool = {
    query: jest.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
    connect: jest.fn().mockResolvedValue({ release: jest.fn() }),
  };
  return {
    __esModule: true,
    default: mockPool,
    initDatabase: jest.fn().mockResolvedValue(undefined),
    query: jest.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
  };
});

jest.mock('../../src/events/publisher', () => ({
  initEventPublisher: jest.fn().mockResolvedValue(undefined),
  publishEvent: jest.fn().mockResolvedValue(undefined),
}));

import app from '../../src/index';
import { query } from '../../src/database/db';

const mockQuery = query as jest.MockedFunction<typeof query>;
const SECRET = 'test-secret';

function makeToken(payload: object = {}) {
  return jwt.sign(
    { userId: 'u1', email: 'test@example.com', communities: [], ...payload },
    SECRET
  );
}

describe('Community Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockQuery.mockResolvedValue({ rows: [], rowCount: 0 } as any);
  });

  describe('GET /communities', () => {
    it('returns 401 without an auth token', async () => {
      const res = await request(app).get('/communities');
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('returns 200 with an empty communities array when DB has no rows', async () => {
      mockQuery.mockResolvedValue({ rows: [], rowCount: 0 } as any);
      const res = await request(app)
        .get('/communities')
        .set('Authorization', `Bearer ${makeToken()}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data.communities)).toBe(true);
    });

    it('returns communities with id and name fields from DB', async () => {
      mockQuery.mockResolvedValue({
        rows: [
          { id: 'c1', name: 'Mutual Aid East', status: 'active' },
          { id: 'c2', name: 'Community Fridge', status: 'active' },
        ],
        rowCount: 2,
      } as any);
      const res = await request(app)
        .get('/communities')
        .set('Authorization', `Bearer ${makeToken()}`);
      expect(res.status).toBe(200);
      expect(res.body.data.communities).toHaveLength(2);
      expect(res.body.data.communities[0]).toHaveProperty('id', 'c1');
      expect(res.body.data.communities[0]).toHaveProperty('name', 'Mutual Aid East');
    });
  });

  describe('POST /communities', () => {
    it('returns 401 without an auth token', async () => {
      const res = await request(app)
        .post('/communities')
        .send({ name: 'New Community' });
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('returns 400 when name is missing', async () => {
      const res = await request(app)
        .post('/communities')
        .set('Authorization', `Bearer ${makeToken()}`)
        .send({});
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('returns 400 when name is too short (< 3 chars)', async () => {
      const res = await request(app)
        .post('/communities')
        .set('Authorization', `Bearer ${makeToken()}`)
        .send({ name: 'ab' });
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('returns 400 when max_members exceeds 150', async () => {
      const res = await request(app)
        .post('/communities')
        .set('Authorization', `Bearer ${makeToken()}`)
        .send({ name: 'Valid Name', max_members: 200 });
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('returns 201 with success:true when valid body is submitted', async () => {
      const communityId = '123e4567-e89b-12d3-a456-426614174000';
      mockQuery
        .mockResolvedValueOnce({ rows: [], rowCount: 0 } as any) // duplicate check
        .mockResolvedValueOnce({
          rows: [{ id: communityId, name: 'Valid Community' }],
          rowCount: 1,
        } as any) // INSERT community
        .mockResolvedValueOnce({ rows: [], rowCount: 1 } as any) // INSERT member
        .mockResolvedValueOnce({ rows: [], rowCount: 1 } as any); // INSERT settings

      const res = await request(app)
        .post('/communities')
        .set('Authorization', `Bearer ${makeToken()}`)
        .send({ name: 'Valid Community' });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.community).toHaveProperty('id');
      expect(res.body.data.community).toHaveProperty('name');
    });
  });
});
