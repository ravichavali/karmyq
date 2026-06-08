import { query } from '../database/db';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface Dibs {
  id: string;
  request_id: string;
  requester_id: string;
  provider_user_id: string;
  status: 'pending' | 'accepted' | 'declined' | 'expired';
  expires_at: Date;
  created_at: Date;
  updated_at: Date;
}

export interface DibsWithRequest extends Dibs {
  request_title: string | null;
  scheduled_for: Date | null;
  requester_name: string | null;
}

/**
 * Raw candidate shape returned by getEligibleCandidates.
 * trustGraphConnection is derived from social_graph.connections.type:
 *   'exchange'  → 'direct'
 *   'community' → 'indirect'
 *   (no row)    → 'none'
 */
export interface RawCandidate {
  providerId: string;
  providerUserId: string;
  displayName: string;
  trustScore: number;
  priorInteractions: number;
  trustGraphConnection: 'direct' | 'indirect' | 'none';
  isAvailable: boolean;
  /**
   * BUG-007 (Option A): which facet of the platform this candidate represents.
   * 'provider' for service requests (provider_profiles), 'neighbor' for mutual-aid
   * requests (ordinary community members). Drives neighbor-vs-provider framing in
   * the dibs/first-ask UI — a neighbor must never be shown as a "provider."
   */
  kind: 'neighbor' | 'provider';
}

// ── Queries ───────────────────────────────────────────────────────────────────

/**
 * Get providers who have prior completed interactions with the requester
 * and are currently available.
 *
 * Joins:
 *   requests.matches → requests.help_requests (to count completed matches
 *     involving requester as requester or responder)
 *   requests.provider_profiles (is_available gate + provider id)
 *   social_graph.connections (optional, for trustGraphConnection)
 *   reputation.provider_trust_scores (optional, for trust score; defaults to 50)
 *
 * Gate: priorInteractions >= 1 AND pp.is_available = true
 * The prior-interaction count is deduplicated by provider_user_id.
 */
export async function getEligibleCandidates(
  requesterId: string,
  communityIds: string[]
): Promise<RawCandidate[]> {
  const result = await query(
    `SELECT
       pp.id                              AS "providerId",
       pp.user_id                         AS "providerUserId",
       pp.display_name                    AS "displayName",
       COALESCE(pts.trust_score, 50)      AS "trustScore",
       prior.interaction_count            AS "priorInteractions",
       COALESCE(
         CASE sg.type
           WHEN 'exchange'  THEN 'direct'
           WHEN 'community' THEN 'indirect'
           ELSE 'none'
         END,
         'none'
       )                                  AS "trustGraphConnection",
       pp.is_available                    AS "isAvailable"
     FROM requests.provider_profiles pp

     -- Count completed matches where both the requester and this provider were involved
     JOIN (
       SELECT
         CASE
           WHEN hr.requester_id = $1 THEN m.responder_id
           ELSE hr.requester_id
         END AS provider_user_id,
         COUNT(*) AS interaction_count
       FROM requests.matches m
       JOIN requests.help_requests hr ON hr.id = m.request_id
       WHERE m.status = 'completed'
         AND (
           (hr.requester_id = $1 AND m.responder_id != $1)
           OR
           (m.responder_id = $1 AND hr.requester_id != $1)
         )
       GROUP BY
         CASE
           WHEN hr.requester_id = $1 THEN m.responder_id
           ELSE hr.requester_id
         END
     ) prior ON prior.provider_user_id = pp.user_id

     -- Optional: cached trust score from reputation service (defaults to 50 if no reviews yet)
     LEFT JOIN reputation.provider_trust_scores pts ON pts.provider_id = pp.id

     -- Optional: trust graph connection type between requester and provider
     LEFT JOIN social_graph.connections sg ON (
       (sg.user_a_id = $1 AND sg.user_b_id = pp.user_id)
       OR (sg.user_b_id = $1 AND sg.user_a_id = pp.user_id)
     )

     WHERE pp.is_available = true
       AND pp.is_active = true
       AND prior.interaction_count >= 1
       AND pp.user_id IN (
         SELECT DISTINCT cm.user_id
         FROM communities.members cm
         WHERE cm.community_id = ANY($2)
       )
       AND pp.user_id != $1`,
    [requesterId, communityIds]
  );

  return result.rows.map((row: any) => ({
    providerId: row.providerId,
    providerUserId: row.providerUserId,
    displayName: row.displayName ?? '',
    trustScore: Number(row.trustScore),
    priorInteractions: Number(row.priorInteractions),
    trustGraphConnection: row.trustGraphConnection as 'direct' | 'indirect' | 'none',
    isAvailable: Boolean(row.isAvailable),
    kind: 'provider',
  }));
}

/**
 * Get community members who have prior completed interactions with the requester.
 * Used for non-service (mutual aid) dibs candidate selection — does not require
 * a provider profile, so it queries auth.users directly.
 */
