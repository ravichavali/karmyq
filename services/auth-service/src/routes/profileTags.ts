import { Router, Request, Response } from 'express';
import { authMiddleware } from '@karmyq/shared/middleware';
import { query } from '../database/db';
import { TAG_SUGGESTIONS } from '../constants/tagSuggestions';

const router = Router();

// GET /auth/profile/tags/suggestions?tag_type=skill  (must come before /:tagId)
router.get('/suggestions', authMiddleware, (req: Request, res: Response) => {
  const tag_type = req.query.tag_type as string;
  if (!['skill', 'interest', 'need'].includes(tag_type)) {
    return res.status(400).json({ success: false, message: 'Invalid tag_type' });
  }
  res.json({ success: true, data: TAG_SUGGESTIONS[tag_type as 'skill' | 'interest' | 'need'] });
});

// GET /auth/profile/tags — current user's tags grouped by type
router.get('/', authMiddleware, async (req: Request, res: Response) => {
  const userId = (req as any).user?.userId;
  if (!userId) {
    return res.status(401).json({ success: false, message: 'Authentication required' });
  }
  const result = await query(
    'SELECT id, tag_type, tag_value FROM auth.user_tags WHERE user_id = $1 ORDER BY created_at ASC',
    [userId]
  );
  const grouped: Record<string, Array<{ id: string; tag_value: string }>> = {
    skills: [], interests: [], needs: [],
  };
  for (const row of result.rows) {
    const key = row.tag_type === 'skill' ? 'skills'
               : row.tag_type === 'interest' ? 'interests' : 'needs';
    grouped[key].push({ id: row.id, tag_value: row.tag_value });
  }
  res.json({ success: true, data: grouped });
});

// POST /auth/profile/tags — add a tag
router.post('/', authMiddleware, async (req: Request, res: Response) => {
  const userId = (req as any).user?.userId;
  if (!userId) {
    return res.status(401).json({ success: false, message: 'Authentication required' });
  }
  const { tag_type, tag_value } = req.body;
  if (!['skill', 'interest', 'need'].includes(tag_type)) {
    return res.status(400).json({ success: false, message: 'Invalid tag_type' });
  }
  if (!tag_value?.trim()) {
    return res.status(400).json({ success: false, message: 'tag_value required' });
  }
  const result = await query(
    `INSERT INTO auth.user_tags (user_id, tag_type, tag_value)
     VALUES ($1, $2, $3)
     ON CONFLICT ON CONSTRAINT user_tags_unique DO NOTHING
     RETURNING id, tag_type, tag_value`,
    [userId, tag_type, tag_value.trim()]
  );
  res.json({ success: true, data: result.rows[0] ?? null });
});

// DELETE /auth/profile/tags/:tagId — remove a tag
router.delete('/:tagId', authMiddleware, async (req: Request, res: Response) => {
  const userId = (req as any).user?.userId;
  if (!userId) {
    return res.status(401).json({ success: false, message: 'Authentication required' });
  }
  const { tagId } = req.params;
  await query(
    'DELETE FROM auth.user_tags WHERE id = $1 AND user_id = $2',
    [tagId, userId]
  );
  res.json({ success: true });
});

export default router;
