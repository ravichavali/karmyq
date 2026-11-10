/**
 * Provider Trust Score Service (ADR-042)
 *
 * Single source of truth for provider trust score calculation.
 * Formula: 60% avg_stars_normalized + 30% completion_rate + 10% response_rate
 *
 * Called by:
 * - providerReviews route: when a new review is submitted
 * - event subscriber: when a match_completed event fires (updates completion_rate)
 * - backfill endpoint: manual, fail-fast recalculation for every active provider
 * - the 03:30 job (cron/trustScoreRefresh.ts): nightly sweep, so a cancellation — which triggers no
 *   refresh of its own — is reflected by the next successful run (Sprint 139)
 *
 * completion_rate = completed / (completed + cancelled) over the responder's matches (BUG-080).
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
 * Completion rate from a responder's match history (ADR-042, amended Sprint 139 / BUG-080):
 * completed / (completed + cancelled), as a percentage rounded to two decimals, 0 with no terminal
 * outcome yet. Ongoing (proposed, matched) and every other status (rejected, declined, legacy
 * 'accepted') are ignored. A cancellation counts whoever cancelled: the data records no fault, so
 * this is an outcome ratio, not a blame score. The scope is the responder, so every active profile
 * a user owns gets the same rate.
 */
async function readProviderCompletionRate(userId: string): Promise<number> {
  const statsResult = await query(
    `SELECT
       COUNT(*) FILTER (WHERE status = 'completed') AS completed_matches,
       COUNT(*) FILTER (WHERE status IN ('completed', 'cancelled')) AS terminal_matches
     FROM requests.matches
     WHERE responder_id = $1`,
    [userId]
  );

  const completed = parseInt(statsResult.rows[0]?.completed_matches) || 0;
  const terminalMatches = parseInt(statsResult.rows[0]?.terminal_matches) || 0;
  return terminalMatches > 0
    ? parseFloat(((completed / terminalMatches) * 100).toFixed(2))
    : 0;
}

/**
 * Refresh one provider profile: store its owner's completion rate, then recompute the trust score
 * through the one authoritative formula. Shared by every refresh path (completion, manual
 * backfill, nightly sweep). Returns the stored completion rate.
 */
async function refreshProviderTrustScore(providerId: string, userId: string): Promise<number> {
  const completion_rate = await readProviderCompletionRate(userId);

  // Upsert completion_rate only (avg_stars and response_rate are managed separately)
  await query(
    `INSERT INTO reputation.provider_trust_scores (provider_id, completion_rate, last_calculated)
     VALUES ($1, $2, CURRENT_TIMESTAMP)
     ON CONFLICT (provider_id) DO UPDATE SET
       completion_rate = $2,
       last_calculated = CURRENT_TIMESTAMP`,
    [providerId, completion_rate]
  );

  await recalculateProviderTrustScore(providerId);
  return completion_rate;
}

/** Every active provider profile and its owner. Not filtered by community membership. */
const ACTIVE_PROVIDERS_SQL = `SELECT pp.id, pp.user_id
     FROM requests.provider_profiles pp
     WHERE pp.is_active = TRUE
     ORDER BY pp.id`;

/**
 * Refresh every active provider profile belonging to a user.
 * Called after match_completed events.
 */
export async function updateProviderCompletionRate(userId: string): Promise<void> {
  const profileResult = await query(
    `SELECT id FROM requests.provider_profiles WHERE user_id = $1 AND is_active = TRUE`,
    [userId]
  );

  if (profileResult.rowCount === 0) return; // user is not a registered provider

  for (const { id: provider_id } of profileResult.rows) {
    const completion_rate = await refreshProviderTrustScore(provider_id, userId);
    console.log(`✅ Provider trust score updated: provider=${provider_id} completion_rate=${completion_rate}%`);
  }
}

/**
 * Backfill trust scores for all active providers from historical data (the manual admin endpoint).
 * Fail-fast: the first provider that fails rejects the whole call. Returns the count updated.
 */
export async function backfillAllProviderTrustScores(): Promise<number> {
  const providers = await query(ACTIVE_PROVIDERS_SQL);

  let updated = 0;
  for (const { id: provider_id, user_id } of providers.rows) {
    await refreshProviderTrustScore(provider_id, user_id);
    updated++;
  }

  return updated;
}

/**
 * The nightly provider sweep (Sprint 139, approved decision 7), run by the existing 03:30 job.
 *
 * Completion refreshes a provider at once; a cancellation triggers nothing, so without this a
 * provider who cancels and never completes again would keep a stale, too-high rate forever. Walks
 * every active profile one at a time; a failing profile is logged and counted and the sweep goes
 * on. Failing to ENUMERATE rejects, so zero work is never reported as a healthy sweep.
 */
export async function refreshAllProviderTrustScores(): Promise<{ evaluated: number; failed: number }> {
  const providers = await query(ACTIVE_PROVIDERS_SQL);

  let evaluated = 0;
  let failed = 0;
  for (const { id: provider_id, user_id } of providers.rows) {
    try {
      await refreshProviderTrustScore(provider_id, user_id);
      evaluated += 1;
    } catch (error) {
      failed += 1;
      console.error('Provider trust refresh failed for profile', {
        provider_id,
        user_id,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return { evaluated, failed };
}
