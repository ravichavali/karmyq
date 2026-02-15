/**
 * Admin Schema Management API
 *
 * Admin-only routes for creating, updating, publishing, and managing UI schemas.
 * Requires admin role authentication.
 */

import { Router, Request, Response } from 'express';
import { sendSuccess, sendNotFound } from '@karmyq/shared/utils/response';
import pool from '../database/db';
import { SchemaService } from '../services/SchemaService';

const router = Router();
const schemaService = new SchemaService(pool);

/**
 * POST /admin/schemas - Create new schema
 * Creates a draft schema (status='draft')
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const {
      type,
      label,
      icon,
      color,
      description,
      sections,
      summary,
      variant = 'control',
      rollout_percentage = 100
    } = req.body;

    // Validate required fields
    if (!type || !label || !icon || !color || !description) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: type, label, icon, color, description'
      });
    }

    if (!Array.isArray(sections)) {
      return res.status(400).json({
        success: false,
        message: 'sections must be an array'
      });
    }

    // Get user ID from auth token (set by auth middleware)
    const userId = (req as any).user?.userId;

    // Check if schema type already exists
    const existing = await pool.query(
      'SELECT id FROM requests.ui_schemas WHERE type = $1 AND variant = $2',
      [type, variant]
    );

    if (existing.rows.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Schema with type '${type}' and variant '${variant}' already exists`
      });
    }

    // Insert new schema
    const result = await pool.query(
      `INSERT INTO requests.ui_schemas (
        type, version, label, icon, color, description, sections, summary,
        status, variant, rollout_percentage, created_by, updated_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING *`,
      [
        type, 1, label, icon, color, description,
        JSON.stringify(sections),
        summary ? JSON.stringify(summary) : null,
        'draft', variant, rollout_percentage, userId, userId
      ]
    );

    const schema = result.rows[0];

    res.status(201).json({
      success: true,
      data: {
        schema: {
          id: schema.id,
          type: schema.type,
          version: schema.version,
          label: schema.label,
          icon: schema.icon,
          color: schema.color,
          description: schema.description,
          sections: schema.sections,
          summary: schema.summary,
          status: schema.status,
          variant: schema.variant,
          rollout_percentage: schema.rollout_percentage
        }
      }
    });

  } catch (error) {
    console.error('Error creating schema:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create schema',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /admin/schemas - List all schemas (including drafts)
 * Supports filtering by status and type
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const { status, type } = req.query;

    let query = 'SELECT * FROM requests.ui_schemas WHERE 1=1';
    const params: any[] = [];

    if (status) {
      params.push(status);
      query += ` AND status = $${params.length}`;
    }

    if (type) {
      params.push(type);
      query += ` AND type = $${params.length}`;
    }

    query += ' ORDER BY created_at DESC';

    const result = await pool.query(query, params);

    const schemas = result.rows.map(row => ({
      id: row.id,
      type: row.type,
      version: row.version,
      label: row.label,
      icon: row.icon,
      color: row.color,
      description: row.description,
      sections: row.sections,
      summary: row.summary,
      status: row.status,
      variant: row.variant,
      rollout_percentage: row.rollout_percentage,
      created_at: row.created_at,
      updated_at: row.updated_at,
      published_at: row.published_at
    }));

    sendSuccess(res, { schemas });

  } catch (error) {
    console.error('Error listing schemas:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to list schemas',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /admin/schemas/:id - Get schema by ID
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      'SELECT * FROM requests.ui_schemas WHERE id = $1',
      [id]
    );

    if (result.rows.length === 0) {
      return sendNotFound(res, 'Schema');
    }

    const row = result.rows[0];
    const schema = {
      id: row.id,
      type: row.type,
      version: row.version,
      label: row.label,
      icon: row.icon,
      color: row.color,
      description: row.description,
      sections: row.sections,
      summary: row.summary,
      status: row.status,
      variant: row.variant,
      rollout_percentage: row.rollout_percentage,
      created_at: row.created_at,
      updated_at: row.updated_at,
      published_at: row.published_at
    };

    sendSuccess(res, { schema });

  } catch (error) {
    console.error('Error fetching schema:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch schema',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * PUT /admin/schemas/:id - Update schema
 * Increments version number
 * Type is immutable after creation
 */
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    const userId = (req as any).user?.userId;

    // Check if schema exists
    const existing = await pool.query(
      'SELECT * FROM requests.ui_schemas WHERE id = $1',
      [id]
    );

    if (existing.rows.length === 0) {
      return sendNotFound(res, 'Schema');
    }

    // Don't allow changing type (immutable)
    if (updates.type && updates.type !== existing.rows[0].type) {
      return res.status(400).json({
        success: false,
        message: 'Cannot change schema type - type is immutable after creation'
      });
    }

    // Build update query dynamically
    const allowedFields = ['label', 'icon', 'color', 'description', 'sections', 'summary', 'rollout_percentage'];
    const setStatements: string[] = [];
    const params: any[] = [];

    Object.keys(updates).forEach(key => {
      if (allowedFields.includes(key)) {
        params.push(key === 'sections' || key === 'summary' ? JSON.stringify(updates[key]) : updates[key]);
        setStatements.push(`${key} = $${params.length}`);
      }
    });

    if (setStatements.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No valid fields to update'
      });
    }

    // Increment version and set updated_by
    params.push(userId);
    setStatements.push(`version = version + 1`);
    setStatements.push(`updated_by = $${params.length}`);

    params.push(id);

    const query = `
      UPDATE requests.ui_schemas
      SET ${setStatements.join(', ')}
      WHERE id = $${params.length}
      RETURNING *
    `;

    const result = await pool.query(query, params);
    const row = result.rows[0];

    // Invalidate cache
    schemaService.invalidateCache(row.type);

    const schema = {
      id: row.id,
      type: row.type,
      version: row.version,
      label: row.label,
      icon: row.icon,
      color: row.color,
      description: row.description,
      sections: row.sections,
      summary: row.summary,
      status: row.status,
      variant: row.variant,
      rollout_percentage: row.rollout_percentage
    };

    sendSuccess(res, { schema });

  } catch (error) {
    console.error('Error updating schema:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update schema',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /admin/schemas/:id/publish - Publish draft schema
 * Changes status to 'published' and sets published_at
 * Creates version history entry (via trigger)
 */
router.post('/:id/publish', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Get schema
    const existing = await pool.query(
      'SELECT * FROM requests.ui_schemas WHERE id = $1',
      [id]
    );

    if (existing.rows.length === 0) {
      return sendNotFound(res, 'Schema');
    }

    const schema = existing.rows[0];

    // Validate schema before publishing
    if (!schema.label || schema.label.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'Cannot publish schema with validation errors: label is required'
      });
    }

    // Update status to published
    const result = await pool.query(
      `UPDATE requests.ui_schemas
       SET status = 'published', published_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [id]
    );

    const row = result.rows[0];

    // Invalidate cache
    schemaService.invalidateCache(row.type);

    sendSuccess(res, {
      schema: {
        id: row.id,
        type: row.type,
        version: row.version,
        status: row.status,
        published_at: row.published_at
      }
    });

  } catch (error) {
    console.error('Error publishing schema:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to publish schema',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /admin/schemas/:id/archive - Archive published schema
 */
router.post('/:id/archive', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `UPDATE requests.ui_schemas
       SET status = 'archived'
       WHERE id = $1
       RETURNING *`,
      [id]
    );

    if (result.rows.length === 0) {
      return sendNotFound(res, 'Schema');
    }

    const row = result.rows[0];

    // Invalidate cache
    schemaService.invalidateCache(row.type);

    sendSuccess(res, {
      schema: {
        id: row.id,
        type: row.type,
        status: row.status
      }
    });

  } catch (error) {
    console.error('Error archiving schema:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to archive schema',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /admin/schemas/:id/versions - Get version history
 */
router.get('/:id/versions', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `SELECT * FROM requests.ui_schema_versions
       WHERE schema_id = $1
       ORDER BY version DESC`,
      [id]
    );

    const versions = result.rows.map(row => ({
      id: row.id,
      version: row.version,
      schema_snapshot: row.schema_snapshot,
      changed_by: row.changed_by,
      change_description: row.change_description,
      created_at: row.created_at
    }));

    sendSuccess(res, { versions });

  } catch (error) {
    console.error('Error fetching version history:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch version history',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /admin/schemas/:id/rollback/:version - Rollback to previous version
 */
router.post('/:id/rollback/:version', async (req: Request, res: Response) => {
  try {
    const { id, version } = req.params;
    const userId = (req as any).user?.userId;

    // Get version snapshot
    const versionResult = await pool.query(
      `SELECT schema_snapshot FROM requests.ui_schema_versions
       WHERE schema_id = $1 AND version = $2`,
      [id, version]
    );

    if (versionResult.rows.length === 0) {
      return sendNotFound(res, `Version ${version}`);
    }

    const snapshot = versionResult.rows[0].schema_snapshot;

    // Restore from snapshot
    const result = await pool.query(
      `UPDATE requests.ui_schemas
       SET label = $1, icon = $2, color = $3, description = $4,
           sections = $5, summary = $6, version = $7, updated_by = $8
       WHERE id = $9
       RETURNING *`,
      [
        snapshot.label,
        snapshot.icon,
        snapshot.color,
        snapshot.description,
        JSON.stringify(snapshot.sections),
        snapshot.summary ? JSON.stringify(snapshot.summary) : null,
        parseInt(version),
        userId,
        id
      ]
    );

    const row = result.rows[0];

    // Invalidate cache
    schemaService.invalidateCache(row.type);

    sendSuccess(res, {
      schema: {
        id: row.id,
        type: row.type,
        version: row.version,
        description: row.description
      }
    });

  } catch (error) {
    console.error('Error rolling back schema:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to rollback schema',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /admin/schemas/:id/variants - Create A/B test variant
 */
router.post('/:id/variants', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { variant, label, icon, sections, rollout_percentage } = req.body;
    const userId = (req as any).user?.userId;

    if (!variant || !label || !sections || rollout_percentage === undefined) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: variant, label, sections, rollout_percentage'
      });
    }

    // Get original schema
    const original = await pool.query(
      'SELECT * FROM requests.ui_schemas WHERE id = $1',
      [id]
    );

    if (original.rows.length === 0) {
      return sendNotFound(res, 'Schema');
    }

    const baseSchema = original.rows[0];

    // Create variant as new schema
    const result = await pool.query(
      `INSERT INTO requests.ui_schemas (
        type, version, label, icon, color, description, sections, summary,
        status, variant, rollout_percentage, created_by, updated_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING *`,
      [
        baseSchema.type,
        baseSchema.version,
        label,
        icon || baseSchema.icon,
        baseSchema.color,
        baseSchema.description,
        JSON.stringify(sections),
        baseSchema.summary,
        'published',
        variant,
        rollout_percentage,
        userId,
        userId
      ]
    );

    const row = result.rows[0];

    // Invalidate cache
    schemaService.invalidateCache(row.type);

    res.status(201).json({
      success: true,
      data: {
        schema: {
          id: row.id,
          type: row.type,
          variant: row.variant,
          rollout_percentage: row.rollout_percentage
        }
      }
    });

  } catch (error) {
    console.error('Error creating variant:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create variant',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;
