import type { BelongingMode, GraphData, TrustLink, TrustNode } from './types'

export type GraphLayout = 'egocentric' | 'member-topology' | 'network-web'

export interface CanvasGraphOptions {
  mode: BelongingMode
  currentUserId: string
  layout: GraphLayout
  width: number
  height: number
}

export interface CanvasGraphNode extends TrustNode {
  x?: number
  y?: number
  fx?: number
  fy?: number
}

export interface CanvasGraphLink extends TrustLink {}

export interface CanvasGraphData {
  nodes: CanvasGraphNode[]
  links: CanvasGraphLink[]
  meta?: GraphData['meta']
}

export interface NodeDetailRow {
  label: string
  value: string
  tone?: 'self'
}

export function layoutForMode(mode: BelongingMode): GraphLayout {
  if (mode === 'ego') return 'egocentric'
  if (mode === 'communities') return 'network-web'
  return 'member-topology'
}

export function buildAdjacency(graphData: GraphData): Map<string, Set<string>> {
  const adjacency = new Map<string, Set<string>>()
  graphData.nodes.forEach(node => adjacency.set(node.id, new Set([node.id])))
  graphData.links.forEach(link => {
    if (!adjacency.has(link.source)) adjacency.set(link.source, new Set([link.source]))
    if (!adjacency.has(link.target)) adjacency.set(link.target, new Set([link.target]))
    adjacency.get(link.source)!.add(link.target)
    adjacency.get(link.target)!.add(link.source)
  })
  return adjacency
}

export function toCanvasGraphData(graphData: GraphData, options: CanvasGraphOptions): CanvasGraphData {
  const nodes = graphData.nodes.map((node, index) => placeNode({ ...node }, index, graphData.nodes.length, options))
  return {
    nodes,
    links: graphData.links.map(link => ({ ...link })),
    ...(graphData.meta ? { meta: { ...graphData.meta } } : {}),
  }
}

export function describeNodeDetail(
  node: TrustNode,
  graphData: GraphData,
  currentUserId: string,
  mode: BelongingMode
): NodeDetailRow[] {
  const connections = String(connectionCount(node.id, graphData.links))

  if (mode === 'communities') {
    const rows: NodeDetailRow[] = [
      { label: 'Members', value: String(node.member_count ?? 0) },
      { label: 'Status', value: node.status ?? 'unknown' },
    ]
    if (node.is_member) rows.push({ label: "You're a member", value: 'Yes', tone: 'self' })
    return rows
  }

  if (mode === 'fission') {
    return [
      { label: 'Group', value: fissionGroupLabel(node) },
      { label: 'Connections', value: node.isIsolated ? 'none yet' : connections },
    ]
  }

  const rows: NodeDetailRow[] = []
  if (node.id === currentUserId || node.isCurrentUser) rows.push({ label: 'This is you', value: 'Yes', tone: 'self' })
  if (node.degrees_of_separation != null && node.id !== currentUserId) {
    rows.push({ label: 'Degrees away', value: String(node.degrees_of_separation) })
  }
  rows.push({ label: 'Connections', value: connections })
  return rows
}

function placeNode(
  node: CanvasGraphNode,
  index: number,
  total: number,
  options: CanvasGraphOptions
): CanvasGraphNode {
  if (options.layout === 'egocentric') return placeEgocentricNode(node, index, total, options.currentUserId)
  if (options.layout === 'network-web') return placeNetworkWebNode(node, index, total, options)
  return placeCircleNode(node, index, total, Math.max(80, Math.min(options.width, options.height) / 3))
}

function placeEgocentricNode(
  node: CanvasGraphNode,
  index: number,
  total: number,
  currentUserId: string
): CanvasGraphNode {
  if (node.id === currentUserId || node.isCurrentUser) return { ...node, x: 0, y: 0, fx: 0, fy: 0 }

  const depth = node.degrees_of_separation ?? 1
  const radius = 90 * depth
  const angle = stableAngle(index, total)
  return { ...node, x: Math.cos(angle) * radius, y: Math.sin(angle) * radius }
}

function placeNetworkWebNode(
  node: CanvasGraphNode,
  index: number,
  total: number,
  options: CanvasGraphOptions
): CanvasGraphNode {
  const memberRadius = Math.max(24, Math.min(options.width, options.height) / 10)
  const outerRadius = Math.max(120, Math.min(options.width, options.height) / 2 - 80)
  const radius = node.is_member ? memberRadius : outerRadius
  const angle = stableAngle(index, total)
  return { ...node, x: Math.cos(angle) * radius, y: Math.sin(angle) * radius }
}

function placeCircleNode(
  node: CanvasGraphNode,
  index: number,
  total: number,
  radius: number
): CanvasGraphNode {
  const angle = stableAngle(index, total)
  return { ...node, x: Math.cos(angle) * radius, y: Math.sin(angle) * radius }
}

function stableAngle(index: number, total: number): number {
  return (index / Math.max(total, 1)) * 2 * Math.PI - Math.PI / 2
}

function connectionCount(nodeId: string, links: TrustLink[]): number {
  return links.filter(link => link.source === nodeId || link.target === nodeId).length
}

function fissionGroupLabel(node: TrustNode): string {
  const group = (node as TrustNode & { group?: string; group_id?: string; proposed_group?: string }).group
    ?? (node as TrustNode & { group?: string; group_id?: string; proposed_group?: string }).group_id
    ?? (node as TrustNode & { group?: string; group_id?: string; proposed_group?: string }).proposed_group

  if (group === 'group_a') return 'Group A'
  if (group === 'group_b') return 'Group B'
  return group ?? 'unassigned'
}
