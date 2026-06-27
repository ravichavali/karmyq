import React, { useEffect, useMemo, useRef } from 'react'
import ForceGraph2D, { type ForceGraphMethods } from 'react-force-graph-2d'
import type { BelongingMode, GraphData } from './types'
import {
  buildAdjacency,
  layoutForMode,
  toCanvasGraphData,
  type CanvasGraphLink,
  type CanvasGraphNode,
} from './graphCanvasModel'

export interface GraphCanvasProps {
  graphData: GraphData
  mode: BelongingMode
  currentUserId: string
  groupMap?: Record<string, 'group_a' | 'group_b'>
  height: number
  width: number
  focusedNodeId?: string
  hoveredNodeId?: string | null
  /** The node a keyboard user has focused via the chrome control layer — gets a visible focus ring. */
  keyboardFocusedNodeId?: string | null
  onNodeHover?: (nodeId: string | null) => void
  onNodeClick?: (nodeId: string) => void
  graphRef?: React.MutableRefObject<ForceGraphMethods<any, any> | undefined>
}

const NODE_RADIUS = 5
const CURRENT_USER_RADIUS = 8
const COMMUNITY_MIN_RADIUS = 7
const COMMUNITY_MAX_RADIUS = 22
const FADE_OPACITY = 0.15

const DECAY_OPACITY_FACTOR: Record<NonNullable<CanvasGraphLink['decayTier']>, number> = {
  strong: 1,
  warm: 0.92,
  fading: 0.7,
  nearly_forgotten: 0.5,
  swept: 0.3,
}

const STATE_WEIGHT: Record<NonNullable<CanvasGraphLink['decayTier']>, number> = {
  strong: 4,
  warm: 3,
  fading: 2,
  nearly_forgotten: 1,
  swept: 0.5,
}

