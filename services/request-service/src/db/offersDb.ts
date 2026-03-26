import { query } from '../database/db';

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
 * Returns null if the offer is not found or not pending.
 * Returns 'FORBIDDEN' if the offer exists but the caller does not own the request.
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

  await query(
    `UPDATE provider.offers SET status = 'accepted', updated_at = NOW() WHERE id = $1`,
    [offerId]
  );

  // Bridge into existing match tracking
  await query(
    `INSERT INTO requests.matches (request_id, responder_id, status)
     VALUES ($1, $2, 'matched')`,
    [offer.request_id, offer.provider_user_id]
  );

  return offer;
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
