import { query } from '../database/db';
import { logger } from '../utils/logger';

/**
 * Sprint 90 — Designed to Forget.
 *
 * Makes the "designed to forget" promise real for *content*. On configurable windows this job:
 *  1. Anonymizes the free-text of aged COMPLETED requests to a sentinel (`'[forgotten]'`) and, in the
 *     SAME atomic statement, cascade-forgets the linked conversation's messages (the Exchange Unit).
 *  2. Hard-deletes aged EXPIRED + UNMATCHED requests (no aggregate value, nothing to cascade).
 *  3. Runs a standalone message backstop for any old messages the cascade missed.
 *
 * Aggregates are never touched: `requests.matches` and `reputation.karma_records` stay intact so
 * reputation/trust math remains correct. `karma_records` in particular is OFF LIMITS — it holds no PII
 * and its `reason` is a load-bearing enum filtered by trust metrics.
 */

const SENTINEL = '[forgotten]';

export interface RetentionWindows {
  completedRequestWindowDays: number;
  expiredRequestWindowDays: number;
  messageWindowDays: number;
}

// Hardcoded fallback — used when the config table is empty so the job is always safe to run.
const FALLBACK_WINDOWS: RetentionWindows = {
  completedRequestWindowDays: 180,
  expiredRequestWindowDays: 30,
  messageWindowDays: 180,
};

interface RetentionConfigRow {
  community_id: string | null;
  completed_request_window_days: number;
  expired_request_window_days: number;
  message_window_days: number;
}

/**
 * Resolve the active windows for a community: community row → global (NULL) row → hardcoded fallback.
 * Pure so the job and tests classify identically.
 */
export function resolveRetentionWindows(
  rows: RetentionConfigRow[],
  communityId?: string
): RetentionWindows {
  const row =
    (communityId != null && rows.find((r) => r.community_id === communityId)) ||
    rows.find((r) => r.community_id == null);
  if (!row) return { ...FALLBACK_WINDOWS };
  return {
    completedRequestWindowDays: row.completed_request_window_days,
    expiredRequestWindowDays: row.expired_request_window_days,
    messageWindowDays: row.message_window_days,
  };
}

/**
 * Forget the content of aged exchanges. Returns per-branch counts.
 */
export async function forgetExchangeContent(): Promise<{
  requestsForgotten: number;
  messagesCascaded: number;
  expiredDeleted: number;
  messagesBackstopped: number;
}> {
  const cfg = await query(
    `SELECT community_id, completed_request_window_days, expired_request_window_days, message_window_days
       FROM requests.retention_config`
  );
  const windows = resolveRetentionWindows(cfg.rows as RetentionConfigRow[]);

  // 1. Exchange Unit cascade — anonymize aged completed-request free-text AND its conversation's
  //    messages in ONE statement (one implicit transaction → they forget together or not at all).
  //    The first CTE forgets the requests; the second forgets every message whose conversation links
  //    (request → match → conversation → messages) to a just-forgotten request; the SELECT returns both
  //    counts without a second round-trip.
  const completed = await query(
    `WITH forgotten_requests AS (
       UPDATE requests.help_requests
          SET title = '${SENTINEL}',
              description = '${SENTINEL}',
              payload = '{}'::jsonb,
              requirements = '{}'::jsonb,
              content_forgotten_at = NOW()
        WHERE status = 'completed'
          AND content_forgotten_at IS NULL
          AND updated_at < NOW() - make_interval(days => $1::int)
        RETURNING id
     ),
     cascaded_messages AS (
       UPDATE messaging.messages m
          SET content = '${SENTINEL}',
              forgotten_at = NOW()
         FROM messaging.conversations c
         JOIN requests.matches mt ON mt.id = c.request_match_id
        WHERE m.conversation_id = c.id
          AND mt.request_id IN (SELECT id FROM forgotten_requests)
          AND m.forgotten_at IS NULL
       RETURNING m.id
     )
     SELECT
       (SELECT COUNT(*)::int FROM forgotten_requests) AS requests_forgotten,
       (SELECT COUNT(*)::int FROM cascaded_messages)  AS messages_cascaded`,
    [windows.completedRequestWindowDays]
  );
  const requestsForgotten = completed.rows[0]?.requests_forgotten ?? 0;
  const messagesCascaded = completed.rows[0]?.messages_cascaded ?? 0;

  // 2. Hard-delete aged EXPIRED + UNMATCHED requests. Age from updated_at (the expiration job stamps it
  //    when it flips the flag) — never created_at, which would delete a just-expired old request.
  const expired = await query(
    `DELETE FROM requests.help_requests
      WHERE expired = TRUE
        AND NOT EXISTS (
          SELECT 1 FROM requests.matches m WHERE m.request_id = requests.help_requests.id
        )
        AND updated_at < NOW() - make_interval(days => $1::int)`,
    [windows.expiredRequestWindowDays]
  );
  const expiredDeleted = expired.rowCount ?? 0;

  // 3. Standalone message backstop — forget any old messages the Exchange Unit cascade missed
  //    (e.g. very long-lived conversations whose request hasn't aged into the completed window).
  const backstop = await query(
    `UPDATE messaging.messages
        SET content = '${SENTINEL}',
            forgotten_at = NOW()
      WHERE forgotten_at IS NULL
        AND created_at < NOW() - make_interval(days => $1::int)`,
    [windows.messageWindowDays]
  );
  const messagesBackstopped = backstop.rowCount ?? 0;

  logger.info('Memory retention sweep complete', {
    requestsForgotten,
    messagesCascaded,
    expiredDeleted,
    messagesBackstopped,
  });

  return { requestsForgotten, messagesCascaded, expiredDeleted, messagesBackstopped };
}
