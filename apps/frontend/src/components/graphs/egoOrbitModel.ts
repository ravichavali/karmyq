import { compareGraphNodes } from './communityRingModel'
import { linkKey } from './normalizeGraphData'
import type { GraphData, TrustLink, TrustNode } from './types'

export interface EgoOrbitNode extends TrustNode {
  x: number
  y: number
  angle: number
  // Local BFS distance from the caller, or null when the caller cannot reach this node. Never derived
  // from the response-supplied `degrees_of_separation`, which an expansion can report incorrectly.
  displayDistance: number | null
  isExpansionNode: boolean
}

export interface EgoOrbitLink {
  key: string
  link: TrustLink
  x1: number
  y1: number
  x2: number
  y2: number
}

export interface EgoOrbitModel {
  nodes: EgoOrbitNode[]
  links: EgoOrbitLink[]
  maxDistance: number
}

export interface EgoOrbitOptions {
  baselineNodeIds?: readonly string[]
  expansionRootIds?: readonly string[]
}

// Half-width of the angular arc an expansion fans its new neighbors across, centered on its root's angle.
const EXPANSION_ARC = 0.32

const round = (value: number) => (Number.isFinite(value) ? Number(value.toFixed(3)) : 0)

interface Placement {
  x: number
  y: number
  angle: number
}

/**
 * Build deterministic ego-orbit geometry from the disclosed topology. The caller anchors the origin;
 * baseline nodes sit on concentric rings by their BFS distance with stable equal spacing, so an
 * expansion (which only ever introduces non-baseline nodes near their clicked root) can never shift a
 * baseline node. Expansion nodes fan out across a small arc centered on their root's angle; unreachable
 * and orphan nodes land on a stable outermost ring. Nothing reads person reputation or edge weight.
 */
