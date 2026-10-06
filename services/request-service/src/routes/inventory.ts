import { Router, Request, Response, NextFunction } from 'express';
import { sendSuccess, sendError } from '@karmyq/shared/utils/response';
import * as inventory from '../db/inventoryDb';
import { publishEvent } from '../events/publisher';

const router = Router();
const categories = [
  'tools',
  'electronics',
  'kitchen',
  'books',
  'sports',
  'camping',
  'party',
  'other',
];
const conditions = ['fair', 'good', 'like_new', 'new'];
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
type CallerRequest = Request & { user?: { userId: string } };
const invalid = (message: string): never => {
  throw new inventory.InventoryError(400, 'VALIDATION_ERROR', message);
};
const validId = (value: unknown): string =>
  typeof value === 'string' && uuid.test(value) ? value : invalid('A valid UUID is required');
function parseItem(body: unknown, create: boolean): inventory.ItemInput | inventory.ItemPatch {
  if (!body || typeof body !== 'object' || Array.isArray(body))
    invalid('An item object is required');
  const b = body as Record<string, unknown>;
  const allowed = [
    'name',
    'description',
    'category',
    'condition',
    ...(create ? ['owner_community_id'] : ['status']),
  ];
  if (Object.keys(b).some((k) => !allowed.includes(k))) invalid('Unsupported item field');
  if (!create && Object.keys(b).length === 0) invalid('At least one item field is required');
  const out: Record<string, unknown> = {};
  if (create || Object.prototype.hasOwnProperty.call(b, 'name')) {
    if (typeof b.name !== 'string' || !b.name.trim() || b.name.trim().length > 120)
      invalid('Name must be 1–120 characters');
    out.name = (b.name as string).trim();
  }
  if (Object.prototype.hasOwnProperty.call(b, 'description')) {
    if (
      b.description !== null &&
      (typeof b.description !== 'string' || b.description.length > 2000)
    )
      invalid('Description must be at most 2000 characters');
    out.description = b.description;
  }
  if (create || Object.prototype.hasOwnProperty.call(b, 'category')) {
    if (typeof b.category !== 'string' || !categories.includes(b.category))
      invalid('Invalid item category');
    out.category = b.category;
  }
  if (Object.prototype.hasOwnProperty.call(b, 'condition')) {
    if (
      b.condition !== null &&
      (typeof b.condition !== 'string' || !conditions.includes(b.condition))
    )
      invalid('Invalid item condition');
    out.condition = b.condition;
  }
  if (Object.prototype.hasOwnProperty.call(b, 'status')) {
    if (!['available', 'unavailable'].includes(b.status as string)) invalid('Invalid item status');
    out.status = b.status;
  }
  if (Object.prototype.hasOwnProperty.call(b, 'owner_community_id'))
    out.owner_community_id = validId(b.owner_community_id);
  return out as unknown as inventory.ItemInput | inventory.ItemPatch;
}

function handler(action: (req: CallerRequest, res: Response, userId: string) => Promise<void>) {
  return async (req: CallerRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user?.userId) {
        sendError(res, 'UNAUTHORIZED', 'Authentication required', 401);
        return;
      }
      await action(req, res, req.user.userId);
    } catch (error) {
      if (error instanceof inventory.InventoryError) {
        sendError(res, error.code, error.message, error.status);
        return;
      }
      next(error);
    }
  };
}
router.get(
  '/mine',
  handler(async (_req, res, userId) => {
    sendSuccess(res, { items: await inventory.listMine(userId) });
  })
);
router.get('/asks/incoming', handler(async (_req, res, userId) => {
  sendSuccess(res, { asks: await inventory.listIncomingAsks(userId) });
}));
router.post('/items/:id/borrow', handler(async (req, res, userId) => {
  const itemId = validId(req.params.id);
  const b = req.body;
  if (!b || typeof b !== 'object' || Array.isArray(b) || Object.keys(b).some((k) => !['community_id','duration_days','return_date','description'].includes(k))) invalid('Unsupported borrow fields');
  const community_id = validId(b.community_id);
  if (!Number.isInteger(b.duration_days) || b.duration_days < 1 || b.duration_days > 30) invalid('Duration must be 1–30 days');
  if (b.description !== undefined && (typeof b.description !== 'string' || b.description.length > 2000)) invalid('Note must be at most 2000 characters');
  if (b.return_date !== undefined && (typeof b.return_date !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/.test(b.return_date) || !Number.isFinite(Date.parse(b.return_date)))) invalid('Return date must be an ISO UTC datetime');
  // Date.parse normalizes calendar overflow (e.g. February 30); the borrow schema rejects it.
  if (b.return_date !== undefined && new Date(b.return_date).toISOString().slice(0, 19) !== b.return_date.slice(0, 19)) invalid('Return date must be a real calendar datetime');
  const { ask, event } = await inventory.createBorrow(itemId, userId, { ...b, community_id });
  if (event) {
    try {
      await publishEvent('directed_request_created', event);
      await inventory.markDirectedNotificationPublished(ask.id);
    } catch (error) {
      // The ask and its delivery intent are committed. The outbox relay retries; return its ID
      // so a queue outage never tells the requester that their successful save failed.
      (req as any).logger?.error('Directed notification pending retry', error instanceof Error ? error : new Error(String(error)), { service: 'request-service', request_id: ask.id });
    }
  }
  sendSuccess(res, ask, 201);
}));
router.get(
  '/community/:communityId',
  handler(async (req, res, userId) => {
    const id = validId(req.params.communityId);
    if (!(await inventory.isActiveMember(id, userId)))
      throw new inventory.InventoryError(403, 'FORBIDDEN', 'Active community membership required');
    sendSuccess(res, await inventory.listForCommunity(id, userId));
  })
);
router.get(
  '/items/:id',
  handler(async (req, res, userId) => {
    const item = await inventory.getVisible(validId(req.params.id), userId);
    if (!item) throw new inventory.InventoryError(404, 'NOT_FOUND', 'Item not found');
    sendSuccess(res, item);
  })
);
router.post(
  '/items',
  handler(async (req, res, userId) => {
    sendSuccess(
      res,
      await inventory.create(userId, parseItem(req.body, true) as inventory.ItemInput),
      201
    );
  })
);
router.patch(
  '/items/:id',
  handler(async (req, res, userId) => {
    const patch = parseItem(req.body, false) as inventory.ItemPatch;
    sendSuccess(res, await inventory.update(validId(req.params.id), userId, patch));
  })
);
router.delete(
  '/items/:id',
  handler(async (req, res, userId) => {
    await inventory.remove(validId(req.params.id), userId);
    sendSuccess(res, { deleted: true });
  })
);
router.put(
  '/items/:id/shares',
  handler(async (req, res, userId) => {
    const body = req.body;
    if (
      !body ||
      typeof body !== 'object' ||
      Array.isArray(body) ||
      Object.keys(body).some((k) => k !== 'community_ids')
    )
      invalid('A community_ids array is required');
    const ids = body.community_ids;
    if (
      !Array.isArray(ids) ||
      ids.length > 50 ||
      ids.some((id) => typeof id !== 'string' || !uuid.test(id))
    )
      invalid('Share with at most 50 unique community UUIDs');
    const normalized = ids.map((id: string) => id.toLowerCase());
    if (new Set(normalized).size !== ids.length) invalid('Community ids must be unique');
    sendSuccess(res, {
      shared_with: await inventory.replaceShares(validId(req.params.id), userId, normalized),
    });
  })
);
export default router;