export default function GraphCanvas({
  graphData,
  mode,
  currentUserId,
  groupMap,
  height,
  width,
  focusedNodeId,
  hoveredNodeId,
  keyboardFocusedNodeId,
  onNodeHover,
  onNodeClick,
  graphRef,
}: GraphCanvasProps) {
  const localGraphRef = useRef<ForceGraphMethods<any, any> | undefined>(undefined)
  const forceGraphRef = graphRef ?? localGraphRef
  const layout = layoutForMode(mode)
  const canvasGraphData = useMemo(
    () => toCanvasGraphData(graphData, { mode, currentUserId, layout, width, height }),
    [currentUserId, graphData, height, layout, mode, width]
  )
  const adjacency = useMemo(() => buildAdjacency(graphData), [graphData])
  const clusterOf = useMemo(
    () => mode === 'fission'
      ? groupClusters(graphData.nodes.map(node => node.id), groupMap)
      : detectClusters(graphData),
    [graphData, groupMap, mode]
  )
  const maxWeight = useMemo(
    () => Math.max(...graphData.links.map(linkWeight), 1),
    [graphData.links]
  )
  const maxMembers = useMemo(
    () => Math.max(...graphData.nodes.map(node => node.member_count ?? 0), 1),
    [graphData.nodes]
  )
  const activeNodeId = hoveredNodeId ?? focusedNodeId ?? null
  // `linkOpacity` is not a real ForceGraph2D prop — the actual draw happens in `linkCanvasObject`
  // below. It's passed through (spread to dodge the prop type) so the canvas-boundary tests can
  // assert the ported parity opacity helper without querying the canvas.
  const parityLinkProps = {
    linkOpacity: (link: CanvasGraphLink) => linkOpacity(link, { mode, currentUserId, clusterOf, maxWeight }),
  }

  useEffect(() => {
    configureForces(forceGraphRef.current, mode, { reheat: true })
  }, [forceGraphRef, mode, canvasGraphData])

  const isNodeDimmed = (nodeId: string) => {
    if (!activeNodeId) return false
    return !(adjacency.get(activeNodeId) ?? new Set([activeNodeId])).has(nodeId)
  }

  const isLinkDimmed = (link: CanvasGraphLink) => {
    if (!activeNodeId) return false
    return linkEndpointId(link.source) !== activeNodeId && linkEndpointId(link.target) !== activeNodeId
  }

  return (
    <ForceGraph2D
      ref={forceGraphRef}
      graphData={canvasGraphData}
      width={width}
      height={height}
      minZoom={0.5}
      maxZoom={4}
      enableNodeDrag={mode === 'communities'}
      enableZoomInteraction={(event: MouseEvent) => event.type !== 'wheel'}
      enablePanInteraction={true}
      nodeId="id"
      linkSource="source"
      linkTarget="target"
      {...parityLinkProps}
      nodeVal={(node: CanvasGraphNode) => nodeRadius(node, currentUserId, mode, maxMembers)}
      nodeLabel={(node: CanvasGraphNode) => escapeHtmlLabel(node.id === currentUserId ? `${node.name} (you)` : node.name)}
      nodeCanvasObject={(node, ctx, globalScale) => {
        drawNode(node as CanvasGraphNode, ctx, globalScale, {
          mode,
          currentUserId,
          groupMap,
          maxMembers,
          dimmed: isNodeDimmed(String(node.id)),
          keyboardFocused: keyboardFocusedNodeId != null && String(node.id) === keyboardFocusedNodeId,
        })
      }}
      nodePointerAreaPaint={(node, paintColor, ctx) => {
        const radius = nodeRadius(node as CanvasGraphNode, currentUserId, mode, maxMembers)
        ctx.fillStyle = paintColor
        ctx.beginPath()
        ctx.arc((node.x ?? 0), (node.y ?? 0), radius + 4, 0, 2 * Math.PI, false)
        ctx.fill()
      }}
      linkColor={(link: CanvasGraphLink) => linkColor(link, { mode, currentUserId, clusterOf })}
      linkLineDash={(link: CanvasGraphLink) => linkLineDash(link)}
      linkWidth={(link: CanvasGraphLink) => linkWidth(link, mode)}
      linkCanvasObject={(link, ctx) => {
        drawLink(link as CanvasGraphLink, ctx, {
          color: linkColor(link as CanvasGraphLink, { mode, currentUserId, clusterOf }),
          dash: linkLineDash(link as CanvasGraphLink),
          opacity: isLinkDimmed(link as CanvasGraphLink)
            ? FADE_OPACITY
            : linkOpacity(link as CanvasGraphLink, { mode, currentUserId, clusterOf, maxWeight }),
          width: linkWidth(link as CanvasGraphLink, mode),
        })
      }}
      linkCanvasObjectMode={() => 'replace'}
      onNodeHover={(node) => onNodeHover?.(node?.id != null ? String(node.id) : null)}
      onNodeClick={(node) => {
        if (node.id != null) onNodeClick?.(String(node.id))
      }}
      onEngineStop={() => {
        // Re-apply force config in case the ref wasn't ready on first mount, but do NOT reheat:
        // reheating here would restart the simulation, which stops, fires onEngineStop again → an
        // endless reheat loop that never lets the graph settle (perpetual CPU/animation).
        configureForces(forceGraphRef.current, mode, { reheat: false })
      }}
    />
  )
}

function configureForces(
  graph: ForceGraphMethods<any, any> | undefined,
  mode: BelongingMode,
  options: { reheat: boolean }
) {
  if (!graph) return

  const linkForce = graph.d3Force('link') as ForceConfig | undefined
  const chargeForce = graph.d3Force('charge') as ForceConfig | undefined
  const centerForce = graph.d3Force('center') as ForceConfig | undefined
  const config = forceConfigForMode(mode)

  linkForce?.distance?.(config.linkDistance)
  linkForce?.strength?.(config.linkStrength)
  chargeForce?.strength?.(config.chargeStrength)
  centerForce?.strength?.(config.centerStrength)
  if (options.reheat) graph.d3ReheatSimulation()
}

function forceConfigForMode(mode: BelongingMode) {
  if (mode === 'ego') {
    return { linkDistance: 70, linkStrength: 0.9, chargeStrength: -140, centerStrength: 0.18 }
  }
  if (mode === 'communities') {
    return { linkDistance: 150, linkStrength: 0.35, chargeStrength: -80, centerStrength: 0.08 }
  }
  return { linkDistance: 95, linkStrength: 0.55, chargeStrength: -120, centerStrength: 0.12 }
}

