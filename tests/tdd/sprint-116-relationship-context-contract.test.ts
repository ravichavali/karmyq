/**
 * Sprint 116 — reciprocal relationship-context outward contract.
 *
 * RED-first contract tests: context may disclose named topology and a deliberately ordinal
 * bond-depth band, but never exact interaction counts, weights, karma, or reputation.
 */
import {
  classifyBondDepth,
  relationshipContextSchema,
} from '../../packages/shared/src/schemas/relationshipContext';
import {
  findForbiddenReputationKeys,
} from '../../packages/shared/src/schemas/reputationDisclosure';

const VIEWER_ID = '11111111-1111-1111-1111-111111111111';
const COUNTERPART_ID = '22222222-2222-2222-2222-222222222222';
const BRIDGE_ID = '33333333-3333-3333-3333-333333333333';
const COMMUNITY_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const REQUEST_ID = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

const viewerNode = {
  id: VIEWER_ID,
  name: 'Maria Reyes',
  communities: [{ id: COMMUNITY_ID, name: 'Marin Helping Hands' }],
};

const counterpartNode = {
  id: COUNTERPART_ID,
  name: 'Dev Patel',
  communities: [],
};

const validContext = {
  viewer: { id: VIEWER_ID, name: 'Maria Reyes' },
  counterpart: {
    id: COUNTERPART_ID,
    name: 'Dev Patel',
    role: 'member' as const,
  },
  request: {
    id: REQUEST_ID,
    visibilityScope: 'trust_network' as const,
    reachability: 'trust_network' as const,
  },
  path: {
    scope: 'platform' as const,
    degrees: 2,
    nodes: [
      { id: VIEWER_ID, name: 'Maria Reyes' },
      { id: BRIDGE_ID, name: 'Elena Ruiz' },
      { id: COUNTERPART_ID, name: 'Dev Patel' },
    ],
  },
  networks: {
    viewer: [viewerNode],
    counterpart: [counterpartNode],
    shared: [],
    truncated: false,
  },
  links: [
    {
      source: VIEWER_ID,
      target: BRIDGE_ID,
      relationship_state: 'warm' as const,
      bond_depth: 'growing' as const,
    },
    {
      source: BRIDGE_ID,
      target: COUNTERPART_ID,
      relationship_state: 'strong' as const,
      bond_depth: 'forming' as const,
    },
  ],
  summary: 'Maria and Dev are connected through Elena.',
};

describe('classifyBondDepth', () => {
  it('maps exact internal counts to the three public ordinal floors', () => {
    expect(classifyBondDepth(0)).toBe('forming');
    expect(classifyBondDepth(1)).toBe('forming');
    expect(classifyBondDepth(2)).toBe('growing');
    expect(classifyBondDepth(3)).toBe('growing');
    expect(classifyBondDepth(4)).toBe('established');
    expect(classifyBondDepth(99)).toBe('established');
  });
});

describe('relationshipContextSchema', () => {
  it('accepts strict reciprocal identity, path, network, and qualitative-link structure', () => {
    expect(relationshipContextSchema.parse(validContext)).toEqual(validContext);
  });

  it('accepts a provider counterpart only with public service-role decoration', () => {
    const providerContext = {
      ...validContext,
      counterpart: {
        id: COUNTERPART_ID,
        name: 'Dev Patel',
        role: 'provider' as const,
        provider: { serviceType: 'tradesperson', collectiveName: 'Marin Repair Circle' },
      },
    };

    expect(relationshipContextSchema.parse(providerContext).counterpart).toEqual(
      providerContext.counterpart,
    );
  });

  it('accepts an honest no-path response without inventing a weak edge', () => {
    expect(() => relationshipContextSchema.parse({
      ...validContext,
      path: { scope: 'platform', degrees: null, nodes: [] },
      links: [],
      summary: 'No recorded connection path yet.',
    })).not.toThrow();
  });

  it('rejects wrong path scope and degrees beyond the request visibility ceiling', () => {
    expect(() => relationshipContextSchema.parse({
      ...validContext,
      path: { ...validContext.path, scope: 'community' },
    })).toThrow();
    expect(() => relationshipContextSchema.parse({
      ...validContext,
      path: { ...validContext.path, degrees: 7 },
    })).toThrow();
  });

  it.each([
    ['top-level trust score', { ...validContext, trust_score: 827 }],
    ['node karma', {
      ...validContext,
      networks: {
        ...validContext.networks,
        viewer: [{ ...viewerNode, karma: 913 }],
      },
    }],
    ['link raw weight', {
      ...validContext,
      links: [{ ...validContext.links[0], raw_weight: 41 }],
    }],
    ['link exact interaction count', {
      ...validContext,
      links: [{ ...validContext.links[0], total_interaction_count: 4 }],
    }],
  ])('rejects %s rather than silently stripping it', (_label, payload) => {
    expect(() => relationshipContextSchema.parse(payload)).toThrow();
  });

  it('requires provider decoration for provider role and forbids it for member role', () => {
    expect(() => relationshipContextSchema.parse({
      ...validContext,
      counterpart: { id: COUNTERPART_ID, name: 'Dev Patel', role: 'provider' },
    })).toThrow();
    expect(() => relationshipContextSchema.parse({
      ...validContext,
      counterpart: {
        ...validContext.counterpart,
        provider: { serviceType: 'ride' },
      },
    })).toThrow();
  });
});

describe('ADR-082 forbidden exact-interaction keys', () => {
  it('finds exact counters at any nesting depth while permitting bond_depth', () => {
    const payload = {
      bond_depth: 'established',
      nested: {
        match_completed_count: 4,
        total_interaction_count: 9,
      },
    };

    expect(findForbiddenReputationKeys(payload)).toEqual([
      '$.nested.match_completed_count',
      '$.nested.total_interaction_count',
    ]);
  });
});
