import type {
  BondDepth,
  ContextCommunity,
  ContextNode,
  RelationshipContext,
} from '@karmyq/shared'

export const PERSON_RADIUS = 18
export const BOND_DEPTH_WIDTH: Record<BondDepth, number> = {
  forming: 1.2,
  growing: 1.9,
  established: 2.8,
}

export type RelationshipLensNodeRole =
  | 'viewer'
  | 'counterpart'
  | 'path'
  | 'shared'
  | 'viewer_network'
  | 'counterpart_network'

export interface RelationshipLensNode {
  id: string
  name: string
  communities: ContextCommunity[]
  role: RelationshipLensNodeRole
  x: number
  y: number
  r: number
}

export interface RelationshipLensLink {
  key: string
  source: string
  target: string
  sourceX: number
  sourceY: number
  targetX: number
  targetY: number
  relationshipState: RelationshipContext['links'][number]['relationship_state']
  bondDepth: BondDepth
  width: number
}

export interface RelationshipLensModel {
  width: number
  height: number
  nodes: RelationshipLensNode[]
  links: RelationshipLensLink[]
}

const round = (value: number) => Number(value.toFixed(2))
const byId = <T extends { id: string }>(left: T, right: T) => left.id.localeCompare(right.id)

function fanPosition(
  index: number,
  anchor: { x: number; y: number },
  direction: -1 | 1,
  width: number,
  height: number
) {
  const row = Math.floor(index / 2)
  const upper = index % 2 === 0
  const xBase = Math.min(84, width * 0.12)
  const xStep = Math.min(58, width * 0.08)
  const yBase = Math.min(68, height * 0.2)
  const yStep = Math.min(24, height * 0.07)
  return {
    x: round(anchor.x + direction * (xBase + row * xStep)),
    y: round(anchor.y + (upper ? -1 : 1) * (yBase + row * yStep)),
  }
}

function sharedPosition(index: number, width: number, height: number) {
  const row = Math.floor(index / 2)
  const upper = index % 2 === 0
  const xOffset = row === 0 ? 0 : (upper ? -1 : 1) * row * Math.min(54, width * 0.07)
  const yOffset = Math.min(88, height * 0.24) + row * Math.min(22, height * 0.06)
  return {
    x: round(width * 0.5 + xOffset),
    y: round(height * 0.5 + (upper ? -yOffset : yOffset)),
  }
}

function node(
  identity: { id: string; name: string },
  role: RelationshipLensNodeRole,
  position: { x: number; y: number },
  communities: ContextCommunity[] = []
): RelationshipLensNode {
  return {
    ...identity,
    communities: [...communities].sort(byId),
    role,
    ...position,
    r: PERSON_RADIUS,
  }
}

/**
 * Produces deterministic geometry from disclosed topology only. Position expresses a person's role
 * in this reciprocal explanation; it never ranks people or invents clusters.
 */
export function buildRelationshipLensModel(
  context: RelationshipContext,
  width: number,
  height: number
): RelationshipLensModel {
  const viewerAnchor = { x: round(width * 0.28), y: round(height * 0.5) }
  const counterpartAnchor = { x: round(width * 0.72), y: round(height * 0.5) }
  const networkCatalog = new Map<string, ContextNode>()
  for (const item of [
    ...context.networks.viewer,
    ...context.networks.counterpart,
    ...context.networks.shared,
  ]) {
    networkCatalog.set(item.id, item)
  }

  const nodes: RelationshipLensNode[] = [
    node(context.viewer, 'viewer', viewerAnchor),
    node(context.counterpart, 'counterpart', counterpartAnchor),
  ]
  const placed = new Set([context.viewer.id, context.counterpart.id])
  const orderedPath = context.path.nodes.filter(item => !placed.has(item.id))
  orderedPath.forEach((item, index) => {
    const x =
      viewerAnchor.x +
      ((index + 1) / (orderedPath.length + 1)) * (counterpartAnchor.x - viewerAnchor.x)
    const catalogItem = networkCatalog.get(item.id)
    nodes.push(
      node(item, 'path', { x: round(x), y: viewerAnchor.y }, catalogItem?.communities ?? [])
    )
    placed.add(item.id)
  })

  const viewerIds = new Set(context.networks.viewer.map(item => item.id))
  const counterpartIds = new Set(context.networks.counterpart.map(item => item.id))
  const sharedIds = new Set(context.networks.shared.map(item => item.id))
  for (const id of viewerIds) {
    if (counterpartIds.has(id)) sharedIds.add(id)
  }

  const shared = [...sharedIds]
    .map(id => networkCatalog.get(id))
    .filter((item): item is ContextNode => !!item && !placed.has(item.id))
    .sort(byId)
  shared.forEach((item, index) => {
    nodes.push(node(item, 'shared', sharedPosition(index, width, height), item.communities))
    placed.add(item.id)
  })

  const addFan = (
    candidates: ContextNode[],
    role: 'viewer_network' | 'counterpart_network',
    anchor: { x: number; y: number },
    direction: -1 | 1
  ) => {
    candidates
      .filter(item => !placed.has(item.id))
      .sort(byId)
      .forEach((item, index) => {
        nodes.push(node(item, role, fanPosition(index, anchor, direction, width, height), item.communities))
        placed.add(item.id)
      })
  }
  addFan(context.networks.viewer, 'viewer_network', viewerAnchor, -1)
  addFan(context.networks.counterpart, 'counterpart_network', counterpartAnchor, 1)

  const positioned = new Map(nodes.map(item => [item.id, item]))
  const links = context.links
    .filter(link => positioned.has(link.source) && positioned.has(link.target))
    .map(link => {
      const source = positioned.get(link.source)!
      const target = positioned.get(link.target)!
      return {
        key: `${link.source}:${link.target}`,
        source: link.source,
        target: link.target,
        sourceX: source.x,
        sourceY: source.y,
        targetX: target.x,
        targetY: target.y,
        relationshipState: link.relationship_state,
        bondDepth: link.bond_depth,
        width: BOND_DEPTH_WIDTH[link.bond_depth],
      }
    })
    .sort((left, right) => left.key.localeCompare(right.key))

  return { width, height, nodes, links }
}