function drawNode(
  node: CanvasGraphNode,
  ctx: CanvasRenderingContext2D,
  globalScale: number,
  options: {
    mode: BelongingMode
    currentUserId: string
    groupMap?: Record<string, 'group_a' | 'group_b'>
    maxMembers: number
    dimmed: boolean
    keyboardFocused: boolean
  }
) {
  const radius = nodeRadius(node, options.currentUserId, options.mode, options.maxMembers)
  ctx.globalAlpha = options.dimmed ? FADE_OPACITY : 1
  ctx.fillStyle = nodeFill(node, options)
  ctx.beginPath()
  ctx.arc(node.x ?? 0, node.y ?? 0, radius, 0, 2 * Math.PI, false)
  ctx.fill()

  const ringed = node.id === options.currentUserId || node.isCurrentUser || (options.mode === 'communities' && node.is_member)
  if (ringed) {
    ctx.strokeStyle = '#ffffff'
    ctx.lineWidth = 2 / globalScale
    ctx.stroke()
  }

  // Keyboard focus ring — a high-contrast amber halo that marks the exact node a keyboard user has
  // focused via the chrome control layer (canvas can't host a native DOM focus ring).
  if (options.keyboardFocused) {
    ctx.globalAlpha = 1
    ctx.strokeStyle = '#f59e0b'
    ctx.lineWidth = 3 / globalScale
    ctx.beginPath()
    ctx.arc(node.x ?? 0, node.y ?? 0, radius + 4, 0, 2 * Math.PI, false)
    ctx.stroke()
  }

  if (options.mode === 'fission' && node.isIsolated && node.id !== options.currentUserId) {
    withCanvasDash(ctx, [2, 2], () => {
      ctx.strokeStyle = nodeFill(node, options)
      ctx.globalAlpha = options.dimmed ? FADE_OPACITY : 0.5
      ctx.lineWidth = 1 / globalScale
      ctx.beginPath()
      ctx.arc(node.x ?? 0, node.y ?? 0, radius + 3, 0, 2 * Math.PI, false)
      ctx.stroke()
    })
  }

  if (options.mode === 'communities') {
    const textCtx = ctx as CanvasRenderingContext2D & { fillText?: CanvasRenderingContext2D['fillText'] }
    if (typeof textCtx.fillText === 'function') {
      textCtx.fillStyle = '#cbd5e1'
      textCtx.font = `${Math.max(10, 11 / globalScale)}px sans-serif`
      textCtx.textAlign = 'center'
      textCtx.fillText(node.name, node.x ?? 0, (node.y ?? 0) + radius + 13)
    }
  }
  ctx.globalAlpha = 1
}

function drawLink(
  link: CanvasGraphLink,
  ctx: CanvasRenderingContext2D,
  options: { color: string; dash: number[] | null; opacity: number; width: number }
) {
  const source = linkEndpoint(link.source)
  const target = linkEndpoint(link.target)
  if (!source || !target) return

  ctx.globalAlpha = options.opacity
  ctx.strokeStyle = options.color
  ctx.lineWidth = options.width
  withCanvasDash(ctx, options.dash, () => {
    ctx.beginPath()
    ctx.moveTo(source.x ?? 0, source.y ?? 0)
    ctx.lineTo(target.x ?? 0, target.y ?? 0)
    ctx.stroke()
  })
  ctx.globalAlpha = 1
}

function nodeRadius(
  node: CanvasGraphNode,
  currentUserId: string,
  mode: BelongingMode,
  maxMembers: number
): number {
  if (mode === 'communities') {
    return COMMUNITY_MIN_RADIUS
      + (COMMUNITY_MAX_RADIUS - COMMUNITY_MIN_RADIUS) * Math.sqrt((node.member_count ?? 0) / maxMembers)
  }
  if (node.id === currentUserId || node.isCurrentUser) return CURRENT_USER_RADIUS
  return NODE_RADIUS
}

function nodeFill(
  node: CanvasGraphNode,
  options: {
    mode: BelongingMode
    currentUserId: string
    groupMap?: Record<string, 'group_a' | 'group_b'>
  }
): string {
  if (options.mode === 'fission') {
    const group = options.groupMap?.[node.id]
    if (group === 'group_a') return '#3b82f6'
    if (group === 'group_b') return '#f97316'
    return '#94a3b8'
  }
  if (node.id === options.currentUserId || node.isCurrentUser) return '#10b981'
  if (options.mode === 'communities' && node.is_member) return '#10b981'
  return '#818cf8'
}

function linkColor(
  link: CanvasGraphLink,
  options: { mode: BelongingMode; currentUserId: string; clusterOf: Map<string, number> }
): string {
  if (options.mode === 'communities') return link.type === 'fission' ? '#a78bfa' : '#64748b'
  if (options.mode === 'fission') return sameCluster(link, options.clusterOf) ? '#22c55e' : '#ef4444'
  if (isCurrentUserEdge(link, options.currentUserId)) return '#fb923c'
  return sameCluster(link, options.clusterOf) ? '#6366f1' : '#94a3b8'
}

