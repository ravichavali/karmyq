import { Router, Request, Response } from 'express';
import { sendSuccess, sendNotFound } from '@karmyq/shared/utils/response';
import { SchemaService } from '../services/SchemaService';
import pool from '../database/db';

const router = Router();

// Initialize schema service
const schemaService = new SchemaService(pool);

/**
 * GET /schemas — List all available request type schemas
 * Returns summary info (type, label, icon, version) for each schema.
 * Used by the frontend to show available request types.
 *
 * Now reads from database with fallback to code-based schemas.
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const summaries = await schemaService.getSchemaSummaries();

    res.set('Cache-Control', 'public, max-age=3600');
    sendSuccess(res, { schemas: summaries });
  } catch (error) {
    (req as any).logger?.error('Error fetching schemas', error instanceof Error ? error : new Error(String(error)), { service: 'request-service' });
    res.status(500).json({
      success: false,
      message: 'Failed to fetch schemas',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /schemas/:type — Get full UI schema for a request type
 * Returns the complete schema including sections, fields, and options.
 * Used by DynamicForm to render the form for a specific request type.
 *
 * Now reads from database with fallback to code-based schemas.
 * Supports A/B testing via user_id query parameter.
 */
router.get('/:type', async (req: Request, res: Response) => {
  try {
    const { type } = req.params;
    const userId = req.query.user_id as string | undefined;

    const schema = await schemaService.getSchema(type, userId);

    if (!schema) {
      const safeType = String(type).replace(/[\r\n]/g, '').slice(0, 100);
      return sendNotFound(res, `Schema for type '${safeType}'`);
    }

    // ETag based on schema version for cache invalidation
    const etag = `"${schema.type}-v${schema.version}"`;
    res.set('ETag', etag);
    res.set('Cache-Control', 'public, max-age=3600');

    // Check If-None-Match for 304 response
    if (req.headers['if-none-match'] === etag) {
      return res.status(304).end();
    }

    sendSuccess(res, { schema });
  } catch (error) {
    const safeParamType = String(req.params.type).replace(/[\r\n]/g, '').slice(0, 100);
    (req as any).logger?.error('Error fetching schema for type', error instanceof Error ? error : new Error(String(error)), { service: 'request-service', paramType: safeParamType });
    res.status(500).json({
      success: false,
      message: 'Failed to fetch schema',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;
