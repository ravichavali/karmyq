import { query } from '../database/db';
import { logger } from '../utils/logger';

/**
 * Reputation Decay Job
 * Updates trust scores based on time-based karma decay
 * Runs once daily
 */

export async function updateDecayedTrustScores(): Promise<void> {
  // Sprint 126 (ADR-096): this job no longer writes trust scores, and must not.
  //
  // It used to overwrite reputation.trust_scores.score with `min(100, floor(decayed_karma / 10))`
  // — a pre-ADR-037 formula that predates the multi-signal model entirely. ADR-039 §Phase 2 moved
  // decay INTO the canonical calculator: `updateTrustScore()` already weights interactions by a
  // 12-month recency window and blends recency-weighted feedback, so a second, simpler formula
  // running nightly does not add decay, it discards the real score.
  //
  // This was harmless only because reputation.trust_scores held ZERO rows platform-wide (BUG-037 —
  // the live karma writer had been throwing 42703 since Sprint 62), so the job selected nothing
  // every night. The moment Sprint 126's backfill populates that table, this job would overwrite
  // every score it wrote within 24 hours and re-empty ADR-095's provider reach gate. Found by the
  // Sprint 126 /code-review gate.
  //
  // Trust scores are owned by reputation-service. Karma decay itself (ADR-011) is unaffected — it
  // is computed at read time from karma_records timestamps, not stored here.
  logger.info(
    'Reputation decay job is a no-op: trust scores are maintained by reputation-service ' +
      '(ADR-037/ADR-039/ADR-096). This job no longer writes reputation.trust_scores.',
  );
}

/**
 * Clean up old activity logs (keep last 90 days)
 */
export async function cleanupActivityLogs(): Promise<void> {
  logger.info('Starting activity log cleanup');

  try {
    const threshold = new Date();
    threshold.setDate(threshold.getDate() - 90); // Keep 90 days

    const result = await query(
      `DELETE FROM reputation.activity_log
       WHERE created_at <= $1
       RETURNING id`,
      [threshold.toISOString()]
    );

    logger.info(`Deleted ${result.rowCount} old activity log entries`);
  } catch (error) {
    logger.error('Error cleaning up activity logs', { error });
    throw error;
  }
}

/**
 * Generate reputation decay report
 * Shows communities with highest decay rates
 */
export async function generateDecayReport(): Promise<void> {
  logger.info('Generating reputation decay report');

  try {
    const report = await query(
      `SELECT
        c.id as community_id,
        c.name as community_name,
        COUNT(ts.id) as total_users,
        AVG(EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - ts.last_activity_at)) / (30.44 * 24 * 60 * 60)) as avg_months_inactive,
        SUM(CASE WHEN ts.last_activity_at < CURRENT_TIMESTAMP - INTERVAL '6 months' THEN 1 ELSE 0 END) as inactive_6mo,
        SUM(CASE WHEN ts.last_activity_at < CURRENT_TIMESTAMP - INTERVAL '12 months' THEN 1 ELSE 0 END) as inactive_12mo,
        cs.reputation_half_life_months
       FROM communities.communities c
       JOIN reputation.trust_scores ts ON c.id = ts.community_id
       JOIN communities.settings cs ON c.id = cs.community_id
       GROUP BY c.id, c.name, cs.reputation_half_life_months
       ORDER BY avg_months_inactive DESC`
    );

    logger.info('Reputation Decay Report', {
      communities: report.rows.map((r) => ({
        community: r.community_name,
        total_users: parseInt(r.total_users),
        avg_months_inactive: parseFloat(r.avg_months_inactive).toFixed(2),
        inactive_6mo: parseInt(r.inactive_6mo),
        inactive_12mo: parseInt(r.inactive_12mo),
        half_life_months: r.reputation_half_life_months,
      })),
    });
  } catch (error) {
    logger.error('Error generating decay report', { error });
  }
}