export async function getMutualAidCandidates(
  requesterId: string,
  communityIds: string[]
): Promise<RawCandidate[]> {
  const result = await query(
    `SELECT
       u.id                                AS "providerId",
       u.id                                AS "providerUserId",
       u.name                              AS "displayName",
       COALESCE(
         (SELECT MAX(score) FROM reputation.trust_scores
          WHERE user_id = u.id AND community_id = ANY($2)),
         50
       )                                   AS "trustScore",
       COALESCE(prior.interaction_count, 0) AS "priorInteractions",
       COALESCE(
         CASE sg.type
           WHEN 'exchange'  THEN 'direct'
           WHEN 'community' THEN 'indirect'
           ELSE 'none'
         END,
         'none'
       )                                   AS "trustGraphConnection",
       true                                AS "isAvailable"
     FROM auth.users u

     LEFT JOIN (
       SELECT
         CASE
           WHEN hr.requester_id = $1 THEN m.responder_id
           ELSE hr.requester_id
         END AS provider_user_id,
         COUNT(*) AS interaction_count
       FROM requests.matches m
       JOIN requests.help_requests hr ON hr.id = m.request_id
       WHERE m.status = 'completed'
         AND (
           (hr.requester_id = $1 AND m.responder_id != $1)
           OR (m.responder_id = $1 AND hr.requester_id != $1)
         )
       GROUP BY
         CASE
           WHEN hr.requester_id = $1 THEN m.responder_id
           ELSE hr.requester_id
         END
     ) prior ON prior.provider_user_id = u.id

     LEFT JOIN social_graph.connections sg ON (
       (sg.user_a_id = $1 AND sg.user_b_id = u.id)
       OR (sg.user_b_id = $1 AND sg.user_a_id = u.id)
     )

     WHERE u.id != $1
       AND u.id IN (
         SELECT DISTINCT cm.user_id
         FROM communities.members cm
         WHERE cm.community_id = ANY($2)
       )
       AND (
         COALESCE(prior.interaction_count, 0) >= 1
         OR (sg.type = 'exchange' AND COALESCE(prior.interaction_count, 0) = 0)
       )`,
    [requesterId, communityIds]
  );

  return result.rows.map((row: any) => ({
    providerId: row.providerId,
    providerUserId: row.providerUserId,
    displayName: row.displayName ?? '',
    trustScore: Number(row.trustScore),
    priorInteractions: Number(row.priorInteractions),
    trustGraphConnection: row.trustGraphConnection as 'direct' | 'indirect' | 'none',
    isAvailable: true,
    kind: 'neighbor',
  }));
}

/**
 * Insert a new dibs record.
 */
export async function createDibs(
  requestId: string,
  requesterId: string,
  providerUserId: string,
  expiresAt: Date
): Promise<Dibs> {
  const result = await query(
    `INSERT INTO requests.dibs (request_id, requester_id, provider_user_id, expires_at)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [requestId, requesterId, providerUserId, expiresAt]
  );
  return result.rows[0] as Dibs;
}

/**
 * Fetch a single dibs record by its id.
 */
export async function getDibsById(dibsId: string): Promise<Dibs | null> {
  const result = await query(
    `SELECT * FROM requests.dibs WHERE id = $1`,
    [dibsId]
  );
  return (result.rows[0] as Dibs) ?? null;
}

/**
 * Fetch the dibs record for a given request.
 * Returns null if none exists (UNIQUE constraint on request_id).
 */
export async function getDibsByRequestId(requestId: string): Promise<Dibs | null> {
  const result = await query(
    `SELECT * FROM requests.dibs WHERE request_id = $1`,
    [requestId]
  );
  return (result.rows[0] as Dibs) ?? null;
}

/**
 * Update the status of a dibs record.
 * Optionally accepts an explicit updatedAt (useful for expiry jobs).
 */
export async function updateDibsStatus(
  dibsId: string,
  status: 'accepted' | 'declined' | 'expired',
  updatedAt?: Date
): Promise<void> {
  await query(
    `UPDATE requests.dibs
     SET status = $2, updated_at = $3
     WHERE id = $1`,
    [dibsId, status, updatedAt ?? new Date()]
  );
}

/**
 * Return all pending dibs records whose expiry has passed.
 * Used by the cleanup-service expireDibs job.
 */
export async function getExpiredPendingDibs(): Promise<Array<{ id: string; request_id: string }>> {
  const result = await query(
    `SELECT id, request_id FROM requests.dibs
     WHERE status = 'pending' AND expires_at <= NOW()`,
    []
  );
  return result.rows as Array<{ id: string; request_id: string }>;
}

/**
 * Return all pending dibs for a provider, joined with request data.
 */
export async function getPendingDibsForProvider(providerUserId: string): Promise<DibsWithRequest[]> {
  const result = await query(
    `SELECT d.*, hr.title AS request_title, hr.scheduled_for, u.name AS requester_name
     FROM requests.dibs d
     JOIN requests.help_requests hr ON hr.id = d.request_id
     JOIN auth.users u ON u.id = d.requester_id
     WHERE d.provider_user_id = $1 AND d.status = 'pending'
     ORDER BY d.created_at DESC`,
    [providerUserId]
  );
  return result.rows as DibsWithRequest[];
}
