import type { RelationshipContext } from '../db/dibsDb';

/**
 * Why this candidate is the first-ask (ADR-072). Derived server-side from the
 * candidate's facet + relationship history so the UI renders the judgment, not the
 * rules. Pure policy — no I/O — so it lives apart from the route and is unit-tested
 * directly.
 */
export type DibsReason =
  | 'prior_similar_success'
  | 'trusted_neighbor'
  | 'provider_match'
  | 'community_connection';

export function deriveDibsReason(kind: 'neighbor' | 'provider', ctx: RelationshipContext): DibsReason {
  if (kind === 'provider') return 'provider_match';
  if (ctx.priorCompletedMatches >= 1 && ctx.similarCategory) return 'prior_similar_success';
  if (ctx.priorCompletedMatches >= 1) return 'trusted_neighbor';
  // Zero completed matches — admitted via a community (exchange) trust edge. Don't claim
  // prior work; frame it honestly as a community connection (Sprint 93).
  return 'community_connection';
}
