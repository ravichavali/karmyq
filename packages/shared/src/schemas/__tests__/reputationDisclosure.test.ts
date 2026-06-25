/**
 * Sprint 112 — Reputation Disclosure Boundary (ADR-082).
 *
 * These tests lock the strict outward DTO contracts that keep an ordinary member's exact
 * reputation self-only. Strict schemas must REJECT forbidden metric keys rather than silently
 * passing them through, and the recursive forbidden-key scanner must catch leaks at any depth.
 */
import {
  DisclosureClassSchema,
  RelationshipStateSchema,
  SelfCommunityReputationSchema,
  GovernanceStateSchema,
  GovernanceEligibleMemberSchema,
  SafeBelongingNodeSchema,
  SafeBelongingLinkSchema,
  SafePersonGraphSchema,
  SafeTrustPathSchema,
  CommunityAggregateSchema,
  ProviderReputationSchema,
  PublicMemberIdentitySchema,
  FORBIDDEN_ORDINARY_MEMBER_KEYS,
  assertNoForbiddenReputationKeys,
  findForbiddenReputationKeys,
} from '../reputationDisclosure';

// Non-zero sentinels: a response full of zeroes cannot prove a leak is absent (spec note 9).
const SENTINEL_KARMA = 913;
const SENTINEL_TRUST = 827;
const SENTINEL_WEIGHT = 41;

const U1 = '11111111-1111-1111-1111-111111111111';
const U2 = '22222222-2222-2222-2222-222222222222';
const C1 = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
const NOW = '2026-06-24T00:00:00.000Z';

describe('DisclosureClassSchema', () => {
  it('accepts the five disclosure classes', () => {
    for (const cls of ['self', 'ordinary_member', 'provider', 'community_aggregate', 'internal']) {
      expect(() => DisclosureClassSchema.parse(cls)).not.toThrow();
    }
  });
  it('rejects unknown classes', () => {
    expect(() => DisclosureClassSchema.parse('admin')).toThrow();
  });
});

describe('RelationshipStateSchema', () => {
  it('accepts the four qualitative relationship states', () => {
    for (const s of ['strong', 'warm', 'fading', 'nearly_forgotten']) {
      expect(() => RelationshipStateSchema.parse(s)).not.toThrow();
    }
  });
  it('rejects swept (never an outward state) and numeric weights', () => {
    expect(() => RelationshipStateSchema.parse('swept')).toThrow();
    expect(() => RelationshipStateSchema.parse(SENTINEL_WEIGHT)).toThrow();
  });
});

describe('SafeBelongingNodeSchema', () => {
  const validNode = { user_id: U2, name: 'Peer', is_current_user: false };

  it('accepts an identity-only node with optional degrees', () => {
    expect(() => SafeBelongingNodeSchema.parse(validNode)).not.toThrow();
    expect(() => SafeBelongingNodeSchema.parse({ ...validNode, degrees_of_separation: 2 })).not.toThrow();
  });

  it('rejects a node carrying karma (strict, not silent passthrough)', () => {
    expect(() => SafeBelongingNodeSchema.parse({ ...validNode, karma: SENTINEL_KARMA })).toThrow();
  });

  it('rejects a node carrying trust_score, even for the current user', () => {
    expect(() =>
      SafeBelongingNodeSchema.parse({ ...validNode, is_current_user: true, trust_score: SENTINEL_TRUST }),
    ).toThrow();
  });

  it('rejects degrees outside 0..3', () => {
    expect(() => SafeBelongingNodeSchema.parse({ ...validNode, degrees_of_separation: 7 })).toThrow();
  });
});

describe('SafeBelongingLinkSchema', () => {
  const validLink = { source: U1, target: U2, relationship_state: 'warm' as const };

  it('accepts a structural link with qualitative state', () => {
    expect(() => SafeBelongingLinkSchema.parse(validLink)).not.toThrow();
    expect(() => SafeBelongingLinkSchema.parse({ ...validLink, type: 'fission' })).not.toThrow();
  });

  it('rejects raw_weight and effective_weight', () => {
    expect(() => SafeBelongingLinkSchema.parse({ ...validLink, raw_weight: SENTINEL_WEIGHT })).toThrow();
    expect(() =>
      SafeBelongingLinkSchema.parse({ ...validLink, effective_weight: SENTINEL_WEIGHT }),
    ).toThrow();
  });
});

describe('SafePersonGraphSchema', () => {
  it('accepts a graph of safe nodes and links', () => {
    expect(() =>
      SafePersonGraphSchema.parse({
        nodes: [{ user_id: U1, name: 'Me', is_current_user: true }],
        links: [{ source: U1, target: U2, relationship_state: 'strong' }],
      }),
    ).not.toThrow();
  });

  it('rejects a graph whose node leaks karma', () => {
    expect(() =>
      SafePersonGraphSchema.parse({
        nodes: [{ user_id: U1, name: 'Me', is_current_user: true, karma: SENTINEL_KARMA }],
        links: [],
      }),
    ).toThrow();
  });
});

