import { useEffect, useMemo, useRef, useState } from 'react'
import * as d3 from 'd3'
import { useGraphContainerWidth } from '../../hooks/useGraphContainerWidth'
import { buildCommunityRingModel } from './communityRingModel'
import {
  PERSON_COLORS,
  UNRELATED_OPACITY,
  buildAdjacency,
  edgeVisual,
  personNodeAriaLabel,
  relationshipSummary,
  ringChordOpacity,
} from './graphVisualEncoding'
import GraphZoomControls from './GraphZoomControls'
import { clearGraphZoom, installGraphZoom, zoomBy, zoomReset } from './graphZoom'
import type { GraphData } from './types'

interface CommunityRingGraphProps {
  graphData: GraphData
  currentUserId: string
  height?: number
  focusedNodeId?: string
  onNodeActivate?: (nodeId: string) => void
  enableZoom?: boolean
}

const NODE_RADIUS = 6
const NODE_LABEL_LIMIT = 40

export default function CommunityRingGraph({
  graphData,
  currentUserId,
  height = 560,
  focusedNodeId,
  onNodeActivate,
  enableZoom = false,
}: CommunityRingGraphProps) {
  const { containerRef, width } = useGraphContainerWidth()
  const svgRef = useRef<SVGSVGElement>(null)
  const rootRef = useRef<SVGGElement>(null)
  const zoomBehaviorRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null)
  const initialTransformRef = useRef<d3.ZoomTransform>(d3.zoomIdentity)
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [transientFocusId, setTransientFocusId] = useState<string | null>(null)
  const isSparse = graphData.links.length === 0 && graphData.nodes.length <= 1

  const model = useMemo(
    () => buildCommunityRingModel(graphData, width, height, currentUserId),
    [graphData.nodes, graphData.links, width, height, currentUserId]
  )
  const adjacency = useMemo(
    () => buildAdjacency(graphData),
    [graphData.nodes, graphData.links]
  )
  const candidateFocus = transientFocusId ?? focusedNodeId ?? selectedNodeId ?? undefined
  const activeFocus = candidateFocus && adjacency.has(candidateFocus) ? candidateFocus : undefined
  const related = activeFocus ? adjacency.get(activeFocus) ?? new Set([activeFocus]) : null
  const connectionsFor = (nodeId: string) => Math.max(0, (adjacency.get(nodeId)?.size ?? 1) - 1)
  // Sprint 119 / ADR-086 — "where do you fit?" is only answerable when the viewer is in this ring;
  // steward/explorer views of a community the viewer isn't part of render whole and summary-free.
  const viewerInRing = graphData.nodes.some(node => node.id === currentUserId)
  const bondedNeighbours = viewerInRing ? connectionsFor(currentUserId) : 0
  const otherMembers = graphData.nodes.length - 1

  useEffect(() => {
    if (!svgRef.current || !rootRef.current) return
    const svg = svgRef.current
    const root = d3.select(rootRef.current)
    if (enableZoom) {
      const handle = installGraphZoom(svg, root, {
        width,
        height,
        cx: width / 2,
        cy: height / 2,
      })
      zoomBehaviorRef.current = handle.behavior
      initialTransformRef.current = handle.initialTransform
    } else {
      clearGraphZoom(svg, root, width / 2, height / 2)
      zoomBehaviorRef.current = null
    }
    return () => {
      d3.select(svg).on('.zoom', null)
    }
  }, [width, height, enableZoom, isSparse])

  const handleZoomBy = (factor: number) => {
    if (svgRef.current && zoomBehaviorRef.current) {
      zoomBy(svgRef.current, zoomBehaviorRef.current, factor)
    }
  }
  const handleZoomReset = () => {
    if (svgRef.current && zoomBehaviorRef.current) {
      zoomReset(svgRef.current, zoomBehaviorRef.current, initialTransformRef.current)
    }
  }

  if (isSparse) {
    return (
      <div ref={containerRef} className="relative">
        <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
          <p className="text-sm text-text-muted">
            This community doesn&apos;t have any trust connections yet.
          </p>
          <p className="text-xs text-text-muted">
            Connections appear after completed help, when neighbours have shown up for one another.
          </p>
        </div>
      </div>
    )
  }

  const selectedNode = selectedNodeId
    ? graphData.nodes.find(node => node.id === selectedNodeId)
    : undefined
  const selectedConnections = selectedNode ? connectionsFor(selectedNode.id) : 0
  const selectedRelationships = selectedNode
    ? relationshipSummary(model.links.map(item => item.link), selectedNode.id)
    : ''

  return (
    <div ref={containerRef} className="relative">
      {enableZoom && (
        <GraphZoomControls
          onZoomIn={() => handleZoomBy(1.2)}
          onZoomOut={() => handleZoomBy(1 / 1.2)}
          onReset={handleZoomReset}
        />
      )}

      <svg
        ref={svgRef}
        width={width}
        height={height}
        style={{ maxWidth: '100%' }}
        aria-label={
          viewerInRing
            ? 'Community trust connections — where you fit'
            : 'Community trust connections'
        }
      >
        <g ref={rootRef}>
          <g fill="none" aria-label="Relationships">
            {model.links.map(item => {
              const visual = edgeVisual(item.link, currentUserId, activeFocus)
              const incident =
                !!activeFocus &&
                (item.link.source === activeFocus || item.link.target === activeFocus)
              const isViewerChord =
                item.link.source === currentUserId || item.link.target === currentUserId
              return (
                <path
                  key={item.key}
                  data-link-key={item.key}
                  d={item.path}
                  fill="none"
                  stroke={visual.stroke}
                  strokeWidth={visual.width}
                  strokeOpacity={
                    activeFocus
                      ? incident
                        ? visual.opacity
                        : UNRELATED_OPACITY
                      : ringChordOpacity(visual.opacity, isViewerChord, viewerInRing)
                  }
                  className="transition-opacity motion-reduce:transition-none"
                >
                  <title>{visual.label}</title>
                </path>
              )
            })}
          </g>

          <g aria-label="Community members">
            {model.nodes.map(node => {
              const isSelected = selectedNodeId === node.id
              const isFocused = activeFocus === node.id
              const isRelated = !related || related.has(node.id)
              const showLabel =
                model.nodes.length <= NODE_LABEL_LIMIT ||
                node.id === currentUserId ||
                node.id === activeFocus
              const activate = () => {
                setSelectedNodeId(previous => (previous === node.id ? null : node.id))
                onNodeActivate?.(node.id)
              }
              return (
                <g
                  key={node.id}
                  data-node-id={node.id}
                  role="button"
                  tabIndex={0}
                  aria-label={personNodeAriaLabel(
                    node,
                    currentUserId,
                    node.degrees_of_separation,
                    connectionsFor(node.id)
                  )}
                  aria-pressed={isSelected}
                  transform={`translate(${node.x},${node.y})`}
                  opacity={isRelated ? 1 : UNRELATED_OPACITY}
                  className="cursor-pointer transition-opacity motion-reduce:transition-none"
                  onClick={activate}
                  onKeyDown={event => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault()
                      activate()
                    }
                  }}
                  onMouseEnter={() => setTransientFocusId(node.id)}
                  onMouseLeave={() => setTransientFocusId(null)}
                  onFocus={() => setTransientFocusId(node.id)}
                  onBlur={() => setTransientFocusId(null)}
                >
                  <title>{node.name}</title>
                  <circle
                    r={NODE_RADIUS}
                    fill={
                      node.id === currentUserId
                        ? PERSON_COLORS.callerNode
                        : PERSON_COLORS.ordinaryNode
                    }
                    stroke={
                      isFocused || isSelected || node.id === currentUserId
                        ? PERSON_COLORS.focusRing
                        : 'none'
                    }
                    strokeWidth={isFocused || isSelected ? 3 : node.id === currentUserId ? 2 : 0}
                  />
                  {showLabel && (
                    <text
                      className="node-label"
                      x={0}
                      y={-11}
                      textAnchor="middle"
                      fill="#cbd5e1"
                      fontSize={11}
                      style={{ pointerEvents: 'none' }}
                    >
                      {node.name}
                    </text>
                  )}
                </g>
              )
            })}
          </g>
        </g>
      </svg>

      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 px-1 text-xs text-text-muted">
        {viewerInRing && (
          <span className="flex items-center gap-1">
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-emerald-500" /> You
          </span>
        )}
        <span>Strong relationship</span>
        <span>Warm relationship</span>
        <span>Fading relationship</span>
        <span>Nearly forgotten relationship</span>
      </div>

      {viewerInRing && (
        <p className="mt-3 text-sm text-text">
          {bondedNeighbours > 0
            ? `You're bonded with ${bondedNeighbours} of ${otherMembers} ${
                otherMembers === 1 ? 'member' : 'members'
              } here.`
            : 'No bonds here yet — help someone to start weaving in.'}
        </p>
      )}

      {graphData.meta?.truncated && graphData.meta.totalActiveMembers ? (
        <p className="mt-3 text-sm text-text-muted">
          Showing {graphData.nodes.length} of {graphData.meta.totalActiveMembers} active members.
          This is an incomplete view of the community&apos;s connections.
        </p>
      ) : (
        <p className="mt-3 text-sm text-text-muted">
          Look for multiple routes, several bridges, few isolates, and whether one person has become
          indispensable.
        </p>
      )}

      {selectedNode && (
        <div className="mt-3 rounded-lg border border-border bg-surface p-4 text-sm">
          <div className="font-semibold text-text">{selectedNode.name}</div>
          {selectedNode.id === currentUserId && (
            <div className="mt-1 text-emerald-500">This is you</div>
          )}
          <div className="mt-2 text-text-muted">
            {selectedConnections} {selectedConnections === 1 ? 'connection' : 'connections'}
          </div>
          <div className="mt-1 text-text-muted">
            {selectedRelationships || 'No relationship states yet'}
          </div>
        </div>
      )}
    </div>
  )
}