export function buildEgoOrbitModel(
  graph: GraphData,
  currentUserId: string,
  width: number,
  height: number,
  options: EgoOrbitOptions = {}
): EgoOrbitModel {
  const baselineSet = new Set(options.baselineNodeIds ?? graph.nodes.map(node => node.id))
  const expansionRootIds = options.expansionRootIds ?? []

  const nodeById = new Map(graph.nodes.map(node => [node.id, node]))

  // Adjacency only across links whose endpoints both exist.
  const adjacency = new Map<string, Set<string>>(graph.nodes.map(node => [node.id, new Set<string>()]))
  for (const link of graph.links) {
    if (!nodeById.has(link.source) || !nodeById.has(link.target)) continue
    adjacency.get(link.source)!.add(link.target)
    adjacency.get(link.target)!.add(link.source)
  }

  // Breadth-first distance from the caller only. Neighbors are visited in stable name+ID order.
  const distance = new Map<string, number>()
  if (nodeById.has(currentUserId)) {
    distance.set(currentUserId, 0)
    let frontier = [currentUserId]
    while (frontier.length > 0) {
      const next: string[] = []
      for (const id of frontier) {
        const depth = distance.get(id)!
        const neighbors = [...(adjacency.get(id) ?? [])]
          .map(neighborId => nodeById.get(neighborId)!)
          .sort(compareGraphNodes)
        for (const neighbor of neighbors) {
          if (!distance.has(neighbor.id)) {
            distance.set(neighbor.id, depth + 1)
            next.push(neighbor.id)
          }
        }
      }
      frontier = next
    }
  }

  let maxDistance = 0
  for (const [id, depth] of distance) {
    if (id !== currentUserId) maxDistance = Math.max(maxDistance, depth)
  }

  const minimumDimension = Math.min(width, height)
  const base = Number.isFinite(minimumDimension) ? minimumDimension : 600
  const radiusForDistance = (depth: number) => Math.max(0, base * (0.19 + (depth - 1) * 0.13))
  const outerRadius = radiusForDistance(maxDistance + 1)

  const placements = new Map<string, Placement>()
  const angleById = new Map<string, number>()
  const place = (id: string, angle: number, radius: number) => {
    placements.set(id, {
      x: round(Math.cos(angle) * radius),
      y: round(Math.sin(angle) * radius),
      angle,
    })
    angleById.set(id, angle)
  }

  if (nodeById.has(currentUserId)) {
    placements.set(currentUserId, { x: 0, y: 0, angle: 0 })
    angleById.set(currentUserId, 0)
  }

  // Baseline reachable nodes ring by BFS distance, equally spaced for a stable mental map.
  const baselineByDistance = new Map<number, TrustNode[]>()
  for (const node of graph.nodes) {
    if (node.id === currentUserId || !baselineSet.has(node.id)) continue
    const depth = distance.get(node.id)
    if (depth == null) continue
    if (!baselineByDistance.has(depth)) baselineByDistance.set(depth, [])
    baselineByDistance.get(depth)!.push(node)
  }
  for (const [depth, members] of baselineByDistance) {
    const ordered = [...members].sort(compareGraphNodes)
    const radius = radiusForDistance(depth)
    ordered.forEach((node, index) => {
      const angle = -Math.PI / 2 + (2 * Math.PI * index) / Math.max(ordered.length, 1)
      place(node.id, angle, radius)
    })
  }

  // Expansion reachable nodes (non-baseline) layer outward by BFS distance. Each anchors on a small arc
  // around an already-placed neighbor one hop closer to the caller — its BFS predecessor — so a node
  // revealed by expanding a baseline node OR a previously-revealed (nested) node still lands on its true
  // BFS ring near where it was opened, never on the orphan ring. An expansion ROOT is itself non-baseline
  // and is never adjacent to itself, so it must anchor through its placed predecessor, not a root id.
  const remaining = new Set(
    graph.nodes
      .filter(
        node => node.id !== currentUserId && !baselineSet.has(node.id) && distance.get(node.id) != null
      )
      .map(node => node.id)
  )
  for (let depth = 1; depth <= maxDistance && remaining.size > 0; depth++) {
    const layer = [...remaining]
      .map(id => nodeById.get(id)!)
      .filter(node => distance.get(node.id) === depth)
    const byAnchor = new Map<string, TrustNode[]>()
    for (const node of layer) {
      const placedNeighbors = [...(adjacency.get(node.id) ?? [])].filter(id => angleById.has(id))
      if (placedNeighbors.length === 0) continue
      // BFS guarantees a placed neighbor one hop closer. The anchor MUST NOT depend on adjacency
      // insertion order (backend edge rows have no guaranteed order, and the layout must be identical
      // across reloads): pick the adjacent expansion root that comes first in expansionRootIds (the
      // click order), else the closest placed predecessor tie-broken by stable normalized name + ID.
      const anchor =
        expansionRootIds.find(rootId => placedNeighbors.includes(rootId)) ??
        [...placedNeighbors].sort((a, b) => {
          const da = distance.get(a) ?? Infinity
          const db = distance.get(b) ?? Infinity
          return da !== db ? da - db : compareGraphNodes(nodeById.get(a)!, nodeById.get(b)!)
        })[0]
      if (!byAnchor.has(anchor)) byAnchor.set(anchor, [])
      byAnchor.get(anchor)!.push(node)
    }
    for (const [anchorId, members] of byAnchor) {
      const anchorAngle = angleById.get(anchorId)!
      const ordered = members.sort(compareGraphNodes)
      ordered.forEach((node, index) => {
        const count = ordered.length
        const angle =
          count === 1 ? anchorAngle : anchorAngle - EXPANSION_ARC + (2 * EXPANSION_ARC * index) / (count - 1)
        place(node.id, angle, radiusForDistance(depth))
        remaining.delete(node.id)
      })
    }
  }

  // Anything still unplaced (truly unreachable) shares a stable outermost ring.
  const leftovers = [...remaining].map(id => nodeById.get(id)!)
  const unreachable = graph.nodes.filter(
    node => node.id !== currentUserId && distance.get(node.id) == null
  )
  const outerNodes = [
    ...new Map([...leftovers, ...unreachable].map(node => [node.id, node])).values(),
  ].sort(compareGraphNodes)
  outerNodes.forEach((node, index) => {
    const angle = -Math.PI / 2 + (2 * Math.PI * index) / Math.max(outerNodes.length, 1)
    place(node.id, angle, outerRadius)
  })

  const nodes: EgoOrbitNode[] = graph.nodes.map(node => {
    const placement = placements.get(node.id) ?? { x: 0, y: 0, angle: 0 }
    const depth = distance.get(node.id)
    return {
      ...node,
      x: placement.x,
      y: placement.y,
      angle: placement.angle,
      displayDistance: depth ?? null,
      isExpansionNode: node.id !== currentUserId && !baselineSet.has(node.id),
    }
  })

  const links: EgoOrbitLink[] = graph.links.flatMap(link => {
    const source = placements.get(link.source)
    const target = placements.get(link.target)
    if (!source || !target) return []
    return [{ key: linkKey(link), link, x1: source.x, y1: source.y, x2: target.x, y2: target.y }]
  })

  return { nodes, links, maxDistance }
}
