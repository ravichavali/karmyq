import { query } from '../database/db';

/**
 * Offer eligibility = the request's **visibility boundary** (can the feed ever show this ask to this
 * viewer?), NOT a membership gate and NOT "any UUID is fair game".
 *
 * Two distinct things were conflated before:
 *  - **Visibility** — deterministic access boundary set by the requester's `visibility_scope`
 *    (community / trust_network / platform) plus sister-community links. This DOES gate eligibility.
 *  - **Surfacing / ranking** — the feed's personalized, stochastic explore/exploit ordering WITHIN
 *    the visible set. This does NOT gate eligibility (you can act on something visible even if the
 *    feed didn't rank it to you today, or you toggled its tier off).
 *
 * This helper mirrors the curated feed's visibility predicate (Tier 1 community membership; Tier 2/3
 * `visibility_scope IN ('trust_network','platform')`; sister-community via active `community_links`
 * with `show_in_sister_feeds`) — see `respondCuratedFeed` in `routes/requests.ts`. The feed gates
 * trust_network/platform on the viewer's own display *preferences*; those are the viewer's toggle,
 * not the requester's access boundary, so they are not re-applied here. Trust-distance/degree is a
 * feed ranking refinement, not a hard visibility wall, so it is likewise not re-derived here.
 *
 * Callers enforce the lifecycle INVARIANTS (open, unexpired, not-own, no-duplicate) separately.
 */
export interface RequestReachability {
  /** Whether the request row exists at all. */
  exists: boolean;
  requesterId: string | null;
  status: string | null;
  expired: boolean | null;
  visibilityScope: string | null;
  /** Viewer is within the request's visibility audience (member OR wide-scope OR sister-reachable). */
  reachable: boolean;
  /** Why the viewer is currently inside that audience; never inferred from feed ranking. */
  reachability: 'same_community' | 'sister_community' | 'trust_network' | 'platform' | null;
}

export async function getRequestReachability(requestId: string, userId: string | null): Promise<RequestReachability> {
  const result = await query(
    `SELECT
       r.requester_id, r.status, r.expired, r.visibility_scope,
       -- Tier 1: viewer is an active member of one of the request's communities (community scope).
       EXISTS (
         SELECT 1 FROM requests.request_communities rc
         JOIN communities.members cm
           ON cm.community_id = rc.community_id AND cm.user_id = $2 AND cm.status = 'active'
         WHERE rc.request_id = r.id
       ) AS is_member,
       -- Sister: a request community is actively linked (show_in_sister_feeds) to a DIFFERENT
       -- community the viewer actively belongs to.
       EXISTS (
         SELECT 1
         FROM requests.request_communities rc
         JOIN communities.community_links cl
           ON cl.status = 'active' AND cl.show_in_sister_feeds = TRUE
          AND (cl.community_a_id = rc.community_id OR cl.community_b_id = rc.community_id)
         JOIN communities.members cm2
           ON cm2.user_id = $2 AND cm2.status = 'active'
          AND cm2.community_id = CASE WHEN cl.community_a_id = rc.community_id
                                      THEN cl.community_b_id ELSE cl.community_a_id END
         WHERE rc.request_id = r.id
       ) AS sister_reachable
     FROM requests.help_requests r
     WHERE r.id = $1`,
    [requestId, userId]
  );

  if (result.rowCount === 0) {
    return {
      exists: false,
      requesterId: null,
      status: null,
      expired: null,
      visibilityScope: null,
      reachable: false,
      reachability: null,
    };
  }

  const row = result.rows[0];
  const wideScope = row.visibility_scope === 'trust_network' || row.visibility_scope === 'platform';
  const reachability = row.is_member === true
    ? 'same_community'
    : row.sister_reachable === true
      ? 'sister_community'
      : row.visibility_scope === 'trust_network'
        ? 'trust_network'
        : row.visibility_scope === 'platform'
          ? 'platform'
          : null;
  return {
    exists: true,
    requesterId: row.requester_id,
    status: row.status,
    expired: row.expired,
    visibilityScope: row.visibility_scope,
    reachable: row.is_member === true || wideScope || row.sister_reachable === true,
    reachability,
  };
}
