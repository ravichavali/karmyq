import { getEligibleCandidates, getMutualAidCandidates, RawCandidate } from '../db/dibsDb';

// Re-export RawCandidate so callers can use the unified type
export type { RawCandidate };

// ── Scoring constants ─────────────────────────────────────────────────────────

const TRUST_SCORE_WEIGHT = 0.50;
const PRIOR_INTERACTION_MULTIPLIER = 11.67;
const MAX_PRIOR_INTERACTIONS = 3;
const TRUST_GRAPH_BONUS_DIRECT = 15;
const TRUST_GRAPH_BONUS_INDIRECT = 10;
const MAX_RANKED_CANDIDATES = 5;

// ── Scored candidate ──────────────────────────────────────────────────────────

export interface ScoredCandidate extends RawCandidate {
  score: number;
}

// ── scoreCandidate ────────────────────────────────────────────────────────────

/**
 * Compute the numeric dibs score for a single candidate.
 *
 * Formula:
 *   score = trustScore * 0.50
 *         + min(priorInteractions, 3) * 11.67
 *         + trustGraphBonus
 *
 * trustGraphBonus:
 *   'direct'   → 15
 *   'indirect' → 10
 *   'none'     → 0
 */
export function scoreCandidate(candidate: RawCandidate): number {
  const interactionComponent =
    Math.min(candidate.priorInteractions, MAX_PRIOR_INTERACTIONS) *
    PRIOR_INTERACTION_MULTIPLIER;

  let trustGraphBonus = 0;
  if (candidate.trustGraphConnection === 'direct') {
    trustGraphBonus = TRUST_GRAPH_BONUS_DIRECT;
  } else if (candidate.trustGraphConnection === 'indirect') {
    trustGraphBonus = TRUST_GRAPH_BONUS_INDIRECT;
  }

  return candidate.trustScore * TRUST_SCORE_WEIGHT + interactionComponent + trustGraphBonus;
}

// ── filterEligibleCandidates ──────────────────────────────────────────────────

/**
 * Two-tier explore/exploit filter (ADR-051):
 *   Tier 1 (exploit): prior interactions >= 1 + available — preferred
 *   Tier 2 (explore): 0 prior interactions + direct exchange connection + available
 *                     — fallback only when Tier 1 is empty
 */
export function filterEligibleCandidates(candidates: RawCandidate[]): RawCandidate[] {
  const exploit = candidates.filter(c => c.priorInteractions >= 1 && c.isAvailable);
  if (exploit.length > 0) return exploit;
  return candidates.filter(
    c => c.priorInteractions === 0 && c.trustGraphConnection === 'direct' && c.isAvailable
  );
}

// ── selectTopCandidate ────────────────────────────────────────────────────────

/**
 * From a list of raw candidates, filter for eligibility, score each one,
 * and return the highest-scored candidate (or null if none are eligible).
 */
export function selectTopCandidate(candidates: RawCandidate[]): RawCandidate | null {
  const eligible = filterEligibleCandidates(candidates);
  if (eligible.length === 0) return null;

  let top: RawCandidate = eligible[0];
  let topScore = scoreCandidate(eligible[0]);

  for (let i = 1; i < eligible.length; i++) {
    const s = scoreCandidate(eligible[i]);
    if (s > topScore) {
      topScore = s;
      top = eligible[i];
    }
  }

  return top;
}

// ── rankCandidates ────────────────────────────────────────────────────────────

/**
 * Score and sort all eligible candidates descending by score.
 * Returns at most MAX_RANKED_CANDIDATES (5) entries.
 */
export function rankCandidates(candidates: RawCandidate[]): ScoredCandidate[] {
  const eligible = filterEligibleCandidates(candidates);
  return eligible
    .map((c) => ({ ...c, score: scoreCandidate(c) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_RANKED_CANDIDATES);
}

// ── getBestCandidate ──────────────────────────────────────────────────────────

/**
 * Query eligible candidates from the DB, score them, and return the top one.
 * Returns null if no eligible candidates exist.
 */
export async function getBestCandidate(
  requesterId: string,
  communityIds: string[]
): Promise<ScoredCandidate | null> {
  const candidates = await getEligibleCandidates(requesterId, communityIds);
  if (candidates.length === 0) return null;

  const ranked = rankCandidates(candidates);
  return ranked[0] ?? null;
}

// ── getMutualAidBestCandidate ─────────────────────────────────────────────────

/**
 * Query mutual aid candidates (non-provider-profile users with prior interactions),
 * score them, and return the top one. Used for non-service request types.
 */
export async function getMutualAidBestCandidate(
  requesterId: string,
  communityIds: string[]
): Promise<ScoredCandidate | null> {
  const candidates = await getMutualAidCandidates(requesterId, communityIds);
  if (candidates.length === 0) return null;
  const ranked = rankCandidates(candidates);
  return ranked[0] ?? null;
}
