import { Router, Response } from 'express';
import { query } from '../database/db';
import { authMiddleware, AuthenticatedRequest } from '@karmyq/shared/middleware/auth';

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

// Internal helper: recalculate and cache provider trust score
// Formula: 60% avg_stars (normalized 0–100) + 30% completion_rate + 10% response_rate
async function recalculateProviderTrustScore(providerId: string): Promise<void> {
  const reviewStats = await query(`
    SELECT
      AVG(stars) as avg_stars,
      COUNT(*) as total_reviews
    FROM reputation.provider_reviews
    WHERE provider_id = $1
  `, [providerId]);

  const stats = reviewStats.rows[0];
  const avgStars = parseFloat(stats.avg_stars) || 0;
  const totalReviews = parseInt(stats.total_reviews) || 0;

  // Fetch completion_rate and response_rate from existing score row (updated by match completion events)
  const existing = await query(
    'SELECT completion_rate, response_rate FROM reputation.provider_trust_scores WHERE provider_id = $1',
    [providerId]
  );
  const completionRate = existing.rows[0]?.completion_rate ?? 0;
  const responseRate = existing.rows[0]?.response_rate ?? 0;

  // Normalize avg_stars from 1–5 to 0–100
  const normalizedStars = totalReviews > 0 ? ((avgStars - 1) / 4) * 100 : 0;
  const trustScore = Math.round(
    normalizedStars * 0.6 + completionRate * 0.3 + responseRate * 0.1
  );

  await query(`
    INSERT INTO reputation.provider_trust_scores
      (provider_id, avg_stars, total_reviews, completion_rate, response_rate, trust_score, last_calculated)
    VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)
    ON CONFLICT (provider_id) DO UPDATE SET
      avg_stars = EXCLUDED.avg_stars,
      total_reviews = EXCLUDED.total_reviews,
      trust_score = EXCLUDED.trust_score,
      last_calculated = EXCLUDED.last_calculated
  `, [providerId, avgStars, totalReviews, completionRate, responseRate, trustScore]);
}

export { recalculateProviderTrustScore };
export default router;