describe('SelfCommunityReputationSchema', () => {
  const valid = {
    scope: { type: 'community', community_id: C1, community_name: 'One' },
    reputation: { score: 27, scale_min: 0, scale_max: 100, tier: 'active', calculated_at: NOW },
    karma: { current: 40, trend: 'stable', half_life_days: 180, calculated_at: NOW },
    activity: { recent_helps: 2, recent_requests: 1, window_days: 30 },
  };

  it('accepts the canonical scoped self summary', () => {
    expect(() => SelfCommunityReputationSchema.parse(valid)).not.toThrow();
  });

  it('rejects a summary missing scope metadata', () => {
    const { scope, ...noScope } = valid;
    expect(() => SelfCommunityReputationSchema.parse(noScope)).toThrow();
  });

  it('rejects a wrong scale (scale_max must be 100)', () => {
    expect(() =>
      SelfCommunityReputationSchema.parse({
        ...valid,
        reputation: { ...valid.reputation, scale_max: 50 },
      }),
    ).toThrow();
  });

  it('rejects an activity window other than 30', () => {
    expect(() =>
      SelfCommunityReputationSchema.parse({
        ...valid,
        activity: { ...valid.activity, window_days: 7 },
      }),
    ).toThrow();
  });

  it('rejects extra top-level keys', () => {
    expect(() => SelfCommunityReputationSchema.parse({ ...valid, rank: 1 })).toThrow();
  });
});

describe('GovernanceStateSchema', () => {
  it('accepts coarse eligibility and role projections', () => {
    expect(() =>
      GovernanceStateSchema.parse({
        eligible_members: [
          { user_id: U1, name: 'Maria', eligible: true, eligibility_reason: 'established_community_relationships' },
        ],
        role_holders: [{ user_id: U2, name: 'Sam', role: 'admin' }],
      }),
    ).not.toThrow();
  });

  it('rejects an eligible member carrying a trust_score', () => {
    expect(() =>
      GovernanceEligibleMemberSchema.parse({
        user_id: U1,
        name: 'Maria',
        eligible: true,
        eligibility_reason: 'established_community_relationships',
        trust_score: SENTINEL_TRUST,
      }),
    ).toThrow();
  });
});

describe('SafeTrustPathSchema', () => {
  it('accepts a structural path with coarse relationship state', () => {
    expect(() =>
      SafeTrustPathSchema.parse({
        target_user_id: U2,
        degrees_of_separation: 2,
        connection_type: 'organic',
        relationship_state: 'warm',
        path: [{ user_id: U1, name: 'Bridge' }],
      }),
    ).not.toThrow();
  });

  it('rejects an outward numeric trust_score on the path', () => {
    expect(() =>
      SafeTrustPathSchema.parse({
        target_user_id: U2,
        degrees_of_separation: 2,
        path: [],
        trust_score: SENTINEL_TRUST,
      }),
    ).toThrow();
  });
});

describe('ProviderReputationSchema (explicit public exception)', () => {
  it('accepts provider rating fields including trust_score', () => {
    expect(() =>
      ProviderReputationSchema.parse({
        provider_id: U1,
        avg_stars: 4.5,
        total_reviews: 12,
        completion_rate: 0.9,
        response_rate: 0.8,
        trust_score: 88,
        last_calculated: NOW,
      }),
    ).not.toThrow();
  });
});

describe('CommunityAggregateSchema (explicit aggregate exception)', () => {
  it('accepts a community-scoped aggregate carrying totals', () => {
    expect(() =>
      CommunityAggregateSchema.parse({
        community_id: C1,
        participating_members: 5,
        transaction_count: 18,
        total_karma_points: 400,
      }),
    ).not.toThrow();
  });
});

describe('forbidden-key scanner', () => {
  it('exposes the canonical forbidden ordinary-member keys', () => {
    for (const k of ['trust_score', 'karma', 'total_karma', 'raw_weight', 'effective_weight', 'currentWeight', 'feedScore', 'feed_score']) {
      expect(FORBIDDEN_ORDINARY_MEMBER_KEYS.has(k)).toBe(true);
    }
  });

  it('passes a clean nested structure', () => {
    expect(() =>
      assertNoForbiddenReputationKeys({
        nodes: [{ user_id: U1, name: 'Me' }],
        meta: { count: 1, nested: { ok: true } },
      }),
    ).not.toThrow();
    expect(
      findForbiddenReputationKeys({ nodes: [{ user_id: U1, name: 'Me' }] }),
    ).toEqual([]);
  });

  it('detects a forbidden key nested deep inside an array', () => {
    const leaky = { data: { graph: { nodes: [{ user_id: U1, karma: SENTINEL_KARMA }] } } };
    expect(() => assertNoForbiddenReputationKeys(leaky)).toThrow(/karma/);
    const found = findForbiddenReputationKeys(leaky);
    expect(found.length).toBeGreaterThan(0);
    expect(found[0]).toMatch(/karma/);
  });

  it('detects currentWeight (camelCase relationship-memory leak)', () => {
    expect(() =>
      assertNoForbiddenReputationKeys({ peer: { name: 'P', currentWeight: SENTINEL_WEIGHT } }),
    ).toThrow(/currentWeight/);
  });
});

describe('PublicMemberIdentitySchema', () => {
  it('accepts identity only and rejects attached reputation', () => {
    expect(() => PublicMemberIdentitySchema.parse({ user_id: U1, name: 'Me' })).not.toThrow();
    expect(() => PublicMemberIdentitySchema.parse({ user_id: U1, name: 'Me', karma: SENTINEL_KARMA })).toThrow();
  });
});
