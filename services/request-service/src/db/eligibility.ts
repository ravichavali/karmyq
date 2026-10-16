import { query } from '../database/db';
import { directedAudienceSql } from './directedAudience';

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
  reachability: 'same_community' | 'sister_community' | 'trust_network' | 'platform' | 'directed' | null;
  isDirected?: boolean;
}

// Tier 1: viewer is an active member of one of the request's communities (community scope).
function requestMemberSql(alias: string, viewerParam: string): string {
  return `EXISTS (
         SELECT 1 FROM requests.request_communities rc
         JOIN communities.members cm
           ON cm.community_id = rc.community_id AND cm.user_id = ${viewerParam} AND cm.status = 'active'
         WHERE rc.request_id = ${alias}.id
       )`;
}

// Sister: a request community is actively linked (show_in_sister_feeds) to a DIFFERENT community the
// viewer actively belongs to.
function requestSisterSql(alias: string, viewerParam: string): string {
  return `EXISTS (
         SELECT 1
         FROM requests.request_communities rc
         JOIN communities.community_links cl
           ON cl.status = 'active' AND cl.show_in_sister_feeds = TRUE
          AND (cl.community_a_id = rc.community_id OR cl.community_b_id = rc.community_id)
         JOIN communities.members cm2
           ON cm2.user_id = ${viewerParam} AND cm2.status = 'active'
          AND cm2.community_id = CASE WHEN cl.community_a_id = rc.community_id
                                      THEN cl.community_b_id ELSE cl.community_a_id END
         WHERE rc.request_id = ${alias}.id
       )`;
}

/** The visibility audience of a non-directed request: member ∨ sister-reachable ∨ wide scope. */
export function requestReachableSql(alias: string, viewerParam: string): string {
  // Cheapest arm first: the column test settles wide-scope rows before any subquery runs.
  return `(${alias}.visibility_scope IN ('trust_network', 'platform')
       OR ${requestMemberSql(alias, viewerParam)}
       OR ${requestSisterSql(alias, viewerParam)})`;
}

/**
 * BUG-056 / BUG-065: who may read a request, as one SQL predicate. The directed-audience predicate is
 * ANDed first (exactly as GET /requests/:id filters), then own ∨ any-status match responder ∨
 * pre-selected provider ∨ directed (already audience-checked) ∨ reachable. GET /requests ANDs this on its
 * browse branch so the list can never show a row the detail route would 404.
 */
export function requestReadableSql(alias: string, viewerParam: string): string {
  return `/* request-readable */ (${directedAudienceSql(alias, viewerParam)}
     AND (${alias}.requester_id = ${viewerParam}
       OR ${alias}.is_directed
       OR EXISTS (SELECT 1 FROM requests.matches readable_match
         WHERE readable_match.request_id = ${alias}.id AND readable_match.responder_id = ${viewerParam})
       OR EXISTS (SELECT 1 FROM requests.provider_profiles readable_provider
         WHERE readable_provider.id = ${alias}.preferred_provider_id AND readable_provider.user_id = ${viewerParam})
       OR ${requestReachableSql(alias, viewerParam)}))`;
}

export async function getRequestReachability(requestId: string, userId: string | null): Promise<RequestReachability> {
  const result = await query(
    `SELECT
       r.requester_id, r.status, r.expired, r.visibility_scope, r.is_directed,
       ${directedAudienceSql('r', '$2', false)} AS in_directed_audience,
       ${requestMemberSql('r', '$2')} AS is_member,
       ${requestSisterSql('r', '$2')} AS sister_reachable
     FROM requests.help_requests r
     WHERE r.id = $1`,
    [requestId, userId]
  );

  if (result.rowCount === 0 || (result.rows[0]?.is_directed === true
    && result.rows[0].in_directed_audience !== true && result.rows[0].requester_id !== userId)) {
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
  if (row.is_directed === true) {
    const reachable = row.in_directed_audience === true && !!userId && row.requester_id !== userId;
    return { exists: true, requesterId: row.requester_id, status: row.status,
      expired: row.expired, visibilityScope: row.visibility_scope, isDirected: true,
      reachable, reachability: reachable ? 'directed' : null };
  }
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
