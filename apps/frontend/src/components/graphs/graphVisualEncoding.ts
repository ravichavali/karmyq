import type { GraphData, TrustLink, TrustNode } from './types'

export const PERSON_EDGE_WIDTH = 1.35
export const FOCUSED_EDGE_WIDTH = 2.5
// Sprint 118 / ADR-085 — new-bond emphasis: color + width channel only, layered on top of the
// decayTier opacity bands (which stay exactly as ADR-070 shipped them). Focus still wins.
export const NEW_BOND_COLOR = '#4ade80'
export const NEW_BOND_EDGE_WIDTH = 2.1
export const UNRELATED_OPACITY = 0.05
export const PERSON_COLORS = {
  callerNode: '#10b981',
  ordinaryNode: '#94a3b8',
  callerEdge: '#f59e0b',
  ordinaryEdge: '#64748b',
  focusedEdge: '#14b8a6',
  focusRing: '#f8fafc',
} as const

const OPACITY = {
  strong: 0.62,
  warm: 0.40,
  fading: 0.23,
  nearly_forgotten: 0.11,
  swept: 0.05,
} as const

export function relationshipLabel(tier: TrustLink['decayTier']): string {
  return tier ? tier.replaceAll('_', ' ') : 'relationship state unavailable'
}

/**
 * Count a node's incident links by qualitative relationship state, e.g. "1 strong, 2 warm". Shared by
 * the ego and community renderers' selected-node detail panels.
 */
export function relationshipSummary(links: TrustLink[], nodeId: string): string {
  const counts = new Map<string, number>()
  for (const link of links) {
    if (link.source !== nodeId && link.target !== nodeId) continue
    const label = relationshipLabel(link.decayTier)
    counts.set(label, (counts.get(label) ?? 0) + 1)
  }
  return [...counts].map(([label, count]) => `${count} ${label}`).join(', ')
}

export function edgeVisual(link: TrustLink, currentUserId: string, focusedNodeId?: string) {
  const caller = link.source === currentUserId || link.target === currentUserId
  const focused = !!focusedNodeId && (link.source === focusedNodeId || link.target === focusedNodeId)
  const isNew = link.formedRecently === true
  // Stroke precedence: new bond > caller amber > focused teal > ordinary. State colors beat the
  // transient focus hue (the shipped S115 contract — caller already beat focus), and a brand-new
  // bond is usually the caller's own edge, so new must beat amber or the emphasis would never show.
  // Width keeps its shipped focus-first rule; a non-focused new bond gets a gentle bump.
  return {
    stroke: isNew
      ? NEW_BOND_COLOR
      : caller
        ? PERSON_COLORS.callerEdge
        : focused
          ? PERSON_COLORS.focusedEdge
          : PERSON_COLORS.ordinaryEdge,
    opacity: link.decayTier ? OPACITY[link.decayTier] ?? 0.16 : 0.16,
    width: focused ? FOCUSED_EDGE_WIDTH : isNew ? NEW_BOND_EDGE_WIDTH : PERSON_EDGE_WIDTH,
    label: isNew ? `${relationshipLabel(link.decayTier)} · new bond` : relationshipLabel(link.decayTier),
  }
}

export function buildAdjacency(graph: GraphData): Map<string, Set<string>> {
  const adjacency = new Map(graph.nodes.map(node => [node.id, new Set([node.id])]))
  for (const link of graph.links) {
    if (!adjacency.has(link.source) || !adjacency.has(link.target)) continue
    adjacency.get(link.source)!.add(link.target)
    adjacency.get(link.target)!.add(link.source)
  }
  return adjacency
}

export function personNodeAriaLabel(
  node: TrustNode,
  currentUserId: string,
  distance: number | undefined,
  connections: number
): string {
  const parts = [node.name]
  if (node.id === currentUserId) parts.push('you')
  if (distance != null && node.id !== currentUserId) {
    parts.push(`${distance} ${distance === 1 ? 'degree' : 'degrees'} away`)
  }
  parts.push(`${connections} ${connections === 1 ? 'connection' : 'connections'}`)
  return parts.join(', ')
}
