import { Router, Response } from 'express';
import { query } from '../database/db';
import { authMiddleware, AuthenticatedRequest } from '@karmyq/shared/middleware/auth';
import { recalculateProviderTrustScore, backfillAllProviderTrustScores } from '../services/providerTrustService';

const router = Router();

// POST /reputation/provider-reviews - Submit a review for a provider
router.post('/', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const reviewerId = req.user!.userId;
    const { provider_id, match_id, stars, review_text } = req.body;

    if (!provider_id || !stars) {
      return res.status(400).json({ success: false, message: 'provider_id and stars are required' });
    }
    if (stars < 1 || stars > 5 || !Number.isInteger(stars)) {
      return res.status(400).json({ success: false, message: 'stars must be an integer between 1 and 5' });
    }

    // Verify provider exists
    const providerCheck = await query(
      'SELECT id FROM requests.provider_profiles WHERE id = $1 AND is_active = TRUE',
      [provider_id]
    );
    if (providerCheck.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Provider not found' });
    }

    // Insert review
    const result = await query(`
      INSERT INTO reputation.provider_reviews (provider_id, reviewer_id, match_id, stars, review_text)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `, [provider_id, reviewerId, match_id ?? null, stars, review_text ?? null]);

    // Recalculate and cache provider trust score
    await recalculateProviderTrustScore(provider_id);

    res.status(201).json({ success: true, data: result.rows[0], message: 'Review submitted' });
  } catch (error: any) {
    if (error.code === '23505') {
      return res.status(409).json({ success: false, message: 'You have already reviewed this provider for this match' });
    }
    console.error('Error submitting provider review:', error);
    res.status(500).json({ success: false, message: 'Failed to submit review', error: error.message });
  }
});

// GET /reputation/provider-trust/:providerId - Get provider trust score
router.get('/provider-trust/:providerId', async (req: any, res: Response) => {
  try {
    const { providerId } = req.params;

    const result = await query(`
      SELECT
        pts.*,
        pp.display_name, pp.service_type, pp.user_id
      FROM reputation.provider_trust_scores pts
      JOIN requests.provider_profiles pp ON pts.provider_id = pp.id
      WHERE pts.provider_id = $1
    `, [providerId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Provider trust score not found' });
    }

    res.json({ success: true, data: result.rows[0] });
  } catch (error: any) {
    console.error('Error fetching provider trust score:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch provider trust score', error: error.message });
  }
});

// GET /reputation/provider-reviews/:providerId - List reviews for a provider (public)
router.get('/provider-reviews/:providerId', async (req: any, res: Response) => {
  try {
    const { providerId } = req.params;
    const { limit = 20, offset = 0 } = req.query;

    const result = await query(`
      SELECT
        pr.id, pr.stars, pr.review_text, pr.created_at,
        u.name as reviewer_name
      FROM reputation.provider_reviews pr
      LEFT JOIN auth.users u ON pr.reviewer_id = u.id
      WHERE pr.provider_id = $1
      ORDER BY pr.created_at DESC
      LIMIT $2 OFFSET $3
    `, [providerId, limit, offset]);

    res.json({ success: true, data: result.rows });
  } catch (error: any) {
    console.error('Error fetching provider reviews:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch provider reviews', error: error.message });
  }
});

// POST /reputation/provider-trust/recalculate - Admin: backfill all provider trust scores
// Recalculates completion_rate from historical matches and recomputes trust_score for
// every active provider. Safe to run multiple times — idempotent.
router.post('/provider-trust/recalculate', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = req.user!;
    const memberships = user.communities ?? [];
    const isAdmin = (user as any).role === 'admin' || memberships.some((m: any) => m.role === 'admin');

    if (!isAdmin) {
      return res.status(403).json({ success: false, message: 'Admin access required' });
    }

    const updated = await backfillAllProviderTrustScores();

    res.json({
      success: true,
      data: { updated },
      message: `Recalculated trust scores for ${updated} providers`,
    });
  } catch (error: any) {
    console.error('Error running provider trust score backfill:', error);
    res.status(500).json({ success: false, message: 'Backfill failed', error: error.message });
  }
});

export { recalculateProviderTrustScore };
export default router;
