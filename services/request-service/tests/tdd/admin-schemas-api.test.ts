/**
 * TDD Tests: Admin Schema API (CRUD Operations)
 *
 * Tests for admin-only schema management endpoints.
 * Requires admin role authentication.
 */

import request from 'supertest';
import { Express } from 'express';
import { Pool } from 'pg';
import jwt from 'jsonwebtoken';

describe('Admin Schema API (TDD)', () => {
  let app: Express;
  let pool: Pool;
  let adminToken: string;
  let userToken: string;

  beforeAll(async () => {
    // TODO: Set up test app and database

    // Create admin token
    adminToken = jwt.sign(
      { userId: 'admin-user-id', email: 'admin@test.com', role: 'admin' },
      process.env.JWT_SECRET || 'test-secret'
    );

    // Create regular user token (no admin role)
    userToken = jwt.sign(
      { userId: 'regular-user-id', email: 'user@test.com' },
      process.env.JWT_SECRET || 'test-secret'
    );
  });

  afterAll(async () => {
    // TODO: Clean up
  });

  beforeEach(async () => {
    // TODO: Clean test data
  });

  describe('POST /admin/schemas - Create schema', () => {
    it('should create a new schema with admin token', async () => {
      // Arrange
      const newSchema = {
        type: 'dogwalking',
        label: 'Dog Walking',
        icon: '🐕',
        color: 'orange',
        description: 'Request dog walking help',
        sections: [
          {
            id: 'dog_details',
            title: 'Dog Details',
            fields: [
              { key: 'dog_breed', type: 'text', label: 'Breed', required: true },
              { key: 'dog_size', type: 'select', label: 'Size', required: true, options: [
                { value: 'small', label: 'Small' },
                { value: 'medium', label: 'Medium' },
                { value: 'large', label: 'Large' }
              ]}
            ]
          }
        ]
      };

      // Act
      const response = await request(app)
        .post('/admin/schemas')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(newSchema);

      // Assert
      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.schema.type).toBe('dogwalking');
      expect(response.body.data.schema.status).toBe('draft'); // Default status
      expect(response.body.data.schema.id).toBeDefined();
    });

    it('should reject creation without admin token', async () => {
      // Arrange
      const newSchema = {
        type: 'tutoring',
        label: 'Tutoring',
        icon: '📚',
        color: 'blue',
        description: 'Request tutoring',
        sections: []
      };

      // Act
      const response = await request(app)
        .post('/admin/schemas')
        .set('Authorization', `Bearer ${userToken}`) // Regular user token
        .send(newSchema);

      // Assert
      expect(response.status).toBe(403); // Forbidden
      expect(response.body.success).toBe(false);
    });

    it('should reject creation without authentication', async () => {
      // Arrange
      const newSchema = {
        type: 'tutoring',
        label: 'Tutoring',
        icon: '📚',
        color: 'blue',
        description: 'Request tutoring',
        sections: []
      };

      // Act
      const response = await request(app)
        .post('/admin/schemas')
        .send(newSchema); // No Authorization header

      // Assert
      expect(response.status).toBe(401); // Unauthorized
    });

    it('should reject schema with duplicate type', async () => {
      // Arrange: Create first schema
      await pool.query(`
        INSERT INTO requests.ui_schemas (type, version, label, icon, color, description, sections, status)
        VALUES ('dogwalking', 1, 'Dog Walking', '🐕', 'orange', 'Test', '[]'::jsonb, 'draft')
      `);

      const duplicateSchema = {
        type: 'dogwalking', // Duplicate
        label: 'Dog Walking 2',
        icon: '🐕',
        color: 'orange',
        description: 'Duplicate',
        sections: []
      };

      // Act
      const response = await request(app)
        .post('/admin/schemas')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(duplicateSchema);

      // Assert
      expect(response.status).toBe(400); // Bad Request
      expect(response.body.message).toContain('already exists');
    });

    it('should validate required fields', async () => {
      // Arrange: Missing required fields
      const invalidSchema = {
        type: 'invalid'
        // Missing label, icon, color, description, sections
      };

      // Act
      const response = await request(app)
        .post('/admin/schemas')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(invalidSchema);

      // Assert
      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('should record created_by user', async () => {
      // Arrange
      const newSchema = {
        type: 'petcare',
        label: 'Pet Care',
        icon: '🐾',
        color: 'purple',
        description: 'Pet care requests',
        sections: []
      };

      // Act
      const response = await request(app)
        .post('/admin/schemas')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(newSchema);

      // Assert
      expect(response.status).toBe(201);

      // Verify in database
      const result = await pool.query(
        'SELECT created_by FROM requests.ui_schemas WHERE type = $1',
        ['petcare']
      );
      expect(result.rows[0].created_by).toBe('admin-user-id');
    });
  });

  describe('GET /admin/schemas - List all schemas', () => {
    it('should return all schemas including drafts (admin only)', async () => {
      // Arrange: Insert draft, published, and archived
      await pool.query(`
        INSERT INTO requests.ui_schemas (type, version, label, icon, color, description, sections, status)
        VALUES
          ('draft1', 1, 'Draft', '📝', 'gray', 'Draft', '[]'::jsonb, 'draft'),
          ('published1', 1, 'Published', '✅', 'green', 'Published', '[]'::jsonb, 'published'),
          ('archived1', 1, 'Archived', '🗄️', 'gray', 'Archived', '[]'::jsonb, 'archived')
      `);

      // Act
      const response = await request(app)
        .get('/admin/schemas')
        .set('Authorization', `Bearer ${adminToken}`);

      // Assert
      expect(response.status).toBe(200);
      expect(response.body.data.schemas.length).toBe(3);
      expect(response.body.data.schemas.some((s: any) => s.status === 'draft')).toBe(true);
      expect(response.body.data.schemas.some((s: any) => s.status === 'published')).toBe(true);
      expect(response.body.data.schemas.some((s: any) => s.status === 'archived')).toBe(true);
    });

    it('should filter by status query parameter', async () => {
      // Arrange
      await pool.query(`
        INSERT INTO requests.ui_schemas (type, version, label, icon, color, description, sections, status)
        VALUES
          ('draft1', 1, 'Draft', '📝', 'gray', 'Draft', '[]'::jsonb, 'draft'),
          ('published1', 1, 'Published', '✅', 'green', 'Published', '[]'::jsonb, 'published')
      `);

      // Act
      const response = await request(app)
        .get('/admin/schemas?status=draft')
        .set('Authorization', `Bearer ${adminToken}`);

      // Assert
      expect(response.status).toBe(200);
      expect(response.body.data.schemas.every((s: any) => s.status === 'draft')).toBe(true);
    });

    it('should filter by type query parameter', async () => {
      // Arrange
      await pool.query(`
        INSERT INTO requests.ui_schemas (type, version, label, icon, color, description, sections, status)
        VALUES
          ('dogwalking', 1, 'Dog Walking', '🐕', 'orange', 'Test', '[]'::jsonb, 'draft'),
          ('tutoring', 1, 'Tutoring', '📚', 'blue', 'Test', '[]'::jsonb, 'draft')
      `);

      // Act
      const response = await request(app)
        .get('/admin/schemas?type=dogwalking')
        .set('Authorization', `Bearer ${adminToken}`);

      // Assert
      expect(response.status).toBe(200);
      expect(response.body.data.schemas).toHaveLength(1);
      expect(response.body.data.schemas[0].type).toBe('dogwalking');
    });

    it('should reject non-admin users', async () => {
      // Act
      const response = await request(app)
        .get('/admin/schemas')
        .set('Authorization', `Bearer ${userToken}`);

      // Assert
      expect(response.status).toBe(403);
    });
  });

  describe('GET /admin/schemas/:id - Get schema by ID', () => {
    it('should return schema by ID', async () => {
      // Arrange
      const result = await pool.query(`
        INSERT INTO requests.ui_schemas (type, version, label, icon, color, description, sections, status)
        VALUES ('dogwalking', 1, 'Dog Walking', '🐕', 'orange', 'Test', '[]'::jsonb, 'draft')
        RETURNING id
      `);
      const schemaId = result.rows[0].id;

      // Act
      const response = await request(app)
        .get(`/admin/schemas/${schemaId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      // Assert
      expect(response.status).toBe(200);
      expect(response.body.data.schema.id).toBe(schemaId);
      expect(response.body.data.schema.type).toBe('dogwalking');
    });

    it('should return 404 for non-existent ID', async () => {
      // Act
      const response = await request(app)
        .get('/admin/schemas/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${adminToken}`);

      // Assert
      expect(response.status).toBe(404);
    });
  });

  describe('PUT /admin/schemas/:id - Update schema', () => {
    it('should update schema fields', async () => {
      // Arrange: Create schema
      const result = await pool.query(`
        INSERT INTO requests.ui_schemas (type, version, label, icon, color, description, sections, status)
        VALUES ('dogwalking', 1, 'Dog Walking', '🐕', 'orange', 'Old description', '[]'::jsonb, 'draft')
        RETURNING id
      `);
      const schemaId = result.rows[0].id;

      const updates = {
        description: 'Updated description',
        label: 'Dog Walking Service',
        color: 'brown'
      };

      // Act
      const response = await request(app)
        .put(`/admin/schemas/${schemaId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(updates);

      // Assert
      expect(response.status).toBe(200);
      expect(response.body.data.schema.description).toBe('Updated description');
      expect(response.body.data.schema.label).toBe('Dog Walking Service');
      expect(response.body.data.schema.color).toBe('brown');
    });

    it('should increment version on update', async () => {
      // Arrange
      const result = await pool.query(`
        INSERT INTO requests.ui_schemas (type, version, label, icon, color, description, sections, status)
        VALUES ('dogwalking', 1, 'Dog Walking', '🐕', 'orange', 'Test', '[]'::jsonb, 'draft')
        RETURNING id
      `);
      const schemaId = result.rows[0].id;

      // Act
      const response = await request(app)
        .put(`/admin/schemas/${schemaId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ description: 'Updated' });

      // Assert
      expect(response.body.data.schema.version).toBe(2);
    });

    it('should record updated_by user', async () => {
      // Arrange
      const result = await pool.query(`
        INSERT INTO requests.ui_schemas (type, version, label, icon, color, description, sections, status)
        VALUES ('dogwalking', 1, 'Dog Walking', '🐕', 'orange', 'Test', '[]'::jsonb, 'draft')
        RETURNING id
      `);
      const schemaId = result.rows[0].id;

      // Act
      await request(app)
        .put(`/admin/schemas/${schemaId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ description: 'Updated' });

      // Assert
      const dbResult = await pool.query(
        'SELECT updated_by FROM requests.ui_schemas WHERE id = $1',
        [schemaId]
      );
      expect(dbResult.rows[0].updated_by).toBe('admin-user-id');
    });

    it('should not allow changing type (immutable)', async () => {
      // Arrange
      const result = await pool.query(`
        INSERT INTO requests.ui_schemas (type, version, label, icon, color, description, sections, status)
        VALUES ('dogwalking', 1, 'Dog Walking', '🐕', 'orange', 'Test', '[]'::jsonb, 'draft')
        RETURNING id
      `);
      const schemaId = result.rows[0].id;

      // Act
      const response = await request(app)
        .put(`/admin/schemas/${schemaId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ type: 'changed_type' }); // Try to change type

      // Assert
      expect(response.status).toBe(400);
      expect(response.body.message).toContain('type');
      expect(response.body.message).toContain('immutable');
    });
  });

  describe('POST /admin/schemas/:id/publish - Publish schema', () => {
    it('should publish draft schema', async () => {
      // Arrange
      const result = await pool.query(`
        INSERT INTO requests.ui_schemas (type, version, label, icon, color, description, sections, status)
        VALUES ('dogwalking', 1, 'Dog Walking', '🐕', 'orange', 'Test', '[]'::jsonb, 'draft')
        RETURNING id
      `);
      const schemaId = result.rows[0].id;

      // Act
      const response = await request(app)
        .post(`/admin/schemas/${schemaId}/publish`)
        .set('Authorization', `Bearer ${adminToken}`);

      // Assert
      expect(response.status).toBe(200);
      expect(response.body.data.schema.status).toBe('published');
      expect(response.body.data.schema.published_at).toBeDefined();
    });

    it('should create version history entry on publish', async () => {
      // Arrange
      const result = await pool.query(`
        INSERT INTO requests.ui_schemas (type, version, label, icon, color, description, sections, status)
        VALUES ('dogwalking', 1, 'Dog Walking', '🐕', 'orange', 'Test', '[]'::jsonb, 'draft')
        RETURNING id
      `);
      const schemaId = result.rows[0].id;

      // Act
      await request(app)
        .post(`/admin/schemas/${schemaId}/publish`)
        .set('Authorization', `Bearer ${adminToken}`);

      // Assert: Check version history
      const versionResult = await pool.query(
        'SELECT * FROM requests.ui_schema_versions WHERE schema_id = $1',
        [schemaId]
      );
      expect(versionResult.rows).toHaveLength(1);
      expect(versionResult.rows[0].version).toBe(1);
    });

    it('should not publish schema with validation errors', async () => {
      // Arrange: Schema with empty sections (invalid)
      const result = await pool.query(`
        INSERT INTO requests.ui_schemas (type, version, label, icon, color, description, sections, status)
        VALUES ('invalid', 1, '', '', '', '', '[]'::jsonb, 'draft')
        RETURNING id
      `);
      const schemaId = result.rows[0].id;

      // Act
      const response = await request(app)
        .post(`/admin/schemas/${schemaId}/publish`)
        .set('Authorization', `Bearer ${adminToken}`);

      // Assert
      expect(response.status).toBe(400);
      expect(response.body.message).toContain('validation');
    });
  });

  describe('POST /admin/schemas/:id/archive - Archive schema', () => {
    it('should archive published schema', async () => {
      // Arrange
      const result = await pool.query(`
        INSERT INTO requests.ui_schemas (type, version, label, icon, color, description, sections, status, published_at)
        VALUES ('dogwalking', 1, 'Dog Walking', '🐕', 'orange', 'Test', '[]'::jsonb, 'published', NOW())
        RETURNING id
      `);
      const schemaId = result.rows[0].id;

      // Act
      const response = await request(app)
        .post(`/admin/schemas/${schemaId}/archive`)
        .set('Authorization', `Bearer ${adminToken}`);

      // Assert
      expect(response.status).toBe(200);
      expect(response.body.data.schema.status).toBe('archived');
    });

    it('should not appear in public schema list after archiving', async () => {
      // Arrange: Create and archive
      const result = await pool.query(`
        INSERT INTO requests.ui_schemas (type, version, label, icon, color, description, sections, status, published_at)
        VALUES ('dogwalking', 1, 'Dog Walking', '🐕', 'orange', 'Test', '[]'::jsonb, 'published', NOW())
        RETURNING id
      `);
      const schemaId = result.rows[0].id;

      await request(app)
        .post(`/admin/schemas/${schemaId}/archive`)
        .set('Authorization', `Bearer ${adminToken}`);

      // Act: Get public schemas
      const response = await request(app).get('/schemas');

      // Assert
      expect(response.body.data.schemas.some((s: any) => s.type === 'dogwalking')).toBe(false);
    });
  });

  describe('GET /admin/schemas/:id/versions - Version history', () => {
    it('should return version history for schema', async () => {
      // Arrange: Create schema and publish twice
      const result = await pool.query(`
        INSERT INTO requests.ui_schemas (type, version, label, icon, color, description, sections, status)
        VALUES ('dogwalking', 1, 'Dog Walking', '🐕', 'orange', 'Version 1', '[]'::jsonb, 'draft')
        RETURNING id
      `);
      const schemaId = result.rows[0].id;

      // Publish v1
      await request(app)
        .post(`/admin/schemas/${schemaId}/publish`)
        .set('Authorization', `Bearer ${adminToken}`);

      // Update and publish v2
      await request(app)
        .put(`/admin/schemas/${schemaId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ description: 'Version 2' });

      await request(app)
        .post(`/admin/schemas/${schemaId}/publish`)
        .set('Authorization', `Bearer ${adminToken}`);

      // Act
      const response = await request(app)
        .get(`/admin/schemas/${schemaId}/versions`)
        .set('Authorization', `Bearer ${adminToken}`);

      // Assert
      expect(response.status).toBe(200);
      expect(response.body.data.versions).toHaveLength(2);
      expect(response.body.data.versions[0].version).toBe(2); // Newest first
      expect(response.body.data.versions[1].version).toBe(1);
    });
  });

  describe('POST /admin/schemas/:id/rollback/:version - Rollback', () => {
    it('should rollback schema to previous version', async () => {
      // Arrange: Create and publish v1
      const result = await pool.query(`
        INSERT INTO requests.ui_schemas (type, version, label, icon, color, description, sections, status, published_at)
        VALUES ('dogwalking', 1, 'Dog Walking', '🐕', 'orange', 'Version 1', '[]'::jsonb, 'published', NOW())
        RETURNING id
      `);
      const schemaId = result.rows[0].id;

      // Trigger version history
      await pool.query(`
        INSERT INTO requests.ui_schema_versions (schema_id, version, schema_snapshot)
        VALUES ($1, 1, '{"description": "Version 1"}'::jsonb)
      `, [schemaId]);

      // Update to v2
      await pool.query(`
        UPDATE requests.ui_schemas
        SET description = 'Version 2', version = 2
        WHERE id = $1
      `, [schemaId]);

      // Act: Rollback to v1
      const response = await request(app)
        .post(`/admin/schemas/${schemaId}/rollback/1`)
        .set('Authorization', `Bearer ${adminToken}`);

      // Assert
      expect(response.status).toBe(200);
      expect(response.body.data.schema.description).toBe('Version 1');
      expect(response.body.data.schema.version).toBe(1);
    });
  });

  describe('POST /admin/schemas/:id/variants - Create A/B variant', () => {
    it('should create variant for A/B testing', async () => {
      // Arrange: Create control variant
      const result = await pool.query(`
        INSERT INTO requests.ui_schemas (type, version, label, icon, color, description, sections, status, variant, rollout_percentage, published_at)
        VALUES ('ride', 1, 'Ride Control', '🚗', 'blue', 'Control', '[]'::jsonb, 'published', 'control', 50, NOW())
        RETURNING id
      `);
      const schemaId = result.rows[0].id;

      const variantData = {
        variant: 'variant_a',
        label: 'Ride Variant A',
        icon: '🚙',
        sections: [],
        rollout_percentage: 50
      };

      // Act
      const response = await request(app)
        .post(`/admin/schemas/${schemaId}/variants`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(variantData);

      // Assert
      expect(response.status).toBe(201);
      expect(response.body.data.schema.variant).toBe('variant_a');
      expect(response.body.data.schema.rollout_percentage).toBe(50);
    });
  });
});
