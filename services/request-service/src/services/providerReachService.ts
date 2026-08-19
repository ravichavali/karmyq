import { query } from '../database/db';

/**
 * Sprint 125 (ADR-095) — the provider reach gate.
 *
 * Migration `022-provider-profiles.sql` shipped three columns on `communities.community_configs`
 * that nothing ever read: `provider_services_enabled`, `provider_min_personal_trust_score` and
 * `provider_services_list`. The admin UI wrote all three; no service consumed any of them. This
 * module is the consumer, and it enforces all three together — leaving one inert would recreate
 * exactly the situation this sprint exists to close.
 *
 * ## Reach vs. registration
 * Standing gates a provider's REACH into a community, not their ability to register. ADR-041's
 * global self-registration stands unamended: anyone may create a provider profile, and the global
 * directory still lists it (to authenticated callers, per ADR-095). What a community controls is
 * whether that provider is surfaced to ITS members.
 *
 * ## Two different "trust" scores
 * ⚠️ `reputation.trust_scores.score` is a **user × community** standing (ADR-037) and is what the
 * floor filters on. `reputation.provider_trust_scores.trust_score` is a **provider profile**
 * quality score (60/30/10 service quality) and is only used for ORDERING. Substituting one for the
 * other rejects an entirely different set of people, and both columns are plausibly named enough
 * that the mistake would read as correct.
 */

/** A provider as surfaced through one community's reach layer. */
export interface CommunityProvider {
  id: string;
  user_id: string;
  service_type: string;
  display_name: string;
  bio: string | null;
  pricing_notes: string | null;
  location_notes: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  user_name: string | null;
  avg_stars: number | null;
  total_reviews: number | null;
  trust_score: number | null;
}

export interface ReachPageOptions {
  limit?: unknown;
  offset?: unknown;
}

/** Hard ceiling on a single page, so a member cannot ask for the entire directory in one call. */
const MAX_LIMIT = 100;
const DEFAULT_LIMIT = 20;

/**
 * Clamp a caller-supplied paging value to a safe integer.
 *
 * These reach the database as bound parameters, so this is not an injection defence — it is a
 * resource-exhaustion and 500-avoidance one. A non-numeric `?limit=abc` would otherwise reach
 * Postgres and raise, turning a typo into a 500.
 */
function clampInt(value: unknown, fallback: number, min: number, max: number): number {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(parsed, min), max);
}

/**
 * Is this user an active member of this community, according to the LIVE table?
 *
 * Deliberately not derived from the JWT `communities` claim. That claim is a login-time snapshot:
 * a member removed an hour ago still carries it until their token refreshes, so a claim-only check
 * leaks the community's provider layer to someone who has been shown the door. Claims are role
 * hints; visibility decisions query the table.
 */
export async function isActiveMember(userId: string, communityId: string): Promise<boolean> {
  const result = await query(
    `SELECT community_id
     FROM communities.members
     WHERE user_id = $1 AND community_id = $2 AND status = 'active'
     LIMIT 1`,
    [userId, communityId]
  );
  return result.rows.length > 0;
}

/**
 * The three-condition reach query.
 *
 * Exported so `tests/unit/providerReachService.test.ts` can assert its exact shape without a
 * database. The conditions are load-bearing in ways that are easy to "simplify" wrongly, so each
 * carries its reasoning inline:
 *
 *  1. `c.provider_services_enabled = TRUE` — the opt-in. Joining `community_configs` INNER is what
 *     makes a community with NO config row yield zero rows rather than an error: unconfigured is
 *     disabled, not missing.
 *  2. `COALESCE(ts.score, 0) >= c.provider_min_personal_trust_score` — fail closed. A provider with
 *     no trust row in this community scores 0, so a floor above 0 excludes them (ADR-037).
 *     ⚠️ The join MUST be LEFT: an INNER JOIN would drop every provider lacking a trust row even
 *     when the floor is 0, which is the default — the gate would silently empty itself.
 *     ⚠️ And the COALESCE must stay: bare `ts.score >= floor` is NULL for a missing row, and NULL
 *     is not TRUE, so it would fail closed by accident rather than by rule — until someone
 *     "fixed" the join to INNER and changed the meaning without changing the line.
 *  3. `cardinality(...) = 0 OR service_type = ANY(...)` — an empty allowlist means ALL types.
 *     The column defaults to '{}', so reading empty as deny-all would switch off every community
 *     that enabled provider services without curating a list.
 *
 * `pm` is the PROVIDER's active membership of the same community; a provider who left is no longer
 * reachable through it. Ordering uses `provider_trust_scores.trust_score` — the profile quality
 * score, NOT the personal standing the floor filters on.
 */
export const COMMUNITY_PROVIDER_QUERY = `
  SELECT
    pp.id, pp.user_id, pp.service_type, pp.display_name,
    pp.bio, pp.pricing_notes, pp.location_notes, pp.is_active,
    pp.created_at, pp.updated_at,
    u.name AS user_name,
    pts.avg_stars, pts.total_reviews, pts.trust_score
  FROM requests.provider_profiles pp
  JOIN communities.members pm
    ON pm.user_id = pp.user_id AND pm.community_id = $1 AND pm.status = 'active'
  JOIN communities.community_configs c
    ON c.community_id = $1
  LEFT JOIN reputation.trust_scores ts
    ON ts.user_id = pp.user_id AND ts.community_id = $1
  LEFT JOIN auth.users u ON u.id = pp.user_id
  LEFT JOIN reputation.provider_trust_scores pts ON pts.provider_id = pp.id
  WHERE pp.is_active = TRUE
    AND c.provider_services_enabled = TRUE
    AND COALESCE(ts.score, 0) >= c.provider_min_personal_trust_score
    AND (cardinality(c.provider_services_list) = 0
         OR pp.service_type = ANY(c.provider_services_list))
  ORDER BY pts.trust_score DESC NULLS LAST, pp.created_at DESC
  LIMIT $2 OFFSET $3
`;

/**
 * Providers reachable through `communityId`.
 *
 * Callers MUST have already established that the viewer is an active member — this function
 * answers "what does this community surface", not "may this person see it".
 */
export async function getCommunityProviders(
  communityId: string,
  options: ReachPageOptions = {}
): Promise<CommunityProvider[]> {
  const limit = clampInt(options.limit, DEFAULT_LIMIT, 1, MAX_LIMIT);
  const offset = clampInt(options.offset, 0, 0, Number.MAX_SAFE_INTEGER);

  const result = await query(COMMUNITY_PROVIDER_QUERY, [communityId, limit, offset]);
  return result.rows as CommunityProvider[];
}
