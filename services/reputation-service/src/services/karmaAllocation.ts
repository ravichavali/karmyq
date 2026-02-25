/**
 * Karma Allocation Strategy (ADR-032)
 *
 * Determines how a fixed karma pool per interaction is distributed across
 * shared communities, respecting each community's helper/requester split config.
 *
 * This module is the tuning surface for karma distribution. Future inputs
 * (community weight, request type multiplier, user history, etc.) should be
 * added to the function signature here without touching karmaService.ts.
 */

export interface CommunityKarmaConfig {
  community_id: string;
  karma_split_helper: number;    // Percentage to helper, e.g. 60
  karma_split_requestor: number; // Percentage to requester, e.g. 40
}

export interface CommunityAllocation {
  community_id: string;
  helperPoints: number;    // Integer points for the helper in this community
  requesterPoints: number; // Integer points for the requester in this community
}

/**
 * Allocate a fixed karma pool across shared communities.
 *
 * The total pool is divided equally across communities, then each community's
 * split ratio determines how much goes to the helper vs requester from that
 * community's share. Uses largest-remainder rounding so the integer awards
 * always sum exactly to totalPool.
 *
 * @param configs - Each shared community and its split config
 * @param totalPool - Total karma points for this interaction (fixed regardless of community count)
 * @returns Per-community integer allocations for helper and requester
 *
 * @example
 * // 2 communities, pool=15, splits 60/40 and 50/50
 * // Community A: pool=7.5 → helper=4.5, requester=3.0
 * // Community B: pool=7.5 → helper=3.75, requester=3.75
 * // After rounding: A=(5,3), B=(4,3) — total helper=9, requester=6, sum=15 ✓
 */
export function allocateKarma(
  configs: CommunityKarmaConfig[],
  totalPool: number
): CommunityAllocation[] {
  if (configs.length === 0) return [];

  const poolPerCommunity = totalPool / configs.length;

  // Compute exact (float) allocations per community per role
  const exact = configs.map((config) => ({
    community_id: config.community_id,
    helperExact: poolPerCommunity * (config.karma_split_helper / 100),
    requesterExact: poolPerCommunity * (config.karma_split_requestor / 100),
  }));

  // Flatten all allocations into a single list for largest-remainder rounding
  // Each entry: { community_id, role, exact, floored, remainder }
  type RoundEntry = {
    community_id: string;
    role: 'helper' | 'requester';
    exact: number;
    floored: number;
    remainder: number;
  };

  const entries: RoundEntry[] = exact.flatMap((e) => [
    {
      community_id: e.community_id,
      role: 'helper' as const,
      exact: e.helperExact,
      floored: Math.floor(e.helperExact),
      remainder: e.helperExact - Math.floor(e.helperExact),
    },
    {
      community_id: e.community_id,
      role: 'requester' as const,
      exact: e.requesterExact,
      floored: Math.floor(e.requesterExact),
      remainder: e.requesterExact - Math.floor(e.requesterExact),
    },
  ]);

  // Total assigned so far (sum of floors)
  const totalFloored = entries.reduce((sum, e) => sum + e.floored, 0);
  let remainder = Math.round(totalPool - totalFloored); // points left to distribute

  // Sort by remainder descending — highest fractional parts get the extra point
  entries.sort((a, b) => b.remainder - a.remainder);

  // Distribute remaining points to top entries by remainder
  const awarded = new Map<string, number>(); // key: `${community_id}:${role}`
  for (const entry of entries) {
    const key = `${entry.community_id}:${entry.role}`;
    awarded.set(key, entry.floored + (remainder > 0 ? 1 : 0));
    if (remainder > 0) remainder--;
  }

  return configs.map((config) => ({
    community_id: config.community_id,
    helperPoints: awarded.get(`${config.community_id}:helper`) ?? 0,
    requesterPoints: awarded.get(`${config.community_id}:requester`) ?? 0,
  }));
}
