/**
 * Sprint 116 PR A — reciprocal, request-context-ready topology projection.
 *
 * The social graph owns identity + structure only. Request-service later decorates the counterpart
 * role and adds request reachability after authorizing the concrete request/offer context.
 */
import { assertNoForbiddenReputationKeys } from '@karmyq/shared';
import {
  getContextLinks,
  getPlatformShortestPath,
  getPublicIdentities,
  getPublicOneHop,
  getVisibleCommunities,
} from '../../src/database/relationshipContextDb';
import { buildRelationshipContext, unorderedLinkKey } from '../../src/services/relationshipContextService';

jest.mock('../../src/database/relationshipContextDb', () => ({
  getContextLinks: jest.fn(),
  getPlatformShortestPath: jest.fn(),
  getPublicIdentities: jest.fn(),
  getPublicOneHop: jest.fn(),
  getVisibleCommunities: jest.fn(),
}));

const A = '11111111-1111-1111-1111-111111111111';
const B = '22222222-2222-2222-2222-222222222222';
const C = '33333333-3333-3333-3333-333333333333';
const D = '44444444-4444-4444-4444-444444444444';
const E = '55555555-5555-5555-5555-555555555555';
const F = '66666666-6666-6666-6666-666666666666';
const G = '77777777-7777-7777-7777-777777777777';
const H = '88888888-8888-8888-8888-888888888888';
const I = '99999999-9999-9999-9999-999999999999';
const COMMUNITY = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

const mockOneHop = getPublicOneHop as jest.MockedFunction<typeof getPublicOneHop>;
const mockPath = getPlatformShortestPath as jest.MockedFunction<typeof getPlatformShortestPath>;
const mockIdentities = getPublicIdentities as jest.MockedFunction<typeof getPublicIdentities>;
const mockCommunities = getVisibleCommunities as jest.MockedFunction<typeof getVisibleCommunities>;
const mockLinks = getContextLinks as jest.MockedFunction<typeof getContextLinks>;

const identity = (id: string) => ({ id, name: `Person ${id.slice(0, 1)}` });
const row = (
  sourceId: string,
  targetId: string,
  interactionCount = 1,
  currentWeight = 2,
  disappearanceThreshold = 0.5,
) => ({ sourceId, targetId, interactionCount, currentWeight, disappearanceThreshold });

function installGraph({
  oneHop,
  path,
  links = oneHop,
}: {
  oneHop: ReturnType<typeof row>[];
  path: string[] | null;
  links?: ReturnType<typeof row>[];
}) {
  const ids = new Set<string>([A, B]);
  oneHop.forEach(({ sourceId, targetId }) => {
    ids.add(sourceId);
    ids.add(targetId);
  });
  path?.forEach(id => ids.add(id));
  links.forEach(({ sourceId, targetId }) => {
    ids.add(sourceId);
    ids.add(targetId);
  });

  mockOneHop.mockResolvedValue(oneHop);
  mockPath.mockImplementation(async ([source, target]) =>
    path && source === path[path.length - 1] && target === path[0] ? [...path].reverse() : path,
  );
  mockIdentities.mockImplementation(async requested =>
    requested.filter(id => ids.has(id)).map(identity),
  );
  mockCommunities.mockImplementation(async requested =>
    new Map(requested.map(id => [id, [{ id: COMMUNITY, name: 'Visible Community' }]])),
  );
  mockLinks.mockResolvedValue(links);
}

beforeEach(() => {
  jest.resetAllMocks();
});

