/**
 * Sprint 112 — Reputation Disclosure Boundary (ADR-082).
 *
 * Strict, Zod-backed outward DTO contracts that make an ordinary member's exact reputation
 * self-only at the API boundary. Services compute with rich internal rows and then EXPLICITLY
 * project to these schemas at the final response boundary.
 *
 * Core principle: show belonging structure; protect exact scoring.
 *
 *  - `self`                exact community-scoped reputation, returned only to the caller.
 *  - `ordinary_member`     authorized identity/structure + coarse relationship state. No exact
 *                          reputation. Strict schemas reject `trust_score`/`karma`/`*_weight`.
 *  - `provider`            opted-in public service-provider ratings (explicit numeric exception).
 *  - `community_aggregate` non-identifying community totals, ≥5-member cohort (explicit exception).
 *  - `internal`           community-admin policy surfaces; never carry member parameters.
 *
 * Schemas are `.strict()` so an accidental row spread (e.g. `{ ...dbRow }`) fails projection tests
 * rather than silently leaking. The recursive `assertNoForbiddenReputationKeys` scanner is the
 * defence-in-depth backstop for ordinary-member/self fixtures (NOT applied to provider/aggregate
 * exceptions, which legitimately carry numeric reputation fields).
 */
import { z } from 'zod';

// --- Disclosure classes ------------------------------------------------------

export const DisclosureClassSchema = z.enum([
  'self',
  'ordinary_member',
  'provider',
  'community_aggregate',
  'internal',
]);
export type DisclosureClass = z.infer<typeof DisclosureClassSchema>;

// --- Relationship state ------------------------------------------------------
// Qualitative bond strength derived from the ADR-070 decay tier. `swept` edges are not returned
// outward, so the outward relationship state is exactly four values.
export const RelationshipStateSchema = z.enum([
  'strong',
  'warm',
  'fading',
  'nearly_forgotten',
]);
export type RelationshipState = z.infer<typeof RelationshipStateSchema>;

// --- Identity ----------------------------------------------------------------

export const PublicMemberIdentitySchema = z
  .object({
    user_id: z.string().uuid(),
    name: z.string(),
  })
  .strict();
export type PublicMemberIdentity = z.infer<typeof PublicMemberIdentitySchema>;

// --- Self reputation (community-scoped) --------------------------------------

export const ReputationTierSchema = z.enum(['new', 'active', 'trusted', 'highly_trusted']);
export type ReputationTier = z.infer<typeof ReputationTierSchema>;

export const KarmaTrendSchema = z.enum(['growing', 'stable', 'declining']);
export type KarmaTrend = z.infer<typeof KarmaTrendSchema>;

export const SelfCommunityReputationSchema = z
  .object({
    scope: z
      .object({
        type: z.literal('community'),
        community_id: z.string().uuid(),
        community_name: z.string(),
      })
      .strict(),
    reputation: z
      .object({
        score: z.number(),
        scale_min: z.literal(0),
        scale_max: z.literal(100),
        tier: ReputationTierSchema,
        calculated_at: z.string(),
      })
      .strict(),
    karma: z
      .object({
        current: z.number(),
        trend: KarmaTrendSchema,
        half_life_days: z.number(),
        calculated_at: z.string(),
      })
      .strict(),
    activity: z
      .object({
        recent_helps: z.number(),
        recent_requests: z.number(),
        window_days: z.literal(30),
      })
      .strict(),
  })
  .strict();
export type SelfCommunityReputation = z.infer<typeof SelfCommunityReputationSchema>;

// --- Governance --------------------------------------------------------------

export const GovernanceEligibilityReasonSchema = z.enum([
  'established_community_relationships',
  'eligibility_threshold_not_met',
]);
export type GovernanceEligibilityReason = z.infer<typeof GovernanceEligibilityReasonSchema>;

export const GovernanceEligibleMemberSchema = z
  .object({
    user_id: z.string().uuid(),
    name: z.string(),
    eligible: z.literal(true),
    eligibility_reason: z.literal('established_community_relationships'),
  })
  .strict();
export type GovernanceEligibleMember = z.infer<typeof GovernanceEligibleMemberSchema>;

export const GovernanceRoleHolderSchema = z
  .object({
    user_id: z.string().uuid(),
    name: z.string(),
    role: z.enum(['admin', 'moderator']),
  })
  .strict();
export type GovernanceRoleHolder = z.infer<typeof GovernanceRoleHolderSchema>;

// The member-level projection of a governance response. The surrounding governance object carries
// unrelated settings/maturity/nominations, so this schema validates the privacy-sensitive member
// arrays without constraining the rest of the response.
export const GovernanceStateSchema = z.object({
  eligible_members: z.array(GovernanceEligibleMemberSchema),
  role_holders: z.array(GovernanceRoleHolderSchema),
});
export type GovernanceState = z.infer<typeof GovernanceStateSchema>;

// --- Safe person graph -------------------------------------------------------

