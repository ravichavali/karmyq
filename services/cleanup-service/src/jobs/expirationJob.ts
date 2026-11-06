import pool, { query } from '../database/db';
import { logger } from '../utils/logger';

/**
 * Expiration Job
 * Marks expired data as expired (soft delete)
 * Runs every hour
 */

export async function markExpiredData(): Promise<void> {
  logger.info('Starting expiration job');

  try {
    const now = new Date().toISOString();
    let totalExpired = 0;

    // Mark expired help requests
    const requests = await query(
      `UPDATE requests.help_requests
       SET expired = TRUE, updated_at = CURRENT_TIMESTAMP
       WHERE expires_at <= $1 AND expired = FALSE AND status = 'open'
       RETURNING id`,
      [now]
    );
    logger.info(`Marked ${requests.rowCount} help requests as expired`);
    totalExpired += requests.rowCount || 0;

    // Mark expired help offers
    const offers = await query(
      `UPDATE requests.help_offers
       SET expired = TRUE, updated_at = CURRENT_TIMESTAMP
       WHERE expires_at <= $1 AND expired = FALSE AND status = 'active'
       RETURNING id`,
      [now]
    );
    logger.info(`Marked ${offers.rowCount} help offers as expired`);
    totalExpired += offers.rowCount || 0;

    // Mark expired messages
    const messages = await query(
      `UPDATE messaging.messages
       SET expired = TRUE
       WHERE expires_at <= $1 AND expired = FALSE
       RETURNING id`,
      [now]
    );
    logger.info(`Marked ${messages.rowCount} messages as expired`);
    totalExpired += messages.rowCount || 0;

    // Mark expired notifications
    const notifications = await query(
      `UPDATE notifications.notifications
       SET expired = TRUE
       WHERE expires_at <= $1 AND expired = FALSE
       RETURNING id`,
      [now]
    );
    logger.info(`Marked ${notifications.rowCount} notifications as expired`);
    totalExpired += notifications.rowCount || 0;

    try {
      await releaseExpiredHolds();
    } catch (releaseError) {
      logger.error('Failed to release expired holds; expiry flags already committed', { error: releaseError });
      throw releaseError;
    }

    logger.info(`Expiration job completed: ${totalExpired} items marked as expired`);
  } catch (error) {
    logger.error('Error in expiration job', { error });
    throw error;
  }
}

/**
 * BUG-088 (Sprint 137): release what an expired ask held.
 * D1. Each flagged open ask with a proposal, in its own transaction: lock the ask, free each offer a proposal holds
 *     (only while 'matched', so a withdrawn offer stays withdrawn, and only when no other match still holds it, since
 *     BUG-089 let one offer back several), then reject the proposals. Text for text request-service's closeProposals
 *     (src/db/requestStatus.ts); keep the two in step. Writes no help_requests row, so the hard-delete clock and the
 *     derived status are unchanged (proposals don't count in the derivation).
 * D2. One statement frees offers still 'matched' that no proposed, matched or completed match references (a past
 *     hard delete cascaded the proposal away). Both frees compare the target CTID to a distinct scalar snapshot scan:
 *     an intervening release/re-hold or metadata version change defers release (spec B5, I1). CTID is statement-local,
 *     never persisted identity. B4's gated active-to-matched hold invariant alone does not exclude the re-hold cycle.
 * Lock order: D1 request → offers → matches, as accept's closeProposals; D2 only the offer rows it updates.
 * Checked 2026-11-05 against matches.ts: complete (`UPDATE ... WHERE id = $1 AND status = 'matched'`) and cancel
 * (same guard) lock only a 'matched' row, never a 'proposed' one, so D1's proposed-row update waits on neither. Cancel
 * takes match, then request, then the offer last, and no help_offers writer holds an offer lock and then waits on the
 * request lock (Sprint 136's request-followups header lists the writers), so D1's request-then-offer order cannot
 * deadlock against them.
 */
