/**
 * Sprint 90 — Visible Decay Model (ADR-070).
 *
 * Classifies a relationship edge's *decayed* weight into a qualitative tier, so the frontend can render
 * bonds that perceptibly fade. This is a pure classification over values the `trust_edges_live` view
 * already exposes (`current_weight`) and the resolved `disappearance_threshold` — NO new decay math.
 *
 * Let r = current_weight / disappearance_threshold:
 *   strong            r ≥ 3      active, well-tended
 *   warm              2 ≤ r < 3  healthy
 *   fading            1.3 ≤ r < 2  going quiet; visibly faded
 *   nearly_forgotten  1 ≤ r < 1.3  about to be swept — triggers the re-warming nudge
 *   swept             r < 1      already deleted by trustEdgeSweepJob; not normally returned
 *
 * This is the SINGLE source of the band math — consumed by the social-graph endpoints and their tests.
 * Never inline these thresholds elsewhere; they will drift.
 */
export type DecayTier = 'strong' | 'warm' | 'fading' | 'nearly_forgotten' | 'swept';

export function classifyDecayTier(currentWeight: number, threshold: number): DecayTier {
  // A non-positive threshold means the edge can never disappear — treat any positive weight as strong.
  if (!Number.isFinite(threshold) || threshold <= 0) {
    return currentWeight > 0 ? 'strong' : 'swept';
  }
  const r = currentWeight / threshold;
  if (r >= 3) return 'strong';
  if (r >= 2) return 'warm';
  if (r >= 1.3) return 'fading';
  if (r >= 1) return 'nearly_forgotten';
  return 'swept';
}