const DegreesOfSeparationSchema = z.union([
  z.literal(0),
  z.literal(1),
  z.literal(2),
  z.literal(3),
]);

export const SafeBelongingNodeSchema = z
  .object({
    user_id: z.string().uuid(),
    name: z.string(),
    is_current_user: z.boolean(),
    degrees_of_separation: DegreesOfSeparationSchema.optional(),
  })
  .strict();
export type SafeBelongingNode = z.infer<typeof SafeBelongingNodeSchema>;

export const SafeBelongingLinkSchema = z
  .object({
    source: z.string(),
    target: z.string(),
    relationship_state: RelationshipStateSchema,
    type: z.enum(['organic', 'fission']).optional(),
  })
  .strict();
export type SafeBelongingLink = z.infer<typeof SafeBelongingLinkSchema>;

export const SafePersonGraphSchema = z
  .object({
    nodes: z.array(SafeBelongingNodeSchema),
    links: z.array(SafeBelongingLinkSchema),
  })
  .strict();
export type SafePersonGraph = z.infer<typeof SafePersonGraphSchema>;

// --- Safe trust path / card --------------------------------------------------
// Outward path/card responses keep topology + a coarse relationship band; the numeric path
// strength stays internal to feed ranking and is never projected here.
export const SafeTrustPathSchema = z
  .object({
    target_user_id: z.string().uuid(),
    degrees_of_separation: DegreesOfSeparationSchema.nullable(),
    path: z.array(PublicMemberIdentitySchema),
    connection_type: z.enum(['organic', 'fission']).optional(),
    relationship_state: RelationshipStateSchema.optional(),
  })
  .strict();
export type SafeTrustPath = z.infer<typeof SafeTrustPathSchema>;

// --- Explicit exceptions: provider + community aggregate ---------------------
// Provider ratings describe an opted-in service-provider role, not a person's private mutual-aid
// reputation, so this schema legitimately carries numeric fields. It is a DISTINCT type and must
// never be used to widen the ordinary-member schema with optional reputation fields.
export const ProviderReputationSchema = z
  .object({
    provider_id: z.string(),
    avg_stars: z.number(),
    total_reviews: z.number(),
    completion_rate: z.number(),
    response_rate: z.number(),
    trust_score: z.number(),
    last_calculated: z.string(),
  })
  .strict();
export type ProviderReputation = z.infer<typeof ProviderReputationSchema>;

// Community aggregates are outward-safe only when they cannot be decomposed into one member's value
// (≥5 distinct members; enforced in the service, not the schema). They may carry totals/averages,
// so this schema is intentionally permissive about additional aggregate fields but requires a
// community scope.
export const CommunityAggregateSchema = z
  .object({
    community_id: z.string(),
  })
  .passthrough();
export type CommunityAggregate = z.infer<typeof CommunityAggregateSchema>;

// --- Forbidden-key scanner (defence in depth) --------------------------------
// Keys that must never appear in an ordinary-member or self-graph outward response. The scanner is
// the regression backstop behind strict schemas; it is applied to ordinary_member/self fixtures,
// NOT to provider or community_aggregate exception fixtures.
export const FORBIDDEN_ORDINARY_MEMBER_KEYS: ReadonlySet<string> = new Set([
  'trust_score',
  'karma',
  'total_karma',
  'raw_weight',
  'effective_weight',
  'currentWeight',
  'current_weight',
  'avg_invitee_karma',
  'avg_invitee_trust_score',
  // Sprint 112 round-3 (ADR-082): the composite feed score is reconstruction-enabling — with the
  // public weighted-sum formula and readable community weights, exposing it lets requester trust be
  // solved. It must never appear in an ordinary-member outward contract (the feed exposes a coarse,
  // non-reversible rank instead).
  'feedScore',
  'feed_score',
]);

/**
 * Recursively collect the JSON paths of any forbidden reputation keys in `value`.
 * Returns an empty array when the structure is clean.
 */
export function findForbiddenReputationKeys(value: unknown, trail = '$'): string[] {
  const found: string[] = [];
  if (Array.isArray(value)) {
    value.forEach((item, i) => found.push(...findForbiddenReputationKeys(item, `${trail}[${i}]`)));
    return found;
  }
  if (value !== null && typeof value === 'object') {
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      const childTrail = `${trail}.${key}`;
      if (FORBIDDEN_ORDINARY_MEMBER_KEYS.has(key)) {
        found.push(childTrail);
      }
      found.push(...findForbiddenReputationKeys(child, childTrail));
    }
  }
  return found;
}

/**
 * Throw if `value` contains any forbidden reputation key at any nesting depth.
 */
export function assertNoForbiddenReputationKeys(value: unknown, trail = '$'): void {
  const found = findForbiddenReputationKeys(value, trail);
  if (found.length > 0) {
    throw new Error(
      `Forbidden reputation key(s) found in disclosure-protected payload: ${found.join(', ')}`,
    );
  }
}
