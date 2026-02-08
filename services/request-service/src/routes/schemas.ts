import { Router, Request, Response } from 'express';
import {
  getUISchema,
  getUISchemaSummaries,
} from '@karmyq/shared/schemas/ui';
import { sendSuccess, sendNotFound } from '@karmyq/shared/utils/response';

const router = Router();

/**
 * GET /schemas — List all available request type schemas
 * Returns summary info (type, label, icon, version) for each schema.
 * Used by the frontend to show available request types.
 */
router.get('/', (req: Request, res: Response) => {
  const summaries = getUISchemaSummaries();

  res.set('Cache-Control', 'public, max-age=3600');
  sendSuccess(res, { schemas: summaries });
});

/**
 * GET /schemas/:type — Get full UI schema for a request type
 * Returns the complete schema including sections, fields, and options.
 * Used by DynamicForm to render the form for a specific request type.
 */
router.get('/:type', (req: Request, res: Response) => {
  const { type } = req.params;
  const schema = getUISchema(type);

  if (!schema) {
    return sendNotFound(res, `Schema for type '${type}'`);
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
});

export default router;
