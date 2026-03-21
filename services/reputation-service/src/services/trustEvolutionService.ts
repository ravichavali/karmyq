// services/reputation-service/src/services/trustEvolutionService.ts
import Queue from 'bull';
import {
  getUserTrustConfig,
  upsertUserTrustConfig,
  insertEvolutionLog,
  getLastEvolutionForParameter,
  getCommunityEvolutionConfig,
  getGlobalEvolutionPreference,
} from '../database/trustEvolutionDb';
import { getCommunityTrustConfig } from '../database/trustConfigDb';
import { invalidateEffectiveParamsCache } from './effectiveParamsCache';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
// Lazy singleton — queue is only created when first used, not at import time
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _communityEvolutionQueue: any = null;
function getCommunityEvolutionQueue() {
  if (!_communityEvolutionQueue) {
    _communityEvolutionQueue = new Queue('karmyq-community-evolution', REDIS_URL);
  }
  return _communityEvolutionQueue;
}

export const EVOLUTION_SIGNALS = {
  CROSS_COMMUNITY_POSITIVE_FEEDBACK: 'cross_community_positive_feedback',
  CROSS_COMMUNITY_NEGATIVE_FEEDBACK: 'cross_community_negative_feedback',
  CROSS_COMMUNITY_MATCH_COMPLETED:   'cross_community_match_completed',
  REPEAT_INTERACTION_SAME_PERSON:    'repeat_interaction_same_person',
  DIVERSE_COMMUNITY_INTERACTIONS:    'diverse_community_interactions',
} as const;

// Parameter bounds — direction-agnostic; both ends are valid calibrations
const BOUNDS = {
  depth_weight:          { min: 0.10, max: 0.90 },
  breadth_weight:        { min: 0.10, max: 0.90 },
  cross_community_prior: { min: 0.05, max: 0.95 },
} as const;

type BoundedParam = keyof typeof BOUNDS;

// Each signal nudges specific parameters by a delta.
// Positive deltas calibrate upward; negative deltas calibrate downward.
// Neither direction is "better" — accuracy to experience is the goal.
const SIGNAL_NUDGES: Record<string, Array<{ parameter: BoundedParam; delta: number }>> = {
  cross_community_positive_feedback: [
    { parameter: 'cross_community_prior', delta: +0.02 },
    { parameter: 'breadth_weight',        delta: +0.01 },
  ],
  cross_community_negative_feedback: [
    { parameter: 'cross_community_prior', delta: -0.02 },
  ],
  cross_community_match_completed: [
    { parameter: 'cross_community_prior', delta: +0.01 },
  ],
  repeat_interaction_same_person: [
    { parameter: 'depth_weight',          delta: +0.01 },
  ],
  diverse_community_interactions: [
    { parameter: 'breadth_weight',        delta: +0.02 },
    { parameter: 'cross_community_prior', delta: +0.01 },
  ],
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function round2(value: number): number {
  return parseFloat(value.toFixed(2));
}

/** Returns user's effective trust params: user overrides + community defaults for NULLs.
 *  This is the Sprint 32 integration point — feed/matching will call this. */
export async function getUserEffectiveParams(
  userId: string,
  communityId: string
): Promise<{ depth_weight: number; breadth_weight: number; cross_community_prior: number }> {
  const [userConfig, communityConfig] = await Promise.all([
    getUserTrustConfig(userId, communityId),
    getCommunityTrustConfig(communityId),
  ]);
  return {
    depth_weight:          userConfig?.depth_weight          ?? communityConfig.depth_weight,
    breadth_weight:        userConfig?.breadth_weight        ?? communityConfig.breadth_weight,
    cross_community_prior: userConfig?.cross_community_prior ?? 0.50,
  };
}

/** All gates must pass for a nudge to apply. Global opt-out is checked first. */
export async function isEvolutionEligible(
  userId: string,
  communityId: string,
  parameter: string,
  cooldownDays = 7
): Promise<boolean> {
  const [globalPref, communityEvolution, userConfig, lastEvolution] = await Promise.all([
    getGlobalEvolutionPreference(userId),
    getCommunityEvolutionConfig(communityId),
    getUserTrustConfig(userId, communityId),
    getLastEvolutionForParameter(userId, communityId, parameter),
  ]);
  if (!globalPref) return false;                               // global opt-out gate (Sprint 32)
  if (!communityEvolution.community_evolution_enabled) return false;
  if (!userConfig?.evolution_enabled) return false;
  if (lastEvolution) {
    const daysSince = (Date.now() - lastEvolution.getTime()) / (1000 * 60 * 60 * 24);
    if (daysSince < cooldownDays) return false;
  }
  return true;
}

/** Evaluate whether a signal should nudge a user's trust parameters.
 *  Applies all eligible nudges, clamps to bounds, and logs each adjustment. */
export async function evaluateUserEvolution(
  userId: string,
  communityId: string,
  signal: string,
  context: { triggerEventId?: string } = {}
): Promise<void> {
  const nudges = SIGNAL_NUDGES[signal];
  if (!nudges) return;

  const effectiveParams = await getUserEffectiveParams(userId, communityId);

  for (const { parameter, delta } of nudges) {
    const eligible = await isEvolutionEligible(userId, communityId, parameter);
    if (!eligible) continue;

    const currentValue = effectiveParams[parameter];
    const { min, max } = BOUNDS[parameter];
    const newValue = round2(clamp(currentValue + delta, min, max));

    if (newValue === currentValue) continue; // already at bound, no change

    await upsertUserTrustConfig(userId, communityId, { [parameter]: newValue });
    // Invalidate Redis cache for this user+community pair (caller-side to avoid circular import)
    await invalidateEffectiveParamsCache(userId, communityId);
    await insertEvolutionLog({
      user_id:          userId,
      community_id:     communityId,
      parameter,
      old_value:        currentValue,
      new_value:        newValue,
      trigger_signal:   signal,
      trigger_event_id: context.triggerEventId,
    });
  }

  // Queue a community evolution check — fire-and-forget (don't await; never block user evolution)
  getCommunityEvolutionQueue().add(
    { communityId },
    {
      jobId: communityId,         // deduplication key — one pending job per community
      delay: 5000,                // 5s delay to allow multiple user evolutions to coalesce
      removeOnComplete: true,
      removeOnFail: false,
    }
  ).catch((err: Error) => {
    console.error('[trustEvolution] Failed to queue community evolution check:', err);
  });
}
