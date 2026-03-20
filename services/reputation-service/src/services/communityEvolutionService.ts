// services/reputation-service/src/services/communityEvolutionService.ts
import {
  getMemberPriorDeltas,
  getInteractionRate,
  getPreviousInteractionRate,
  getDaysSinceLastEvolution,
  getRecentPriorEvolutionDeltas,
  getCommunityEvolvingParams,
  applyCommunityConfigNudge,
  insertCommunityEvolutionLog,
} from '../database/communityEvolutionDb';

const COMMUNITY_COOLDOWN_DAYS = 30;
const MIN_CONTRIBUTING_MEMBERS = 3;
const PRIOR_DAMPING = 0.30;

/** Pure: compute median of a list of deltas. Returns 0 for empty list. */
export function computeAggregateDeltas(deltas: number[]): number {
  if (deltas.length === 0) return 0;
  const sorted = [...deltas].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? round2((sorted[mid - 1] + sorted[mid]) / 2)
    : round2(sorted[mid]);
}

/** Pure: compute damping factor based on interaction rate trend.
 *  previousRate=null means first cycle — no dampening. */
export function computeDampingFactor(
  previousRate: number | null,
  currentRate: number
): number {
  if (previousRate === null || previousRate === 0) return 1.0;
  const change = (currentRate - previousRate) / previousRate;
  if (change <= -0.25) return 0.0;
  if (change <= -0.10) return 0.5;
  return 1.0;
}

/** Pure: returns 1 (up), -1 (down), or false (no consensus) for hop evolution.
 *  Requires exactly 3+ recent aggregate_delta values all in the same direction. */
export function shouldEvolveHops(recentDeltas: number[]): 1 | -1 | false {
  if (recentDeltas.length < 3) return false;
  const last3 = recentDeltas.slice(0, 3);
  const allPositive = last3.every(d => d > 0);
  const allNegative = last3.every(d => d < 0);
  if (allPositive) return 1;
  if (allNegative) return -1;
  return false;
}

function round2(n: number): number {
  return parseFloat(n.toFixed(2));
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Main entry point — called by Bull job handler.
 *  Never throws; errors are caught and logged. */
export async function applyCommunityEvolution(communityId: string): Promise<void> {
  try {
    // 1. Load current config and check evolution flag
    const params = await getCommunityEvolvingParams(communityId);
    if (!params) return;
    if (!params.community_evolution_enabled) return;

    // 2. Cooldown check
    const daysSinceLast = await getDaysSinceLastEvolution(communityId);
    if (daysSinceLast !== null && daysSinceLast < COMMUNITY_COOLDOWN_DAYS) return;

    // 3. Gather member deltas
    const memberDeltas = await getMemberPriorDeltas(communityId);
    if (memberDeltas.length < MIN_CONTRIBUTING_MEMBERS) return;

    const rawDeltas = memberDeltas.map(m => m.delta);
    const aggregateDelta = computeAggregateDeltas(rawDeltas);
    if (aggregateDelta === 0) return;

    // 4. Interaction rate health check
    const [currentRate, previousRate] = await Promise.all([
      getInteractionRate(communityId),
      getPreviousInteractionRate(communityId),
    ]);
    const damping = computeDampingFactor(previousRate, currentRate);

    // 5. Compute nudge for cross_community_prior
    const priorNudge = round2(aggregateDelta * PRIOR_DAMPING * damping);
    if (priorNudge === 0) {
      // Damped to zero — log it but don't apply config changes
      await insertCommunityEvolutionLog({
        community_id: communityId,
        parameter: 'cross_community_prior',
        old_value: params.cross_community_prior,
        new_value: params.cross_community_prior,
        aggregate_delta: aggregateDelta,
        contributing_member_count: memberDeltas.length,
        interaction_rate_snapshot: currentRate,
        damping_applied: damping,
      });
      return;
    }

    const newPrior = round2(clamp(
      params.cross_community_prior + priorNudge,
      0.05, 0.95
    ));

    // 6. Karma split follows prior direction (±1)
    const splitDirection = priorNudge > 0 ? 1 : -1;
    const newKarmaSplit = clamp(params.karma_split_helper + splitDirection, 0, 100);

    // 7. Hop evolution — direction consensus gate
    const recentDeltas = await getRecentPriorEvolutionDeltas(communityId, 3);
    const hopDirection = shouldEvolveHops([...recentDeltas, aggregateDelta]);
    const newHops = hopDirection !== false
      ? clamp(params.trust_path_max_hops + hopDirection, 1, 5)
      : params.trust_path_max_hops;

    // 8. Apply config changes
    const configPatch: Record<string, number> = {
      cross_community_prior: newPrior,
      karma_split_helper: newKarmaSplit,
    };
    if (newHops !== params.trust_path_max_hops) {
      configPatch.trust_path_max_hops = newHops;
    }
    await applyCommunityConfigNudge(communityId, configPatch);

    // 9. Log each changed parameter
    await insertCommunityEvolutionLog({
      community_id: communityId,
      parameter: 'cross_community_prior',
      old_value: params.cross_community_prior,
      new_value: newPrior,
      aggregate_delta: aggregateDelta,
      contributing_member_count: memberDeltas.length,
      interaction_rate_snapshot: currentRate,
      damping_applied: damping,
    });

    if (newKarmaSplit !== params.karma_split_helper) {
      await insertCommunityEvolutionLog({
        community_id: communityId,
        parameter: 'karma_split_helper',
        old_value: params.karma_split_helper,
        new_value: newKarmaSplit,
        aggregate_delta: splitDirection,
        contributing_member_count: memberDeltas.length,
        interaction_rate_snapshot: currentRate,
        damping_applied: damping,
      });
    }

    if (newHops !== params.trust_path_max_hops) {
      await insertCommunityEvolutionLog({
        community_id: communityId,
        parameter: 'trust_path_max_hops',
        old_value: params.trust_path_max_hops,
        new_value: newHops,
        aggregate_delta: hopDirection as number,
        contributing_member_count: memberDeltas.length,
        interaction_rate_snapshot: currentRate,
        damping_applied: damping,
      });
    }
  } catch (err) {
    console.error(`[communityEvolution] Error for community ${communityId}:`, err);
    // Never rethrow — evolution failure must not affect caller
  }
}
