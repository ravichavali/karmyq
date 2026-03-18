/**
 * Provider Trust Score Service (ADR-042)
 *
 * Single source of truth for provider trust score calculation.
 * Formula: 60% avg_stars_normalized + 30% completion_rate + 10% response_rate
 *
 * Called by:
 * - providerReviews route: when a new review is submitted
 * - event subscriber: when a match_completed event fires (updates completion_rate)
 * - backfill endpoint: one-time recalculation for existing providers
 */

import { query } from '../database/db';

/**
 * Recalculate and persist provider trust score from current DB data.
 * Reads avg_stars from provider_reviews, reads completion_rate/response_rate
 * from the existing provider_trust_scores row.
 */
export async function recalculateProviderTrustScore(providerId: string): Promise<void> {
  // Aggregate current review data
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

  // Read behavioral metrics (managed by match completion events)
  const metricsResult = await query(
    'SELECT completion_rate, response_rate FROM reputation.provider_trust_scores WHERE provider_id = $1',
    [providerId]
  );
  const completionRate = parseFloat(metricsResult.rows[0]?.completion_rate) || 0;
  const responseRate = parseFloat(metricsResult.rows[0]?.response_rate) || 0;

  // Normalize avg_stars from 1–5 to 0–100 (0 if no reviews — cold-start protection)
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

/**
 * Update completion_rate for all provider profiles belonging to a user,
 * then trigger a full trust score recalculation for each.
 * Called after match_completed events.
 */
export async function updateProviderCompletionRate(userId: string): Promise<void> {
  const profileResult = await query(
    `SELECT id FROM requests.provider_profiles WHERE user_id = $1 AND is_active = TRUE`,
    [userId]
  );

  if (profileResult.rowCount === 0) return; // user is not a registered provider

  for (const { id: provider_id } of profileResult.rows) {
    // Count accepted and completed matches where this user was the responder
    const statsResult = await query(
      `SELECT
         COUNT(*) FILTER (WHERE status IN ('accepted', 'completed')) AS accepted_matches,
         COUNT(*) FILTER (WHERE status = 'completed') AS completed_matches
       FROM requests.matches
       WHERE responder_id = $1`,
      [userId]
    );

    const { accepted_matches, completed_matches } = statsResult.rows[0];
    const accepted = parseInt(accepted_matches) || 0;
    const completed = parseInt(completed_matches) || 0;
    const completion_rate = accepted > 0
      ? parseFloat(((completed / accepted) * 100).toFixed(2))
      : 0;

    // Upsert completion_rate only (avg_stars and response_rate are managed separately)
    await query(
      `INSERT INTO reputation.provider_trust_scores (provider_id, completion_rate, last_calculated)
       VALUES ($1, $2, CURRENT_TIMESTAMP)
       ON CONFLICT (provider_id) DO UPDATE SET
         completion_rate = $2,
         last_calculated = CURRENT_TIMESTAMP`,
      [provider_id, completion_rate]
    );

    // Recompute trust_score using the single authoritative formula
    await recalculateProviderTrustScore(provider_id);

    console.log(`✅ Provider trust score updated: provider=${provider_id} completion_rate=${completion_rate}%`);
  }
}

/**
 * Backfill trust scores for all active providers from historical data.
 * Intended for one-time use after deploying this service or fixing the formula.
 * Returns the count of providers updated.
 */
export async function backfillAllProviderTrustScores(): Promise<number> {
  const providers = await query(
    `SELECT pp.id, pp.user_id
     FROM requests.provider_profiles pp
     WHERE pp.is_active = TRUE`
  );

  let updated = 0;
  for (const { id: provider_id, user_id } of providers.rows) {
    // Recalculate completion_rate from historical match data
    const statsResult = await query(
      `SELECT
         COUNT(*) FILTER (WHERE status IN ('accepted', 'completed')) AS accepted_matches,
         COUNT(*) FILTER (WHERE status = 'completed') AS completed_matches
       FROM requests.matches
       WHERE responder_id = $1`,
      [user_id]
    );

    const { accepted_matches, completed_matches } = statsResult.rows[0];
    const accepted = parseInt(accepted_matches) || 0;
    const completed = parseInt(completed_matches) || 0;
    const completion_rate = accepted > 0
      ? parseFloat(((completed / accepted) * 100).toFixed(2))
      : 0;

    // Ensure a trust score row exists and has correct completion_rate
    await query(
      `INSERT INTO reputation.provider_trust_scores (provider_id, completion_rate, last_calculated)
       VALUES ($1, $2, CURRENT_TIMESTAMP)
       ON CONFLICT (provider_id) DO UPDATE SET
         completion_rate = $2,
         last_calculated = CURRENT_TIMESTAMP`,
      [provider_id, completion_rate]
    );

    await recalculateProviderTrustScore(provider_id);
    updated++;
  }

  return updated;
}
