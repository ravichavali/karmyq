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
  height: number
  width: number
  focusedNodeId?: string
  hoveredNodeId?: string | null
  enableZoom?: boolean
  onNodeHover?: (nodeId: string | null) => void
  onNodeClick?: (nodeId: string) => void
  graphRef?: React.MutableRefObject<ForceGraphMethods<any, any> | undefined>
}

const NODE_RADIUS = 5
const CURRENT_USER_RADIUS = 8

export default function GraphCanvas({
  graphData,
  mode,
  currentUserId,
  height,
  width,
  focusedNodeId,
  hoveredNodeId,
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
  const activeNodeId = hoveredNodeId ?? focusedNodeId ?? null

  useEffect(() => {
    configureForces(forceGraphRef.current, mode)
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
      nodeLabel={(node: CanvasGraphNode) => node.id === currentUserId ? `${node.name} (you)` : node.name}
      nodeCanvasObject={(node, ctx, globalScale) => {
        drawNode(node as CanvasGraphNode, ctx, globalScale, {
          currentUserId,
          dimmed: isNodeDimmed(String(node.id)),
        })
      }}
      nodePointerAreaPaint={(node, paintColor, ctx) => {
        const radius = nodeRadius(node as CanvasGraphNode, currentUserId)
        ctx.fillStyle = paintColor
        ctx.beginPath()
        ctx.arc((node.x ?? 0), (node.y ?? 0), radius + 4, 0, 2 * Math.PI, false)
        ctx.fill()
      }}
      linkCanvasObject={(link, ctx) => {
        drawLink(link as CanvasGraphLink, ctx, isLinkDimmed(link as CanvasGraphLink))
      }}
      linkCanvasObjectMode={() => 'replace'}
      onNodeHover={(node) => onNodeHover?.(node?.id != null ? String(node.id) : null)}
      onNodeClick={(node) => {
        if (node.id != null) onNodeClick?.(String(node.id))
      }}
      onEngineStop={() => {
        configureForces(forceGraphRef.current, mode)
      }}
    />
  )
}

function configureForces(graph: ForceGraphMethods<any, any> | undefined, mode: BelongingMode) {
  if (!graph) return

  const linkForce = graph.d3Force('link') as ForceConfig | undefined
  const chargeForce = graph.d3Force('charge') as ForceConfig | undefined
  const centerForce = graph.d3Force('center') as ForceConfig | undefined
  const config = forceConfigForMode(mode)

  linkForce?.distance?.(config.linkDistance)
  linkForce?.strength?.(config.linkStrength)
  chargeForce?.strength?.(config.chargeStrength)
  centerForce?.strength?.(config.centerStrength)
  graph.d3ReheatSimulation()
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
  options: { currentUserId: string; dimmed: boolean }
) {
  const radius = nodeRadius(node, options.currentUserId)
  ctx.globalAlpha = options.dimmed ? 0.18 : 1
  ctx.fillStyle = nodeFill(node, options.currentUserId)
  ctx.beginPath()
  ctx.arc(node.x ?? 0, node.y ?? 0, radius, 0, 2 * Math.PI, false)
  ctx.fill()

  if (node.id === options.currentUserId || node.isCurrentUser) {
    ctx.strokeStyle = '#ffffff'
    ctx.lineWidth = 2 / globalScale
    ctx.stroke()
  }
  ctx.globalAlpha = 1
}

function drawLink(link: CanvasGraphLink, ctx: CanvasRenderingContext2D, dimmed: boolean) {
  const source = linkEndpoint(link.source)
  const target = linkEndpoint(link.target)
  if (!source || !target) return

  ctx.globalAlpha = dimmed ? 0.15 : linkOpacity(link)
  ctx.strokeStyle = link.type === 'fission' ? '#a78bfa' : '#94a3b8'
  ctx.lineWidth = Math.max(1, Math.log1p(link.effective_weight ?? 1))
  ctx.beginPath()
  ctx.moveTo(source.x ?? 0, source.y ?? 0)
  ctx.lineTo(target.x ?? 0, target.y ?? 0)
  ctx.stroke()
  ctx.globalAlpha = 1
}

function nodeRadius(node: CanvasGraphNode, currentUserId: string): number {
  if (node.id === currentUserId || node.isCurrentUser) return CURRENT_USER_RADIUS
  if (typeof node.member_count === 'number') return Math.min(18, NODE_RADIUS + Math.sqrt(node.member_count))
  return NODE_RADIUS
}

function nodeFill(node: CanvasGraphNode, currentUserId: string): string {
  if (node.id === currentUserId || node.isCurrentUser) return '#10b981'
  if (node.is_member) return '#10b981'
  if (node.isIsolated) return '#94a3b8'
  return '#818cf8'
}

function linkOpacity(link: CanvasGraphLink): number {
  if (link.decayTier === 'nearly_forgotten') return 0.45
  if (link.decayTier === 'fading') return 0.65
  if (link.decayTier === 'warm') return 0.82
  return 0.9
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
