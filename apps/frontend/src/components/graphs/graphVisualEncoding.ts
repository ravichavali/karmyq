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

// Sprint 119 / ADR-086 — "where do you fit?": the viewer's chords keep their full decayTier band
// presence; every other chord is quieted by ONE shared factor layered on top of the bands, with a
// small floor so related content never collapses into the unrelated-focus treatment. Applied only
// when the viewer is actually in the ring, so steward and explorer views stay whole.
export const NON_VIEWER_CHORD_QUIET_FACTOR = 0.5
export const QUIETED_RELATED_OPACITY_FLOOR = 0.12

export function ringChordOpacity(
  bandOpacity: number,
  isViewerChord: boolean,
  viewerInRing: boolean
): number {
  return viewerInRing && !isViewerChord
    ? Math.max(
        bandOpacity * NON_VIEWER_CHORD_QUIET_FACTOR,
        QUIETED_RELATED_OPACITY_FLOOR
      )
    : bandOpacity
}

// Sprint 119 / ADR-086 — hub bridges: a member↔member organic bridge answers "which of your
// communities are woven together?", so it renders emphasized. Aliveness is server-derived and
// fail-closed (`activeRecently`, same 30-day window as new bonds) and reuses the S118 new-bond
// green family; dormant and periphery bridges are quieted. Fission lineage keeps its shipped look.
export const ORGANIC_SLATE = '#64748b'
export const FISSION_VIOLET = '#a78bfa'
export const WOVEN_BRIDGE_WIDTH = 2.5
export const WOVEN_ALIVE_OPACITY = 0.85
export const WOVEN_DORMANT_OPACITY = 0.35
export const PERIPHERY_BRIDGE_WIDTH = 1.5
export const PERIPHERY_BRIDGE_OPACITY = 0.25

export interface HubBridgeVisual {
  stroke: string
  width: number
  opacity: number
  dasharray: string | null
  label: string
}

export function hubBridgeVisual(
  link: TrustLink,
  isMember: (communityId: string) => boolean
): HubBridgeVisual {
  if (link.type === 'fission') {
    return { stroke: FISSION_VIOLET, width: 2, opacity: 0.9, dasharray: '6,4', label: 'Fission lineage' }
  }
  if (!isMember(link.source) || !isMember(link.target)) {
    return {
      stroke: ORGANIC_SLATE,
      width: PERIPHERY_BRIDGE_WIDTH,
      opacity: PERIPHERY_BRIDGE_OPACITY,
      dasharray: null,
      label: 'Organic trust',
    }
  }
  if (link.activeRecently === true) {
    return {
      stroke: NEW_BOND_COLOR,
      width: WOVEN_BRIDGE_WIDTH,
      opacity: WOVEN_ALIVE_OPACITY,
      dasharray: null,
      label: 'Woven bridge — recent exchange',
    }
  }
  return {
    stroke: ORGANIC_SLATE,
    width: WOVEN_BRIDGE_WIDTH,
    opacity: WOVEN_DORMANT_OPACITY,
    dasharray: null,
    label: 'Dormant bridge',
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
