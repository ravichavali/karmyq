import request from 'supertest';
import express from 'express';
import authRoutes from '../../src/routes/auth';

// Mock dependencies
jest.mock('../../src/database/db');
jest.mock('../../src/events/publisher');

const app = express();
app.use(express.json());
app.use('/', authRoutes);

describe('Auth Routes - Unit Tests', () => {
  it('should have auth routes defined', () => {
    expect(authRoutes).toBeDefined();
  });

  describe('Registration validation', () => {
    it('should require email, name, and password', async () => {
      const res = await request(app)
        .post('/register')
        .send({});
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.message).toMatch(/email|name|password/i);
    });
  });

  describe('Login validation', () => {
    it('should require email and password', async () => {
      const res = await request(app)
        .post('/login')
        .send({});
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.message).toMatch(/email|password/i);
    });
  });
});