function linkLineDash(link: CanvasGraphLink): number[] | null {
  return link.type === 'fission' ? [6, 4] : null
}

function linkOpacity(
  link: CanvasGraphLink,
  options: { mode: BelongingMode; currentUserId: string; clusterOf: Map<string, number>; maxWeight: number }
): number {
  if (options.mode === 'communities') return link.type === 'fission' ? 0.9 : 0.55

  const base = 0.12 + 0.7 * (linkWeight(link) / options.maxWeight)
  const decay = link.decayTier ? DECAY_OPACITY_FACTOR[link.decayTier] : 1
  if (options.mode === 'community' && isCurrentUserEdge(link, options.currentUserId)) return Math.max(0.7, base) * decay
  if (options.mode === 'community' && !sameCluster(link, options.clusterOf)) return Math.min(base, 0.3) * decay
  return base * decay
}

function linkWidth(link: CanvasGraphLink, mode: BelongingMode): number {
  if (mode === 'communities') return link.type === 'fission' ? 2 : 1.5
  return Math.max(0.6, Math.log1p(linkWeight(link)) * 1.2)
}

function detectClusters(graphData: GraphData): Map<string, number> {
  const parent = new Map(graphData.nodes.map(node => [node.id, node.id]))
  const find = (id: string): string => {
    const next = parent.get(id)
    if (next === undefined || next === id) return id
    const root = find(next)
    parent.set(id, root)
    return root
  }
  const union = (a: string, b: string) => {
    if (parent.has(a) && parent.has(b)) parent.set(find(a), find(b))
  }

  ;[...graphData.links]
    .sort((a, b) => linkWeight(b) - linkWeight(a))
    .slice(0, Math.max(1, Math.floor(graphData.links.length * 0.4)))
    .forEach(link => union(linkEndpointId(link.source), linkEndpointId(link.target)))

  const rootToCluster = new Map<string, number>()
  const result = new Map<string, number>()
  let nextCluster = 0
  graphData.nodes.forEach(node => {
    const root = find(node.id)
    if (!rootToCluster.has(root)) rootToCluster.set(root, nextCluster++)
    result.set(node.id, rootToCluster.get(root)!)
  })
  return result
}

function groupClusters(nodeIds: string[], groupMap?: Record<string, 'group_a' | 'group_b'>): Map<string, number> {
  return new Map(nodeIds.map(nodeId => {
    const group = groupMap?.[nodeId]
    return [nodeId, group === 'group_a' ? 0 : group === 'group_b' ? 1 : 2]
  }))
}

function linkWeight(link: CanvasGraphLink): number {
  if (typeof link.effective_weight === 'number') return link.effective_weight
  return link.decayTier ? STATE_WEIGHT[link.decayTier] : 1
}

function isCurrentUserEdge(link: CanvasGraphLink, currentUserId: string): boolean {
  return linkEndpointId(link.source) === currentUserId || linkEndpointId(link.target) === currentUserId
}

function sameCluster(link: CanvasGraphLink, clusterOf: Map<string, number>): boolean {
  return (clusterOf.get(linkEndpointId(link.source)) ?? -1) === (clusterOf.get(linkEndpointId(link.target)) ?? -2)
}

function withCanvasDash(ctx: CanvasRenderingContext2D, dash: number[] | null, draw: () => void) {
  const dashedContext = ctx as CanvasRenderingContext2D & { setLineDash?: (segments: number[]) => void }
  dashedContext.setLineDash?.(dash ?? [])
  draw()
  dashedContext.setLineDash?.([])
}

// react-force-graph renders a string `nodeLabel` into its hover tooltip via innerHTML
// (force-graph → float-tooltip `.html(content)`), so a user-controlled display name containing
// markup would execute as stored XSS. Escape before it reaches the tooltip; the canvas `fillText`
// path needs no escaping (canvas text is not HTML).
function escapeHtmlLabel(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function linkEndpoint(value: CanvasGraphLink['source']): CanvasGraphNode | null {
  if (value && typeof value === 'object') return value as CanvasGraphNode
  return null
}

function linkEndpointId(value: CanvasGraphLink['source']): string {
  if (value && typeof value === 'object') return String((value as CanvasGraphNode).id)
  return String(value)
}

interface ForceConfig {
  distance?: (value: number) => unknown
  strength?: (value: number) => unknown
}
