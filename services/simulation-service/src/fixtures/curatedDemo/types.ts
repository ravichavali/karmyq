/**
 * Sprint 117 — Curated Demo Fixtures: type contracts.
 *
 * The manifest is the single authoritative, tunable source for the historical demo
 * baseline. Semantic keys (never literal UUIDs) name every entity; the compiler derives
 * stable UUIDs and reset-relative timestamps from one UTC anchor. Nothing here declares a
 * raw trust edge or an exact trust/karma score — those are *derived* by the fixture-only
 * projection (see `packages/shared/src/projections/completedExchange.ts`) so demo history
 * stays locked to production math.
 */

export type EntityKind =
  | 'person'
  | 'community'
  | 'request'
  | 'exchange'
  | 'provider'
  | 'activity'
  | 'governance';

/**
 * `kind.slug`, e.g. `person.maria` (see {@link EntityKind} for the naming convention).
 * Kept a plain string so the compiler — not the type system — is the single authority that
 * rejects dangling references at runtime, which the fail-closed contract tests exercise with
 * intentionally-unknown keys.
 */
export type SemanticKey = string;

/** ISO-8601-ish relative age: whole days (`P30D`) or whole hours (`PT6H`). */
export type FixtureAge = `P${number}D` | `PT${number}H`;

/**
 * Simulation exclusion class. `protected` identities (Maria, her helper, the provider, and
 * every story dependency) never enter the simulator actor pool. `ambient` identities may be
 * mutated by ongoing synthetic activity after validation.
 */
export type FixtureClassification = 'protected' | 'ambient';

export type MembershipRole = 'member' | 'moderator' | 'admin';
export type MembershipStatus = 'active' | 'pending' | 'invited' | 'left';

export type RequestLifecycle =
  | 'open'
  | 'proposed'
  | 'matched'
  | 'completed'
  | 'rejected'
  | 'declined'
  | 'cancelled'
  | 'expired'
  | 'forgotten';

export type RequestVisibility = 'community' | 'trust_network' | 'platform';
export type MatchLifecycle = 'proposed' | 'accepted' | 'completed' | 'declined' | 'cancelled';

// ---------------------------------------------------------------------------
// Manifest (input) types
// ---------------------------------------------------------------------------

export interface FixturePerson {
  key: SemanticKey;
  name: string;
  email: string;
  classification: FixtureClassification;
  bio?: string;
  /**
   * `false` opts the person out of sharing skills with their communities
   * (`auth.user_privacy_settings.share_skills_with_communities = false`). Omitted means the
   * live default (shared), which writes no privacy row, as for a real new user.
   */
  shareSkills?: false;
}

export interface FixtureCommunity {
  key: SemanticKey;
  name: string;
  /**
   * Descriptive category (`mutual_aid`, `neighborhood`, `sharing`, `professional`, `group`).
   * The DB `community_type` CHECK only permits `mutual_aid`|`group`; the compiler derives it
   * (`group` stays `group`, everything else becomes `mutual_aid`) and keeps this as `category`.
   */
  type: string;
}

export interface FixtureMembership {
  user: SemanticKey;
  community: SemanticKey;
  role: MembershipRole;
  status: MembershipStatus;
  joinedAge: FixtureAge;
}

export interface HistoricalRequestFixture {
  key: SemanticKey;
  requester: SemanticKey;
  communities: SemanticKey[];
  title: string;
  description: string;
  category: string;
  requestType?: string;
  status: RequestLifecycle;
  visibility?: RequestVisibility;
  createdAge: FixtureAge;
  /** For expired/forgotten lanes: age at which the request expires (past → already expired). */
  expiresAge?: FixtureAge;
  helper?: SemanticKey;
  matchStatus?: MatchLifecycle;
  completedAge?: FixtureAge;
  forgotten?: boolean;
}

/**
 * A completed helping exchange between two people in a shared community at a point in time.
 * Each exchange yields a completed request+match and feeds the trust/karma projection. It
 * never declares a trust edge or score directly.
 */
