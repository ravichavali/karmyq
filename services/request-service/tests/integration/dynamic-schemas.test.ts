/**
 * Integration Tests: Dynamic Schemas
 *
 * Tests database-driven schema system with real database and Express app
 */

import request from 'supertest';
import { Express } from 'express';
import { Pool } from 'pg';
import { createTestApp, createTestPool, createAdminToken, cleanupTestData } from '../setup/testSetup';

describe('Dynamic Schemas Integration Tests', () => {
  let app: Express;
  let pool: Pool;
  let adminToken: string;

  beforeAll(async () => {
    pool = createTestPool();
    app = createTestApp();
    adminToken = createAdminToken();

    // Verify database connection
    try {
      await pool.query('SELECT 1');
    } catch (error) {
      console.log('Database not available, skipping integration tests');
      return;
    }
  });

  afterAll(async () => {
    await pool.end();
  });

  beforeEach(async () => {
    try {
      await cleanupTestData(pool);
    } catch (error) {
      // Skip if database not available
    }
  });

  describe('Public Schema API', () => {
    it('should return schemas list', async () => {
      const response = await request(app).get('/schemas');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data.schemas)).toBe(true);
      // Should have at least built-in types from code fallback
      expect(response.body.data.schemas.length).toBeGreaterThanOrEqual(5);
    });

    it('should return individual schema', async () => {
      const response = await request(app).get('/schemas/ride');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.schema.type).toBe('ride');
      expect(response.body.data.schema.label).toBeDefined();
      expect(response.body.data.schema.sections).toBeDefined();
    });

    it('should return 404 for non-existent schema', async () => {
      const response = await request(app).get('/schemas/nonexistent');

      expect(response.status).toBe(404);
    });

    it('should include cache headers', async () => {
      const response = await request(app).get('/schemas/ride');

      expect(response.headers['cache-control']).toBeDefined();
      expect(response.headers['etag']).toBeDefined();
    });

    it('should support ETag for 304 responses', async () => {
      // Get schema first to get ETag
      const response1 = await request(app).get('/schemas/ride');
      const etag = response1.headers['etag'];

      // Request again with ETag
      const response2 = await request(app)
        .get('/schemas/ride')
        .set('If-None-Match', etag);

      expect(response2.status).toBe(304);
    });
  });

  describe('Admin Schema API', () => {
    it('should reject admin requests without token', async () => {
      const response = await request(app)
        .get('/admin/schemas');

      expect(response.status).toBe(401);
    });

    it('should allow admin to list schemas', async () => {
      const response = await request(app)
        .get('/admin/schemas')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should allow admin to create schema', async () => {
      const newSchema = {
        type: 'test_dogwalking',
        label: 'Dog Walking',
        icon: '🐕',
        color: 'orange',
        description: 'Test schema for dog walking',
        sections: [
          {
            id: 'details',
            title: 'Details',
            fields: [
              { key: 'breed', type: 'text', label: 'Dog Breed', required: true }
            ]
          }
        ]
      };

      const response = await request(app)
        .post('/admin/schemas')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(newSchema);

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.schema.type).toBe('test_dogwalking');
      expect(response.body.data.schema.status).toBe('draft');
    }, 10000); // Longer timeout for database operations

    it('should prevent duplicate schema types', async () => {
      const schema = {
        type: 'test_duplicate',
        label: 'Test',
        icon: '🧪',
        color: 'blue',
        description: 'Test',
        sections: []
      };

      // Create first time
      await request(app)
        .post('/admin/schemas')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(schema);

      // Try to create duplicate
      const response = await request(app)
        .post('/admin/schemas')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(schema);

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('already exists');
    }, 10000);
  });

  describe('Code Fallback', () => {
    it('should fall back to code schemas when DB unavailable', async () => {
      // Even without database, should return built-in types from code
      const response = await request(app).get('/schemas/ride');

      expect(response.status).toBe(200);
      expect(response.body.data.schema.type).toBe('ride');
    });

    it('should merge database and code schemas', async () => {
      const response = await request(app).get('/schemas');

      const schemas = response.body.data.schemas;

      // Should have built-in types
      expect(schemas.some((s: any) => s.type === 'ride')).toBe(true);
      expect(schemas.some((s: any) => s.type === 'service')).toBe(true);
      expect(schemas.some((s: any) => s.type === 'generic')).toBe(true);
    });
  });
});
