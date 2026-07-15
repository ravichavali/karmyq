import { linkKey } from './normalizeGraphData'
import type { GraphData, TrustLink, TrustNode } from './types'

export interface RingNode extends TrustNode {
  x: number
  y: number
  angle: number
}

export interface RingLink {
  key: string
  link: TrustLink
  path: string
}

export interface CommunityRingModel {
  nodes: RingNode[]
  links: RingLink[]
  radius: number
}

const identityKey = (node: TrustNode) =>
  `${node.name.normalize('NFKD').trim().toLowerCase()}\u0000${node.id}`

export const compareGraphNodes = (a: TrustNode, b: TrustNode) => {
  const ak = identityKey(a)
  const bk = identityKey(b)
  return ak < bk ? -1 : ak > bk ? 1 : 0
}

const finite = (value: number) => (Number.isFinite(value) ? Number(value.toFixed(3)) : 0)
const finiteCoordinate = (value: number) =>
  Number.isFinite(value) ? (Math.abs(value) < 1e-10 ? 0 : value) : 0

export function buildCommunityRingModel(
  graph: GraphData,
  width: number,
  height: number,
  currentUserId?: string
): CommunityRingModel {
  const ordered = [...graph.nodes].sort(compareGraphNodes)
  // Sprint 119 / ADR-086 — the viewer anchors the ring at 12 o'clock. Rotation ONLY (ADR-083):
  // membership, cyclic order, radius, and chord geometry stay exactly as S115 shipped.
  if (currentUserId) {
    const anchor = ordered.findIndex(node => node.id === currentUserId)
    if (anchor > 0) ordered.push(...ordered.splice(0, anchor))
  }
  const minimumDimension = Math.min(width, height)
  const radius = Number.isFinite(minimumDimension)
    ? Math.max(60, minimumDimension / 2 - 72)
    : 60
  const nodes = ordered.map((node, index) => {
    const angle = -Math.PI / 2 + (2 * Math.PI * index) / Math.max(ordered.length, 1)
    return {
      ...node,
      // Preserve the shared radius exactly. Independently rounding x/y nudges diagonal nodes onto
      // slightly different circles, even though rounded control points remain useful for stable SVG.
      x: finiteCoordinate(Math.cos(angle) * radius),
      y: finiteCoordinate(Math.sin(angle) * radius),
      angle,
    }
  })
  const byId = new Map(nodes.map(node => [node.id, node]))
  const links = graph.links.flatMap(link => {
    const source = byId.get(link.source)
    const target = byId.get(link.target)
    if (!source || !target) return []
    const [a, b] = source.id < target.id ? [source, target] : [target, source]
    const dx = b.x - a.x
    const dy = b.y - a.y
    const length = Math.hypot(dx, dy) || 1
    const bow = Math.min(18, length * 0.08)
    const cx = finite((a.x + b.x) / 2 - (dy / length) * bow)
    const cy = finite((a.y + b.y) / 2 + (dx / length) * bow)
    return [
      {
        key: linkKey(link),
        link,
        path: `M${source.x} ${source.y} Q${cx} ${cy} ${target.x} ${target.y}`,
      },
    ]
  })
  return { nodes, links, radius }
}
