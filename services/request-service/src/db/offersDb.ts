import { query, withTransaction } from '../database/db';
import { closeProposals, lockRequestForCommitment, reconcileRequestStatus } from './requestStatus';

/**
 * Get all provider.offers for a given request.
 * The authenticated user must own the request (requester side).
 * Returns null if the caller does not own the request (→ 403).
 */
export async function getOffersForRequest(requestId: string, requesterUserId: string) {
  // Verify the caller owns the request
  const check = await query(
    `SELECT id FROM requests.help_requests WHERE id = $1 AND requester_id = $2`,
    [requestId, requesterUserId]
  );
  if (!check.rows.length) return null; // not owner → caller should return 403

  const result = await query(
    `SELECT o.*, u.email as provider_email
     FROM provider.offers o
     JOIN auth.users u ON u.id = o.provider_user_id
     WHERE o.request_id = $1 AND o.status IN ('pending', 'accepted', 'declined')
     ORDER BY o.created_at DESC`,
    [requestId]
  );
  return result.rows;
}

/**
 * Accept a pending provider offer.
 * The authenticated user must own the underlying help request.
 * Returns null if the offer is not found or not pending, including one accepted or withdrawn concurrently.
 * Returns 'FORBIDDEN' if the offer exists but the caller does not own the request.
 * Returns 'REQUEST_NOT_OPEN' if the request is no longer open (BUG-075).
 * On success, also inserts a requests.matches record to bridge into existing match tracking.
 */
export async function acceptOffer(offerId: string, requesterUserId: string) {
  // Fetch offer and verify ownership in one query
  const offerResult = await query(
    `SELECT o.*, hr.requester_id as requester_user_id
     FROM provider.offers o
     JOIN requests.help_requests hr ON hr.id = o.request_id
     WHERE o.id = $1 AND o.status = 'pending'`,
    [offerId]
  );
  const offer = offerResult.rows[0];
  if (!offer) return null;
  if (offer.requester_user_id !== requesterUserId) return 'FORBIDDEN' as const;

  // One transaction: a mid-sequence failure can no longer leave an accepted offer without its match (BUG-075).
  return withTransaction(async (q) => {
    // Only an open request that is not past its expiry can be matched (BUG-075, BUG-085); the lock serializes this accept against every other request writer.
    if ((await lockRequestForCommitment(q, offer.request_id)) !== 'open') return 'REQUEST_NOT_OPEN' as const;

    const accepted = await q(
      `UPDATE provider.offers SET status = 'accepted', updated_at = NOW() WHERE id = $1 AND status = 'pending'`,
      [offerId]
    );
    if (accepted.rowCount === 0) return null;

    // Bridge into existing match tracking
    await q(
      `INSERT INTO requests.matches (request_id, responder_id, status)
       VALUES ($1, $2, 'matched')`,
      [offer.request_id, offer.provider_user_id]
    );

    // Close the other proposals and derive the request — mirrors the dibs/match accept path
    await closeProposals(q, offer.request_id);
    await reconcileRequestStatus(q, offer.request_id);
    return offer;
  });
}

/**
 * Decline a pending provider offer.
 * The authenticated user must own the underlying help request.
 * Returns null if the offer is not found or not pending.
 * Returns 'FORBIDDEN' if the offer exists but the caller does not own the request.
 */
export async function declineOffer(offerId: string, requesterUserId: string) {
  const offerResult = await query(
    `SELECT o.*, hr.requester_id as requester_user_id
     FROM provider.offers o
     JOIN requests.help_requests hr ON hr.id = o.request_id
     WHERE o.id = $1 AND o.status = 'pending'`,
    [offerId]
  );
  const offer = offerResult.rows[0];
  if (!offer) return null;
  if (offer.requester_user_id !== requesterUserId) return 'FORBIDDEN' as const;

  await query(
    `UPDATE provider.offers SET status = 'declined', updated_at = NOW() WHERE id = $1`,
    [offerId]
  );
  return offer;
}
