import cron from 'node-cron';
import { query } from '../database/db';
import { updateTrustScore } from '../services/karmaService';

/**
 * Daily canonical trust-score refresh (Sprint 126 / ADR-096, ADR-037, ADR-039).
 *
 * **Why this exists.** `computeTrustScore` is a function of a MOVING window: it counts interactions
 * from the last 12 months and blends recency-weighted feedback (ADR-039). So a stored score decays
 * only if something recomputes it. `updateTrustScore` runs on match completion — which is precisely
 * what a dormant member does not do. Without a scheduled sweep their cached score is frozen at
 * whatever it was the day they stopped participating.
 *
 * That matters because the ADR-095 provider reach gate reads the CACHED value
 * (`COALESCE(ts.score, 0)` in `providerReachService`), not a freshly computed one. A frozen cache
 * therefore keeps dormant providers visible indefinitely, which is the opposite of what the floor
 * is for.
 *
 * **Why it is here and not in cleanup-service.** cleanup-service used to run this at 03:00 with its
 * own `min(100, floor(decayed_karma / 10))` formula — pre-ADR-037 arithmetic that did not decay the
 * real score so much as replace it. Sprint 126 stopped that job writing scores, which removed the
 * wrong formula but also removed the only refresh cadence. Reputation-service owns trust scores and
 * owns the calculator, so the refresh belongs here, using the one canonical function.
 *
 * Runs at 03:30, after the health-metrics job at 02:00 and clear of the demo deploy window.
 */

/** Recalculate every active membership through the canonical ADR-037 calculator. */
export async function refreshAllTrustScores(): Promise<{ evaluated: number; failed: number }> {
  const memberships = await query(
    `SELECT user_id, community_id
     FROM communities.members
     WHERE status = 'active'
     ORDER BY community_id, user_id`,
  );

  let evaluated = 0;
  let failed = 0;
  for (const row of memberships.rows) {
    try {
      // One pair at a time. A single bad pair must not abandon the sweep — a partially refreshed
      // table is strictly better than a wholly stale one.
      await updateTrustScore(row.user_id, row.community_id);
      evaluated += 1;
    } catch (error) {
      failed += 1;
      console.error('Trust score refresh failed for pair', {
        user_id: row.user_id,
        community_id: row.community_id,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return { evaluated, failed };
}

export function initTrustScoreRefresh(): void {
  cron.schedule('30 3 * * *', async () => {
    console.log('=== Starting daily canonical trust-score refresh ===');
    try {
      const { evaluated, failed } = await refreshAllTrustScores();
      console.log(`=== Trust-score refresh complete: ${evaluated} evaluated, ${failed} failed ===`);
    } catch (error) {
      console.error('=== Error in daily trust-score refresh ===');
      console.error(error);
    }
  });

  console.log('✅ Canonical trust-score refresh initialized (runs daily at 3:30 AM)');
}
