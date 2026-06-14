/**
 * Community context resolution for trust-path requests (Sprint 98, BUG-098-002).
 *
 * Trust-path TOPOLOGY is platform-wide: a completed exchange creates a path regardless
 * of community, and the schema cannot attribute a match to a single community
 * (requests.help_requests has no community_id; requests.request_communities is
 * many-to-many). Community context only scopes the trust SCORE / karma + the cache key.
 *
 * Historically the routes fell back to the literal string 'platform' when no community
 * context existed, then compared it against the UUID column auth.social_distances.community_id
 * — which throws `invalid input syntax for type uuid` and 500s. This module replaces that
 * with a labeled platform scope keyed by a valid sentinel UUID.
 */

/** Sentinel UUID used as the cache key + score scope for platform-wide paths.
 *  All-zeros is never produced by gen_random_uuid(), so it cannot collide with a real
 *  community id. There is no FK on social_distances.community_id, so it is safe to store. */
export const PLATFORM_COMMUNITY_ID = '00000000-0000-0000-0000-000000000000';

export type CommunityScope = 'community' | 'platform';

export interface CommunityContext {
  /** Always a valid UUID — a real community id, or the PLATFORM_COMMUNITY_ID sentinel. */
  communityId: string;
  scope: CommunityScope;
}

export interface ResolveResult {
  ok: boolean;
  /** Present when `ok` is true. */
  context?: CommunityContext;
  /** Present when `ok` is false — a human-readable validation reason. */
  reason?: string;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_RE.test(value);
}

/**
 * Resolve the community context for a trust-path request.
 *
 * Precedence: explicit `X-Community-ID` header → JWT `currentCommunityId` → platform sentinel.
 * A present-but-malformed header is rejected (caller should respond 400) so a non-UUID never
 * reaches a UUID column.
 */
export function resolveCommunityContext(
  headerValue: string | undefined,
  jwtCurrentCommunityId: string | undefined
): ResolveResult {
  // Header is untrusted input — validate strictly when present and non-empty.
  if (headerValue !== undefined && headerValue !== '') {
    if (!isUuid(headerValue)) {
      return { ok: false, reason: 'X-Community-ID must be a valid UUID' };
    }
    return { ok: true, context: { communityId: headerValue, scope: 'community' } };
  }

  if (isUuid(jwtCurrentCommunityId)) {
    return { ok: true, context: { communityId: jwtCurrentCommunityId, scope: 'community' } };
  }

  return { ok: true, context: { communityId: PLATFORM_COMMUNITY_ID, scope: 'platform' } };
}
