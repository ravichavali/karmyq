import { Router, Request, Response } from 'express';
import { authMiddleware } from '@karmyq/shared/middleware';
import { query, withTransaction } from '../database/db';
import { publishEndorsementChanged } from '../events/endorsementEvents';
import { TAG_SUGGESTIONS } from '../constants/tagSuggestions';
import { listSkillSuggestions, resolveSkillSlug } from '../services/skillVocabulary';

const router = Router();

// GET /auth/profile/tags/suggestions?tag_type=skill  (must come before /:tagId)
router.get('/suggestions', authMiddleware, async (req: Request, res: Response) => {
  const tag_type = req.query.tag_type as string;
  if (!['skill', 'interest', 'need'].includes(tag_type)) {
    return res.status(400).json({ success: false, message: 'Invalid tag_type' });
  }
  const suggestions = tag_type === 'skill'
    ? await listSkillSuggestions()
    : TAG_SUGGESTIONS[tag_type as 'interest' | 'need'];
  res.json({ success: true, data: suggestions });
});

// GET /auth/profile/tags — current user's tags grouped by type
router.get('/', authMiddleware, async (req: Request, res: Response) => {
  const userId = (req as any).user?.userId;
  if (!userId) {
    return res.status(401).json({ success: false, message: 'Authentication required' });
  }
  const result = await query(
    'SELECT id, tag_type, tag_value, skill_slug FROM auth.user_tags WHERE user_id = $1 ORDER BY created_at ASC',
    [userId]
  );
  const grouped: Record<string, Array<{ id: string; tag_value: string; skill_slug: string | null }>> = {
    skills: [], interests: [], needs: [],
  };
  for (const row of result.rows) {
    const key = row.tag_type === 'skill' ? 'skills'
               : row.tag_type === 'interest' ? 'interests' : 'needs';
    grouped[key].push({ id: row.id, tag_value: row.tag_value, skill_slug: row.skill_slug });
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
  if (typeof tag_value !== 'string' || !tag_value.trim()) {
    return res.status(400).json({ success: false, message: 'tag_value required' });
  }
  const skillSlug = tag_type === 'skill' ? await resolveSkillSlug(tag_value) : null;
  const result = await query(
    `INSERT INTO auth.user_tags (user_id, tag_type, tag_value, skill_slug)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT ON CONSTRAINT user_tags_unique DO NOTHING
     RETURNING id, tag_type, tag_value, skill_slug`,
    [userId, tag_type, tag_value.trim(), skillSlug]
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
  // ADR-100: deleting a skill cascades its endorsements, an endorsement change for every endorser. Lock
  // the tag (a concurrent new endorse's FK check waits) and EVERY endorsement row, withdrawn ones included
  // (a concurrent revive is an UPDATE that takes no FK lock), then publish one event per row after COMMIT.
  // Reconcile is idempotent, so an event for a row that was already withdrawn is harmless.
  let cascaded: Array<{ id: string; endorser_id: string }>;
  try {
    cascaded = await withTransaction(async q => {
      const tag = await q('SELECT id FROM auth.user_tags WHERE id = $1 AND user_id = $2 FOR UPDATE', [tagId, userId]);
      if (!tag.rows.length) return [];
      const active = (await q(
        'SELECT id, endorser_id FROM auth.skill_endorsements WHERE user_tag_id = $1 FOR UPDATE', [tagId])).rows;
      await q('DELETE FROM auth.user_tags WHERE id = $1 AND user_id = $2', [tagId, userId]);
      return active;
    });
  } catch (error) {
    (req as any).logger?.error('Failed to delete tag', error instanceof Error ? error : new Error(String(error)), { userId });
    return res.status(500).json({ success: false, message: 'Failed to delete tag', error: 'INTERNAL_ERROR' });
  }
  await Promise.all(cascaded.map(row =>
    publishEndorsementChanged({ rowId: row.id, revision: 'deleted', endorser_id: row.endorser_id, endorsee_id: userId })));
  res.json({ success: true });
});

export default router;
