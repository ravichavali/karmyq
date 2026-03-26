import { Router, Request, Response, NextFunction } from 'express';
import { sendPushToUsers } from '../lib/expoPush';

const router = Router();

// Internal use only — require X-Internal-Secret header to prevent external callers
router.use((req: Request, res: Response, next: NextFunction) => {
  const secret = process.env.INTERNAL_SECRET;
  if (secret && req.headers['x-internal-secret'] !== secret) {
    return res.status(403).json({ success: false, message: 'Forbidden', error: 'FORBIDDEN' });
  }
  next();
});

router.post('/push/send', async (req: Request, res: Response, next: NextFunction) => {
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
