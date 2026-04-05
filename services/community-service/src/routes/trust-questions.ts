import { Router, Request, Response } from 'express';
import { query } from '../database/db';

const router = Router();

/**
 * GET /communities/trust-questions
 * Public — returns active questions with choices ordered by display_order
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const result = await query(
      `SELECT
         tq.id, tq.slug, tq.question_text, tq.subtext, tq.display_order,
         json_agg(
           json_build_object(
             'id',            tqc.id,
             'value',         tqc.value,
             'label',         tqc.label,
             'description',   tqc.description,
             'config_delta',  tqc.config_delta,
             'display_order', tqc.display_order
           ) ORDER BY tqc.display_order
         ) AS choices
       FROM communities.trust_questions tq
       LEFT JOIN communities.trust_question_choices tqc ON tqc.question_id = tq.id
       WHERE tq.active = true
       GROUP BY tq.id
       ORDER BY tq.display_order`,
      []
    );
    res.json({ success: true, data: { questions: result.rows } });
  } catch (error: any) {
    (req as any).logger?.error('Error fetching trust questions', error instanceof Error ? error : new Error(String(error)), { service: 'community-service', endpoint: 'GET /communities/trust-questions' });
    res.status(500).json({ success: false, message: 'Failed to fetch trust questions' });
  }
});

/**
 * POST /communities/trust-questions
 * Admin only — create a new trust question
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user) return res.status(401).json({ success: false, message: 'Authentication required' });

    const memberships = user.communities ?? [];
    const isAdmin = user.role === 'admin' || memberships.some((m: any) => m.role === 'admin');
    if (!isAdmin) return res.status(403).json({ success: false, message: 'Admin access required' });

    const { slug, question_text, subtext, display_order } = req.body;
    if (!slug || !question_text || display_order === undefined) {
      return res.status(400).json({ success: false, message: 'slug, question_text, and display_order are required' });
    }

    const result = await query(
      `INSERT INTO communities.trust_questions (slug, question_text, subtext, display_order)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [slug, question_text, subtext ?? null, display_order]
    );
    res.status(201).json({ success: true, data: { question: result.rows[0] } });
  } catch (error: any) {
    (req as any).logger?.error('Error creating trust question', error instanceof Error ? error : new Error(String(error)), { service: 'community-service', endpoint: 'POST /communities/trust-questions' });
    res.status(500).json({ success: false, message: 'Failed to create trust question' });
  }
});

/**
 * PUT /communities/trust-questions/:id
 * Admin only — update a trust question
 */
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user) return res.status(401).json({ success: false, message: 'Authentication required' });

    const memberships = user.communities ?? [];
    const isAdmin = user.role === 'admin' || memberships.some((m: any) => m.role === 'admin');
    if (!isAdmin) return res.status(403).json({ success: false, message: 'Admin access required' });

    const { id } = req.params;
    const { question_text, subtext, display_order, active } = req.body;

    const result = await query(
      `UPDATE communities.trust_questions
       SET
         question_text = COALESCE($1, question_text),
         subtext       = COALESCE($2, subtext),
         display_order = COALESCE($3, display_order),
         active        = COALESCE($4, active),
         updated_at    = NOW()
       WHERE id = $5 RETURNING *`,
      [question_text ?? null, subtext ?? null, display_order ?? null, active ?? null, id]
    );

    if (result.rowCount === 0) return res.status(404).json({ success: false, message: 'Question not found' });
    res.json({ success: true, data: { question: result.rows[0] } });
  } catch (error: any) {
    (req as any).logger?.error('Error updating trust question', error instanceof Error ? error : new Error(String(error)), { service: 'community-service', endpoint: 'PUT /communities/trust-questions/:id' });
    res.status(500).json({ success: false, message: 'Failed to update trust question' });
  }
});

/**
 * DELETE /communities/trust-questions/:id
 * Admin only — deactivate a trust question
 */
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user) return res.status(401).json({ success: false, message: 'Authentication required' });

    const memberships = user.communities ?? [];
    const isAdmin = user.role === 'admin' || memberships.some((m: any) => m.role === 'admin');
    if (!isAdmin) return res.status(403).json({ success: false, message: 'Admin access required' });

    const { id } = req.params;
    const result = await query(
      `UPDATE communities.trust_questions SET active = false, updated_at = NOW() WHERE id = $1 RETURNING id`,
      [id]
    );
    if (result.rowCount === 0) return res.status(404).json({ success: false, message: 'Question not found' });
    res.json({ success: true, message: 'Question deactivated' });
  } catch (error: any) {
    (req as any).logger?.error('Error deactivating trust question', error instanceof Error ? error : new Error(String(error)), { service: 'community-service', endpoint: 'DELETE /communities/trust-questions/:id' });
    res.status(500).json({ success: false, message: 'Failed to deactivate trust question' });
  }
});

