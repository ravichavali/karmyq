import { Router, Request, Response } from 'express';
import { sendPushToUsers } from '../lib/expoPush';

const router = Router();

// Internal use only — no auth middleware (behind nginx, not exposed externally)
router.post('/push/send', async (req: Request, res: Response) => {
  const { user_ids, title, body, data } = req.body;
  if (!user_ids?.length || !title || !body) {
    return res.status(400).json({ success: false, message: 'user_ids, title, body required' });
  }
  await sendPushToUsers(user_ids, title, body, data);
  res.json({ success: true });
});

export default router;
