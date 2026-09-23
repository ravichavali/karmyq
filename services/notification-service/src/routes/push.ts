import { Router, Request, Response, NextFunction } from 'express';
import { sendPushToUsers } from '../lib/expoPush';
import { internalAuth } from '../middleware/internalAuth';

const router = Router();

// Internal use only. Fail-closed: an unset INTERNAL_SECRET makes this 503, never anonymous
// (BUG-051 — the previous guard passed every request when the secret was unconfigured).
//
// ⚠️ The guard is attached to the ROUTE, not via `router.use`. This router is mounted at
// `/notifications`, so a router-level guard would gate every `/notifications/*` request —
// including the authenticated list, unread-count and preferences routes that fall through to the
// next mount. That was harmless only while INTERNAL_SECRET was unset for this service; arming the
// secret would have turned it into a 403 for every notifications read on the platform.
router.post('/push/send', internalAuth, async (req: Request, res: Response, next: NextFunction) => {
  const { user_ids, title, body, data } = req.body;
  if (!user_ids?.length || !title || !body) {
    return res.status(400).json({ success: false, message: 'user_ids, title, body required', error: 'MISSING_FIELDS' });
  }
  try {
    await sendPushToUsers(user_ids, title, body, data);
    res.json({ success: true, data: {} });
  } catch (err) {
    next(err);
  }
});

export default router;