export interface HistoricalExchangeFixture {
  key: SemanticKey;
  requester: SemanticKey;
  helper: SemanticKey;
  community: SemanticKey;
  completedAge: FixtureAge;
  title?: string;
  category?: string;
}

export interface ProviderFixture {
  key: SemanticKey;
  user: SemanticKey;
  community: SemanticKey;
  serviceType: string;
  description: string;
}

export interface GovernanceFixture {
  key: SemanticKey;
  community: SemanticKey;
  proposer: SemanticKey;
  title: string;
  description: string;
  status: 'open' | 'proposed' | 'passed' | 'rejected';
  createdAge: FixtureAge;
}

export interface ActivityFixture {
  key: SemanticKey;
  community: SemanticKey;
  organizer: SemanticKey;
  title: string;
  description: string;
  scheduledAge: FixtureAge; // negative-sense not needed; events sit at anchor - age (past) or future via PT hours
  createdAge: FixtureAge;
}

/** A skill tag (`auth.user_tags`, `tag_type = 'skill'`) held by one person. */
export interface SkillFixture {
  key: SemanticKey;
  owner: SemanticKey;
  /** The stored `tag_value`; for a slugged skill it is the vocabulary label. */
  value: string;
  /** A `auth.skill_vocabulary` slug, or omitted for a deliberate free-text tag. */
  slug?: string;
}

/** A vouch for one of a person's skills, anchored on a completed exchange between the pair. */
export interface EndorsementFixture {
  key: SemanticKey;
  endorser: SemanticKey;
  /** A {@link SkillFixture} key; the endorsee is that skill's owner. */
  skill: SemanticKey;
  exchange: SemanticKey;
  createdAge: FixtureAge;
  withdrawnAge?: FixtureAge;
}

/** An `inventory.items` row, owned by a person or by a community. */
export interface ItemFixture {
  key: SemanticKey;
  /** A person key (personal item) or a community key (community-owned item). */
  owner: SemanticKey;
  name: string;
  description?: string;
  category: string;
  condition?: string;
  status?: string;
  /** Communities a personal item is shared to; a community-owned item has none. */
  sharedWith?: SemanticKey[];
  createdBy?: SemanticKey;
}

/** A standing offer (`requests.help_offers`). */
export interface OfferFixture {
  key: SemanticKey;
  offerer: SemanticKey;
  community: SemanticKey;
  title: string;
  description: string;
  category: string;
  createdAge: FixtureAge;
}

/** A named outward-behaviour expectation the verifier asserts through ordinary APIs. */
export interface FixtureExpectation {
  key: string;
  description: string;
  kind:
    | 'reciprocal-topology'
    | 'shared-neighbors'
    | 'one-hop-floor'
    | 'provider-contrast'
    | 'unrelated-denial'
    | 'privacy-scope'
    | 'aggregate-cohort'
    | 'pulse'
    | 'retention'
    | 'governance'
    | 'activity'
    | 'skills'
    | 'offer-boundary';
  subjects: SemanticKey[];
  value?: number;
}

export interface DemoFixtureTuning {
  peopleTarget: number;
  minimumStoryRunwayDays: number;
  maxPathDegree: number;
  minSharedPeople: number;
  minOneHopPerSide: number;
}

export interface DemoFixtureManifest {
  version: 1;
  tuning: DemoFixtureTuning;
  people: FixturePerson[];
  communities: FixtureCommunity[];
  memberships: FixtureMembership[];
  requests: HistoricalRequestFixture[];
  exchanges: HistoricalExchangeFixture[];
  providers: ProviderFixture[];
  governance: GovernanceFixture[];
  activities: ActivityFixture[];
  skills: SkillFixture[];
  endorsements: EndorsementFixture[];
  items: ItemFixture[];
  offers: OfferFixture[];
  expectedBehaviors: FixtureExpectation[];
}

// ---------------------------------------------------------------------------
// Compiled (output) types
// ---------------------------------------------------------------------------

export interface CompiledPerson {
  id: string;
  key: SemanticKey;
  name: string;
  email: string;
  classification: FixtureClassification;
  bio: string | null;
}

