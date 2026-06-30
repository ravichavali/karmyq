import {
  classifyBondDepth,
  ContextIdentitySchema,
  RelationshipContextSchema,
  type ContextIdentity,
  type ContextLink,
  type ContextNode,
} from '@karmyq/shared';
import {
  getContextLinks,
  getPlatformShortestPath,
  getPublicIdentities,
  getPublicOneHop,
  getVisibleCommunities,
  type InternalContextRow,
} from '../database/relationshipContextDb';
import { relationshipState } from './disclosureProjection';

const DEFAULT_CAP_PER_SIDE = 8;
const MAX_CAP_PER_SIDE = 20;
export const MAX_RELATIONSHIP_PATH_DEGREES = 6;

export interface RelationshipContextProjection {
  viewer: ContextIdentity;
  counterpart: ContextIdentity;
  path: {
    scope: 'platform';
    degrees: number | null;
    nodes: ContextIdentity[];
  };
  networks: {
    viewer: ContextNode[];
    counterpart: ContextNode[];
    shared: ContextNode[];
    truncated: boolean;
  };
  links: ContextLink[];
  summary: string;
}

export interface RelationshipContextOptions {
  capPerSide?: number;
}

/** Runtime boundary for the internal service response; request-service adds request/provider data. */
export const RelationshipContextProjectionSchema = RelationshipContextSchema
  .omit({ request: true, counterpart: true })
  .extend({ counterpart: ContextIdentitySchema })
  .strict();

export function unorderedLinkKey(source: string, target: string): string {
  return source < target ? `${source}:${target}` : `${target}:${source}`;
}

function compareStableIds(left: string, right: string): number {
  if (left === right) return 0;
  return left < right ? -1 : 1;
}

function otherEndpoint(row: InternalContextRow, anchorId: string): string | null {
  if (row.sourceId === anchorId) return row.targetId;
  if (row.targetId === anchorId) return row.sourceId;
  return null;
}

function stableWithPriority(ids: Iterable<string>, priorityIds: Set<string>): string[] {
  return [...new Set(ids)].sort((left, right) => {
    const priorityDifference = Number(priorityIds.has(right)) - Number(priorityIds.has(left));
    return priorityDifference || compareStableIds(left, right);
  });
}

function projectLink(row: InternalContextRow): ContextLink {
  const [source, target] = row.sourceId < row.targetId
    ? [row.sourceId, row.targetId]
    : [row.targetId, row.sourceId];
  return {
    source,
    target,
    relationship_state: relationshipState(row.currentWeight, row.disappearanceThreshold),
    bond_depth: classifyBondDepth(row.interactionCount),
  };
}

function factualSummary(
  viewer: ContextIdentity,
  counterpart: ContextIdentity,
  degrees: number | null,
  sharedCount: number,
): string {
  const shared = sharedCount === 0
    ? ''
    : ` They share ${sharedCount} direct connection${sharedCount === 1 ? '' : 's'}.`;
  if (degrees === null) {
    return `No completed-help path is visible within ${MAX_RELATIONSHIP_PATH_DEGREES} degrees.${shared}`;
  }
  if (degrees === 1) {
    return `${viewer.name} and ${counterpart.name} have completed help directly.${shared}`;
  }
  return `${viewer.name} and ${counterpart.name} are connected through ${degrees - 1} ${
    degrees === 2 ? 'person' : 'people'
  } across the platform.${shared}`;
}

/**
 * Build the reciprocal identity-and-structure projection. It deliberately has no request metadata or
 * provider role: request-service owns both after authorizing a concrete request or offer.
 */
