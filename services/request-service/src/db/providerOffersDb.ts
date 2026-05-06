import { query } from '../database/db';

/**
 * Validate that a request exists in at least one of the provider's communities and is still open.
 * Membership is checked against the DB, not the JWT, so stale tokens never block valid providers.
 */
export async function validateRequestForOffer(
  requestId: string,
  providerUserId: string
): Promise<{ valid: boolean; reason?: string }> {
  const result = await query(
    `SELECT hr.id, hr.status
     FROM requests.help_requests hr
     JOIN requests.request_communities rc ON rc.request_id = hr.id
     JOIN communities.members m ON m.community_id = rc.community_id
     WHERE hr.id = $1
       AND m.user_id = $2
       AND m.status = 'active'
     LIMIT 1`,
    [requestId, providerUserId]
  );

  if (result.rows.length === 0) {
    return { valid: false, reason: 'Request not found in your communities' };
  }
  if (result.rows[0].status !== 'open') {
    return { valid: false, reason: 'Request is no longer open' };
  }
  return { valid: true };
}

/**
 * Get the default price for a provider from their active rate card.
 * Returns null if no active rate card exists.
 */
export async function getDefaultPrice(providerId: string): Promise<number | null> {
  const result = await query(
    `SELECT rate_amount FROM requests.provider_rate_cards
     WHERE provider_id = $1 AND is_active = true AND pricing_model = 'standard'
     ORDER BY created_at DESC LIMIT 1`,
    [providerId]
  );
  return result.rows[0]?.rate_amount ?? null;
}

/**
 * Create a new provider offer for a request.
 * Throws with code 'DUPLICATE_OFFER' if an active offer already exists.
 */
export async function createProviderOffer(
  providerUserId: string,
  providerId: string,
  requestId: string,
  price: number | null,
  note: string | null
) {
  // Application-level duplicate check for a meaningful 409 response
  const existing = await query(
    `SELECT id FROM provider.offers
     WHERE provider_user_id = $1 AND request_id = $2
       AND status IN ('pending', 'accepted')`,
    [providerUserId, requestId]
  );
  if (existing.rows.length > 0) {
    throw Object.assign(new Error('Offer already exists for this request'), { code: 'DUPLICATE_OFFER' });
  }

  const result = await query(
    `INSERT INTO provider.offers (provider_id, provider_user_id, request_id, price, note)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [providerId, providerUserId, requestId, price, note]
  );
  return result.rows[0];
}

/**
 * Get all offers submitted by a provider (identified by user_id).
 */
export async function getMyProviderOffers(providerUserId: string) {
  const result = await query(
    `SELECT o.*, hr.title as request_title, hr.type as request_type
     FROM provider.offers o
     JOIN requests.help_requests hr ON hr.id = o.request_id
     WHERE o.provider_user_id = $1
     ORDER BY o.created_at DESC`,
    [providerUserId]
  );
  return result.rows;
}

/**
 * Withdraw a pending offer. Only the owning provider can withdraw.
 * Returns null if not found or not in 'pending' status.
 */
export async function withdrawProviderOffer(offerId: string, providerUserId: string) {
  const result = await query(
    `UPDATE provider.offers SET status = 'withdrawn', updated_at = NOW()
     WHERE id = $1 AND provider_user_id = $2 AND status = 'pending'
     RETURNING *`,
    [offerId, providerUserId]
  );
  return result.rows[0] ?? null;
}
