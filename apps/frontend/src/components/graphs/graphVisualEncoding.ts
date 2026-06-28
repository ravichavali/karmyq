import type { GraphData, TrustLink, TrustNode } from './types'

export const PERSON_EDGE_WIDTH = 1.35
export const FOCUSED_EDGE_WIDTH = 2.5
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

export function edgeVisual(link: TrustLink, currentUserId: string, focusedNodeId?: string) {
  const caller = link.source === currentUserId || link.target === currentUserId
  const focused = !!focusedNodeId && (link.source === focusedNodeId || link.target === focusedNodeId)
  return {
    stroke: caller
      ? PERSON_COLORS.callerEdge
      : focused
        ? PERSON_COLORS.focusedEdge
        : PERSON_COLORS.ordinaryEdge,
    opacity: link.decayTier ? OPACITY[link.decayTier] ?? 0.16 : 0.16,
    width: focused ? FOCUSED_EDGE_WIDTH : PERSON_EDGE_WIDTH,
    label: relationshipLabel(link.decayTier),
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