export async function releaseExpiredHolds(): Promise<{ asksReleased: number; proposalsClosed: number; strandedOffersFreed: number }> {
  let asksReleased = 0, proposalsClosed = 0;

  const asks = await query(
    `SELECT h.id FROM requests.help_requests h
      WHERE h.expired = TRUE AND h.status = 'open'
        AND EXISTS (SELECT 1 FROM requests.matches m WHERE m.request_id = h.id AND m.status = 'proposed')`
  );
  for (const { id } of asks.rows) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const locked = await client.query(
        `SELECT id FROM requests.help_requests WHERE id = $1 AND expired = TRUE AND status = 'open' FOR UPDATE`, [id]);
      if (locked.rowCount === 0) { await client.query('ROLLBACK'); continue; }
      // Keep this SQL text for text with request-service/src/db/requestStatus.ts's closeProposals offer release.
      await client.query(
        `UPDATE requests.help_offers o SET status = 'active', updated_at = CURRENT_TIMESTAMP
     WHERE o.status = 'matched'
       AND o.id IN (SELECT offer_id FROM requests.matches
                     WHERE request_id = $1 AND status = 'proposed' AND offer_id IS NOT NULL)
       AND NOT EXISTS (SELECT 1 FROM requests.matches m
                        WHERE m.offer_id = o.id AND m.status IN ('proposed', 'matched', 'completed')
                          AND NOT (m.request_id = $1 AND m.status = 'proposed'))
       AND o.ctid = (SELECT visible_offer.ctid FROM requests.help_offers visible_offer WHERE visible_offer.id = o.id)`, [id]);
      const closed = await client.query(
        `UPDATE requests.matches SET status = 'rejected', updated_at = CURRENT_TIMESTAMP
          WHERE request_id = $1 AND status = 'proposed'`, [id]);
      await client.query('COMMIT');
      asksReleased++;
      proposalsClosed += closed.rowCount ?? 0;
    } catch (error) {
      await client.query('ROLLBACK').catch(() => undefined);
      logger.error('Failed to release an expired ask', { request_id: id, error });
    } finally {
      client.release();
    }
  }

  // Keep this predicate in step with request-service/src/db/requestStatus.ts's releaseOffer (D2 mirrors it).
  const stranded = await query(
    `UPDATE requests.help_offers o SET status = 'active', updated_at = CURRENT_TIMESTAMP
      WHERE o.status = 'matched'
        AND NOT EXISTS (SELECT 1 FROM requests.matches m
                         WHERE m.offer_id = o.id AND m.status IN ('proposed', 'matched', 'completed'))
        AND o.ctid = (SELECT visible_offer.ctid FROM requests.help_offers visible_offer WHERE visible_offer.id = o.id)`
  );
  const strandedOffersFreed = stranded.rowCount ?? 0;

  logger.info('Released expired holds', { asksReleased, proposalsClosed, strandedOffersFreed });
  return { asksReleased, proposalsClosed, strandedOffersFreed };
}

/**
 * Hard Delete Job
 * Permanently deletes data that has been marked expired for > 7 days
 * Runs once daily
 */
export async function hardDeleteExpiredData(): Promise<void> {
  logger.info('Starting hard delete job');

  try {
    const deleteThreshold = new Date();
    deleteThreshold.setDate(deleteThreshold.getDate() - 7); // 7 days grace period
    const threshold = deleteThreshold.toISOString();

    let totalDeleted = 0;

    // Delete old expired help requests
    const requests = await query(
      `DELETE FROM requests.help_requests
       WHERE expired = TRUE AND updated_at <= $1
       RETURNING id`,
      [threshold]
    );
    logger.info(`Permanently deleted ${requests.rowCount} expired help requests`);
    totalDeleted += requests.rowCount || 0;

    // Delete old expired help offers
    const offers = await query(
      `DELETE FROM requests.help_offers
       WHERE expired = TRUE AND updated_at <= $1
       RETURNING id`,
      [threshold]
    );
    logger.info(`Permanently deleted ${offers.rowCount} expired help offers`);
    totalDeleted += offers.rowCount || 0;

    // Delete old expired messages
    const messages = await query(
      `DELETE FROM messaging.messages
       WHERE expired = TRUE AND created_at <= $1
       RETURNING id`,
      [threshold]
    );
    logger.info(`Permanently deleted ${messages.rowCount} expired messages`);
    totalDeleted += messages.rowCount || 0;

    // Delete old expired notifications
    const notifications = await query(
      `DELETE FROM notifications.notifications
       WHERE expired = TRUE AND created_at <= $1
       RETURNING id`,
      [threshold]
    );
    logger.info(`Permanently deleted ${notifications.rowCount} expired notifications`);
    totalDeleted += notifications.rowCount || 0;

    logger.info(`Hard delete job completed: ${totalDeleted} items permanently deleted`);
  } catch (error) {
    logger.error('Error in hard delete job', { error });
    throw error;
  }
}

/**
 * Batch delete with progress logging
 * For very large datasets, delete in batches to avoid long locks
 */
export const ALLOWED_CLEANUP_TABLES = new Set([
  'requests.help_requests',
  'requests.help_offers',
  'messaging.messages',
  'notifications.notifications',
]);

export async function batchHardDelete(
  table: string,
  batchSize: number = 1000
): Promise<number> {
  if (!ALLOWED_CLEANUP_TABLES.has(table)) {
    throw new Error(`batchHardDelete: table '${table}' is not in the allowed list`);
  }
  const deleteThreshold = new Date();
  deleteThreshold.setDate(deleteThreshold.getDate() - 7);
  const threshold = deleteThreshold.toISOString();

  let totalDeleted = 0;
  let batchDeleted: number;

  do {
    const result = await query(
      `DELETE FROM ${table}
       WHERE id IN (
         SELECT id FROM ${table}
         WHERE expired = TRUE AND updated_at <= $1
         LIMIT $2
       )
       RETURNING id`,
      [threshold, batchSize]
    );

    batchDeleted = result.rowCount || 0;
    totalDeleted += batchDeleted;

    if (batchDeleted > 0) {
      logger.info(`Batch deleted ${batchDeleted} from ${table}, total: ${totalDeleted}`);
    }
  } while (batchDeleted === batchSize);

  return totalDeleted;
}
