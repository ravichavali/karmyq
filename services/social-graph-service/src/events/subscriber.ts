import Queue from 'bull';
import { clearTrustPathCache } from '../services/pathComputation';
import { reconcileMatchCompletedCommunities } from '../services/trustEdgeService';
import { logger } from '../config/logger';
import { pool } from '../config/database';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

const eventQueue = new Queue('karmyq-events', REDIS_URL);

/** The `match_completed` event payload (as published by request-service `matches.ts`). */
export interface MatchCompletedPayload {
  match_id?: string;
  request_id: string;
  offer_id?: string;
  requester_id: string;
  responder_id: string;
  /** Legacy/optional — the publisher does NOT set this; communities are derived from the request. */
  community_id?: string;
}

/**
 * Handle a completed match: clear cached trust paths, record the connection, and reconcile the
 * per-community trust edges. Extracted from the Bull processor so it is unit/integration-testable
 * without Redis. Sprint 100 / ADR-078: community trust edges are derived from the request's
 * `request_communities`, not the payload's `community_id` (which the publisher never sets), so a
 * counted exchange always has a matching connection + trust edge in every community it belongs to.
 */
export async function handleMatchCompleted(payload: MatchCompletedPayload): Promise<void> {
  const { request_id, requester_id, responder_id } = payload;

  try {
    // 1. Clear trust path cache (existing behavior — preserved)
    await clearTrustPathCache(requester_id, responder_id);
    logger.info('✅ Trust path cache cleared for completed match', { requester_id, responder_id });

    // 2. Upsert into social_graph.connections (Sprint 27)
    await pool.query(
      `INSERT INTO social_graph.connections
         (user_a_id, user_b_id, type, first_connected_at, last_interaction_at)
       VALUES (
         LEAST($1::text, $2::text)::uuid,
         GREATEST($1::text, $2::text)::uuid,
         'exchange',
         now(),
         now()
       )
       ON CONFLICT (
         LEAST(user_a_id::text, user_b_id::text),
         GREATEST(user_a_id::text, user_b_id::text)
       )
       DO UPDATE SET last_interaction_at = now()`,
      [requester_id, responder_id]
    );
    logger.info('✅ social_graph.connections upserted', { requester_id, responder_id });

    // 3. Reconcile per-community trust edges from the request's communities (ADR-078), NOT the
    //    payload's community_id. Without a request_id we cannot reconcile (older events) — skip.
    if (request_id) {
      const communityIds = await reconcileMatchCompletedCommunities({
        requestId: request_id,
        requesterId: requester_id,
        responderId: responder_id,
      });
      logger.info('✅ Trust edges reconciled', { requester_id, responder_id, communityIds });
    } else {
      logger.warn('match_completed without request_id — skipping trust-edge reconciliation', { requester_id, responder_id });
    }
  } catch (error) {
    logger.error('❌ Failed to process match_completed', error instanceof Error ? error : undefined, { requester_id, responder_id });
    throw error;
  }
}

export async function initEventSubscriber() {
  try {
    // When a match completes, the direct edge now exists — clear cached paths for these two users
    eventQueue.process('match_completed', async (job) => {
      logger.info('Processing match_completed event', job.data);
      await handleMatchCompleted(job.data.payload as MatchCompletedPayload);
    });

    logger.info('✅ Social graph event subscriber initialized');
  } catch (error) {
    logger.error('❌ Event subscriber initialization failed', error instanceof Error ? error : undefined);
    throw error;
  }
}

export default eventQueue;