export async function buildRelationshipContext(
  viewerId: string,
  counterpartId: string,
  options: RelationshipContextOptions = {},
): Promise<RelationshipContextProjection> {
  if (viewerId === counterpartId) {
    throw new Error('Relationship context requires two different people');
  }

  const requestedCap = Number.isFinite(options.capPerSide)
    ? Math.floor(options.capPerSide!)
    : DEFAULT_CAP_PER_SIDE;
  const capPerSide = Math.min(MAX_CAP_PER_SIDE, Math.max(1, requestedCap));
  const [oneHop, pathIds] = await Promise.all([
    getPublicOneHop([viewerId, counterpartId]),
    getPlatformShortestPath([viewerId, counterpartId], MAX_RELATIONSHIP_PATH_DEGREES),
  ]);

  const viewerDirect = new Set<string>();
  const counterpartDirect = new Set<string>();
  for (const edge of oneHop) {
    const viewerNeighbor = otherEndpoint(edge, viewerId);
    const counterpartNeighbor = otherEndpoint(edge, counterpartId);
    if (viewerNeighbor && viewerNeighbor !== counterpartId) viewerDirect.add(viewerNeighbor);
    if (counterpartNeighbor && counterpartNeighbor !== viewerId) counterpartDirect.add(counterpartNeighbor);
  }

  const sharedAll = [...viewerDirect].filter(id => counterpartDirect.has(id));
  const pathPriority = new Set(pathIds ?? []);
  const sharedSelected = stableWithPriority(sharedAll, pathPriority).slice(0, capPerSide);
  const sharedSet = new Set(sharedAll);
  const remainingPerSide = Math.max(0, capPerSide - sharedSelected.length);
  const viewerExclusiveAll = [...viewerDirect].filter(id => !sharedSet.has(id));
  const counterpartExclusiveAll = [...counterpartDirect].filter(id => !sharedSet.has(id));
  const viewerSelected = stableWithPriority(viewerExclusiveAll, pathPriority).slice(0, remainingPerSide);
  const counterpartSelected = stableWithPriority(counterpartExclusiveAll, pathPriority).slice(0, remainingPerSide);

  const selectedIds = new Set<string>([
    viewerId,
    counterpartId,
    ...(pathIds ?? []),
    ...sharedSelected,
    ...viewerSelected,
    ...counterpartSelected,
  ]);
  const stableSelectedIds = [...selectedIds].sort();
  const [identities, communities, internalLinks] = await Promise.all([
    getPublicIdentities(stableSelectedIds, [viewerId, counterpartId]),
    getVisibleCommunities(stableSelectedIds),
    getContextLinks(stableSelectedIds),
  ]);
  const identityById = new Map(identities.map(person => [person.id, person]));

  const requireIdentity = (id: string): ContextIdentity => {
    const person = identityById.get(id);
    if (!person) throw new Error(`Active relationship identity unavailable: ${id}`);
    return person;
  };
  const contextNode = (id: string): ContextNode => ({
    ...requireIdentity(id),
    communities: communities.get(id) ?? [],
  });

  const viewer = requireIdentity(viewerId);
  const counterpart = requireIdentity(counterpartId);
  const linksByKey = new Map<string, ContextLink>();
  for (const internalLink of internalLinks) {
    if (!selectedIds.has(internalLink.sourceId) || !selectedIds.has(internalLink.targetId)) continue;
    const link = projectLink(internalLink);
    linksByKey.set(unorderedLinkKey(link.source, link.target), link);
  }

  return {
    viewer,
    counterpart,
    path: {
      scope: 'platform',
      degrees: pathIds ? pathIds.length - 1 : null,
      nodes: (pathIds ?? []).map(requireIdentity),
    },
    networks: {
      viewer: viewerSelected.map(contextNode),
      counterpart: counterpartSelected.map(contextNode),
      shared: sharedSelected.map(contextNode),
      truncated:
        sharedSelected.length < sharedAll.length
        || viewerSelected.length < viewerExclusiveAll.length
        || counterpartSelected.length < counterpartExclusiveAll.length,
    },
    links: [...linksByKey.entries()]
      .sort(([left], [right]) => compareStableIds(left, right))
      .map(([, link]) => link),
    summary: factualSummary(viewer, counterpart, pathIds ? pathIds.length - 1 : null, sharedAll.length),
  };
}