export interface CompiledCommunity {
  id: string;
  key: SemanticKey;
  name: string;
  category: string;
  communityType: 'mutual_aid' | 'group';
  creatorId: string;
}

export interface CompiledMembership {
  id: string;
  userId: string;
  communityId: string;
  role: MembershipRole;
  status: MembershipStatus;
  joinedAt: Date;
}

export interface CompiledRequest {
  id: string;
  key: SemanticKey;
  requesterId: string;
  communityIds: string[];
  title: string;
  description: string;
  category: string;
  requestType: string;
  status: RequestLifecycle;
  visibility: RequestVisibility;
  createdAt: Date;
  expiresAt: Date | null;
  expired: boolean;
  forgotten: boolean;
  match: CompiledMatch | null;
}

export interface CompiledMatch {
  id: string;
  requestId: string;
  responderId: string;
  status: MatchLifecycle;
  completedAt: Date | null;
  createdAt: Date;
}

export interface CompiledProvider {
  id: string;
  key: SemanticKey;
  userId: string;
  communityId: string;
  serviceType: string;
  description: string;
}

export interface CompiledGovernance {
  id: string;
  key: SemanticKey;
  communityId: string;
  proposerId: string;
  title: string;
  description: string;
  status: string;
  createdAt: Date;
}

export interface CompiledActivity {
  id: string;
  key: SemanticKey;
  communityId: string;
  organizerId: string;
  title: string;
  description: string;
  scheduledAt: Date;
  createdAt: Date;
}

/**
 * A completed-exchange projection event. The fixture projection consumes these in
 * chronological order to derive connections, trust edges, and karma records.
 */
export interface CompiledCompletedExchange {
  key: string;
  requesterId: string;
  helperId: string;
  communityId: string;
  communityKey: SemanticKey;
  completedAt: Date;
  category: string;
}

export interface CompiledSkill {
  id: string;
  key: SemanticKey;
  userId: string;
  tagValue: string;
  skillSlug: string | null;
  createdAt: Date;
}

export interface CompiledSkillSetting {
  userId: string;
  shareSkillsWithCommunities: boolean;
}

export interface CompiledEndorsement {
  id: string;
  key: SemanticKey;
  endorserId: string;
  endorseeId: string;
  userTagId: string;
  matchId: string;
  communityId: string;
  createdAt: Date;
  withdrawnAt: Date | null;
  /** 1 for an active vouch, 2 for a withdrawn one (one change after creation). */
  revision: number;
  updatedAt?: Date;
}

export interface CompiledItem {
  id: string;
  key: SemanticKey;
  ownerUserId: string | null;
  ownerCommunityId: string | null;
  name: string;
  description: string | null;
  category: string;
  condition: string | null;
  status: string;
  createdBy: string | null;
  createdAt: Date;
}

export interface CompiledItemShare {
  itemId: string;
  communityId: string;
  sharedAt: Date;
}

export interface CompiledOffer {
  id: string;
  key: SemanticKey;
  communityId: string;
  offererId: string;
  title: string;
  description: string;
  category: string;
  status: 'active';
  expired: boolean;
  createdAt: Date;
  updatedAt: Date;
  expiresAt: Date;
}

/** Derived trust-edge endorsement count for one normalized pair in one community. */
export interface CompiledEndorsementCount {
  userIdA: string;
  userIdB: string;
  communityId: string;
  count: number;
}

export interface CompiledDemoBaseline {
  anchor: Date;
  people: CompiledPerson[];
  communities: CompiledCommunity[];
  memberships: CompiledMembership[];
  requests: CompiledRequest[];
  providers: CompiledProvider[];
  governance: CompiledGovernance[];
  activities: CompiledActivity[];
  /** Chronologically ordered completed exchanges for the fixture projection. */
  projectionEvents: CompiledCompletedExchange[];
  skills: CompiledSkill[];
  skillSettings: CompiledSkillSetting[];
  endorsements: CompiledEndorsement[];
  items: CompiledItem[];
  itemShares: CompiledItemShare[];
  offers: CompiledOffer[];
  endorsementCounts: CompiledEndorsementCount[];
  expectedBehaviors: FixtureExpectation[];
}