/**
 * POST /communities/trust-questions/:id/choices
 * Admin only — add a choice to a question
 */
router.post('/:id/choices', async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user) return res.status(401).json({ success: false, message: 'Authentication required' });

    const memberships = user.communities ?? [];
    const isAdmin = user.role === 'admin' || memberships.some((m: any) => m.role === 'admin');
    if (!isAdmin) return res.status(403).json({ success: false, message: 'Admin access required' });

    const { id: questionId } = req.params;
    const { value, label, description, config_delta, display_order } = req.body;
    if (!value || !label || display_order === undefined) {
      return res.status(400).json({ success: false, message: 'value, label, and display_order are required' });
    }

    const result = await query(
      `INSERT INTO communities.trust_question_choices (question_id, value, label, description, config_delta, display_order)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [questionId, value, label, description ?? null, JSON.stringify(config_delta ?? {}), display_order]
    );
    res.status(201).json({ success: true, data: { choice: result.rows[0] } });
  } catch (error: any) {
    (req as any).logger?.error('Error creating trust question choice', error instanceof Error ? error : new Error(String(error)), { service: 'community-service', endpoint: 'POST /communities/trust-questions/:id/choices' });
    res.status(500).json({ success: false, message: 'Failed to create choice' });
  }
});

/**
 * PUT /communities/trust-questions/:id/choices/:choiceId
 * Admin only — update a choice
 */
router.put('/:id/choices/:choiceId', async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user) return res.status(401).json({ success: false, message: 'Authentication required' });

    const memberships = user.communities ?? [];
    const isAdmin = user.role === 'admin' || memberships.some((m: any) => m.role === 'admin');
    if (!isAdmin) return res.status(403).json({ success: false, message: 'Admin access required' });

    const { choiceId } = req.params;
    const { label, description, config_delta, display_order } = req.body;

    const result = await query(
      `UPDATE communities.trust_question_choices
       SET
         label         = COALESCE($1, label),
         description   = COALESCE($2, description),
         config_delta  = COALESCE($3, config_delta),
         display_order = COALESCE($4, display_order)
       WHERE id = $5 RETURNING *`,
      [label ?? null, description ?? null, config_delta ? JSON.stringify(config_delta) : null, display_order ?? null, choiceId]
    );

    if (result.rowCount === 0) return res.status(404).json({ success: false, message: 'Choice not found' });
    res.json({ success: true, data: { choice: result.rows[0] } });
  } catch (error: any) {
    (req as any).logger?.error('Error updating trust question choice', error instanceof Error ? error : new Error(String(error)), { service: 'community-service', endpoint: 'PUT /communities/trust-questions/:id/choices/:choiceId' });
    res.status(500).json({ success: false, message: 'Failed to update choice' });
  }
});

/**
 * DELETE /communities/trust-questions/:id/choices/:choiceId
 * Admin only — remove a choice
 */
router.delete('/:id/choices/:choiceId', async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user) return res.status(401).json({ success: false, message: 'Authentication required' });

    const memberships = user.communities ?? [];
    const isAdmin = user.role === 'admin' || memberships.some((m: any) => m.role === 'admin');
    if (!isAdmin) return res.status(403).json({ success: false, message: 'Admin access required' });

    const { choiceId } = req.params;
    const result = await query(
      `DELETE FROM communities.trust_question_choices WHERE id = $1 RETURNING id`,
      [choiceId]
    );
    if (result.rowCount === 0) return res.status(404).json({ success: false, message: 'Choice not found' });
    res.json({ success: true, message: 'Choice deleted' });
  } catch (error: any) {
    (req as any).logger?.error('Error deleting trust question choice', error instanceof Error ? error : new Error(String(error)), { service: 'community-service', endpoint: 'DELETE /communities/trust-questions/:id/choices/:choiceId' });
    res.status(500).json({ success: false, message: 'Failed to delete choice' });
  }
});

export default router;