describe('buildRelationshipContext', () => {
  it.each([
    ['direct', [A, B]],
    ['two-degree', [A, C, B]],
    ['six-degree', [A, C, D, E, F, G, B]],
  ])('projects a %s platform path without provider or request metadata', async (_label, path) => {
    const pathLinks = path.slice(0, -1).map((id, index) => row(id, path[index + 1], index + 1));
    installGraph({
      oneHop: [pathLinks[0], pathLinks[pathLinks.length - 1]],
      path,
      links: pathLinks,
    });

    const result = await buildRelationshipContext(A, B, { capPerSide: 8 });

    expect(result.path).toEqual({
      scope: 'platform',
      degrees: path.length - 1,
      nodes: path.map(identity),
    });
    expect(result.counterpart).toEqual(identity(B));
    expect(result.counterpart).not.toHaveProperty('role');
    expect(result).not.toHaveProperty('request');
    expect(() => assertNoForbiddenReputationKeys(result)).not.toThrow();
  });

  it('returns a truthful no-path projection while retaining each one-hop side', async () => {
    installGraph({ oneHop: [row(A, C), row(B, D)], path: null });

    const result = await buildRelationshipContext(A, B);

    expect(result.path).toEqual({ scope: 'platform', degrees: null, nodes: [] });
    expect(result.networks.viewer.map(node => node.id)).toEqual([C]);
    expect(result.networks.counterpart.map(node => node.id)).toEqual([D]);
    expect(result.summary).toMatch(/No completed-help path is visible within 6 degrees/);
  });

  it('is reciprocal: orientation swaps but path, shared-node, and unordered-link sets stay equal', async () => {
    const graph = [row(A, C, 2), row(B, C, 2), row(A, D), row(B, D), row(A, E), row(B, F)];
    installGraph({ oneHop: graph, path: [A, C, B], links: graph });

    const ab = await buildRelationshipContext(A, B, { capPerSide: 8 });
    const ba = await buildRelationshipContext(B, A, { capPerSide: 8 });

    expect(new Set(ab.path.nodes.map(node => node.id))).toEqual(new Set(ba.path.nodes.map(node => node.id)));
    expect(new Set(ab.networks.shared.map(node => node.id))).toEqual(
      new Set(ba.networks.shared.map(node => node.id)),
    );
    expect(new Set(ab.links.map(link => unorderedLinkKey(link.source, link.target)))).toEqual(
      new Set(ba.links.map(link => unorderedLinkKey(link.source, link.target))),
    );
    expect(ab.networks.viewer.map(node => node.id)).toEqual(ba.networks.counterpart.map(node => node.id));
    expect(ab.networks.counterpart.map(node => node.id)).toEqual(ba.networks.viewer.map(node => node.id));
  });

  it('prioritizes shared and path-adjacent nodes under caps, then fills by stable ID', async () => {
    // C is shared and on the path. D is the remaining shared node. H sorts before I and therefore
    // fills A's final slot; I is truthfully truncated. E fills B's final slot before F.
    const graph = [
      row(A, I), row(A, H), row(A, C), row(A, D),
      row(B, F), row(B, E), row(B, D), row(B, C),
    ];
    installGraph({ oneHop: graph, path: [A, C, B], links: graph });

    const result = await buildRelationshipContext(A, B, { capPerSide: 3 });

    expect(result.networks.shared.map(node => node.id)).toEqual([C, D]);
    expect(result.networks.viewer.map(node => node.id)).toEqual([H]);
    expect(result.networks.counterpart.map(node => node.id)).toEqual([E]);
    expect(result.networks.truncated).toBe(true);
    expect(result.links.flatMap(link => [link.source, link.target])).not.toEqual(
      expect.arrayContaining([I, F]),
    );
  });

  it('bands internal history and decay inputs, then removes every numeric input from nested output', async () => {
    installGraph({
      oneHop: [row(A, B, 4, 1.1, 1)],
      path: [A, B],
      links: [row(A, B, 4, 1.1, 1)],
    });

    const result = await buildRelationshipContext(A, B);

    expect(result.links).toEqual([
      {
        source: A,
        target: B,
        relationship_state: 'nearly_forgotten',
        bond_depth: 'established',
      },
    ]);
    expect(JSON.stringify(result)).not.toMatch(
      /interactionCount|match_completed_count|currentWeight|disappearanceThreshold|raw_weight|trust_score|karma/,
    );
    expect(() => assertNoForbiddenReputationKeys(result)).not.toThrow();
  });

  it('falls back to the safe default cap when an internal caller supplies a non-finite value', async () => {
    installGraph({ oneHop: [row(A, C), row(B, D)], path: null });

    const result = await buildRelationshipContext(A, B, { capPerSide: Number.NaN });

    expect(result.networks.viewer.map(node => node.id)).toEqual([C]);
    expect(result.networks.counterpart.map(node => node.id)).toEqual([D]);
    expect(result.networks.truncated).toBe(false);
  });
});
