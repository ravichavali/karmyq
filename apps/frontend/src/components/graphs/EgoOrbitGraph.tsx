import { useEffect, useMemo, useRef, useState } from 'react'
import * as d3 from 'd3'
import { useGraphContainerWidth } from '../../hooks/useGraphContainerWidth'
import { buildEgoOrbitModel } from './egoOrbitModel'
import {
  PERSON_COLORS,
  UNRELATED_OPACITY,
  buildAdjacency,
  edgeVisual,
  personNodeAriaLabel,
  relationshipSummary,
} from './graphVisualEncoding'
import GraphZoomControls from './GraphZoomControls'
import { clearGraphZoom, installGraphZoom, zoomBy, zoomReset } from './graphZoom'
import type { GraphData } from './types'

interface EgoOrbitGraphProps {
  graphData: GraphData
  currentUserId: string
  baselineNodeIds?: readonly string[]
  expansionRootIds?: readonly string[]
  height?: number
  focusedNodeId?: string
  onNodeActivate?: (nodeId: string) => void
  enableZoom?: boolean
}

const NODE_RADIUS = 6
const NODE_LABEL_LIMIT = 40

export default function EgoOrbitGraph({
  graphData,
  currentUserId,
  baselineNodeIds,
  expansionRootIds,
  height = 560,
  focusedNodeId,
  onNodeActivate,
  enableZoom = false,
}: EgoOrbitGraphProps) {
  const { containerRef, width } = useGraphContainerWidth()
  const svgRef = useRef<SVGSVGElement>(null)
  const rootRef = useRef<SVGGElement>(null)
  const zoomBehaviorRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null)
  const initialTransformRef = useRef<d3.ZoomTransform>(d3.zoomIdentity)
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [transientFocusId, setTransientFocusId] = useState<string | null>(null)
  const isSparse = graphData.links.length === 0 && graphData.nodes.length <= 1

  // Focus is intentionally excluded from the dependency list: highlighting a node must never recompute
  // geometry, so the orbit layout depends only on topology, the caller, dimensions, and the stable
  // baseline/expansion identity supplied by the surface.
  const model = useMemo(
    () => buildEgoOrbitModel(graphData, currentUserId, width, height, { baselineNodeIds, expansionRootIds }),
    [graphData.nodes, graphData.links, currentUserId, width, height, baselineNodeIds, expansionRootIds]
  )
  const adjacency = useMemo(() => buildAdjacency(graphData), [graphData.nodes, graphData.links])
  const candidateFocus = transientFocusId ?? focusedNodeId ?? selectedNodeId ?? undefined
  const activeFocus = candidateFocus && adjacency.has(candidateFocus) ? candidateFocus : undefined
  const related = activeFocus ? adjacency.get(activeFocus) ?? new Set([activeFocus]) : null
  const connectionsFor = (nodeId: string) => Math.max(0, (adjacency.get(nodeId)?.size ?? 1) - 1)

  // Subtle concentric guides, one per occupied positive distance. Never sized or colored by person.
  const orbitRadii = useMemo(() => {
    const byDistance = new Map<number, number>()
    for (const node of model.nodes) {
      if (node.displayDistance != null && node.displayDistance > 0 && !byDistance.has(node.displayDistance)) {
        byDistance.set(node.displayDistance, Math.hypot(node.x, node.y))
      }
    }
    return [...byDistance.entries()].sort((a, b) => a[0] - b[0]).map(([, radius]) => radius)
  }, [model.nodes])

  useEffect(() => {
    if (!svgRef.current || !rootRef.current) return
    const svg = svgRef.current
    const root = d3.select(rootRef.current)
    if (enableZoom) {
      const handle = installGraphZoom(svg, root, { width, height, cx: width / 2, cy: height / 2 })
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
          <p className="text-sm text-text-muted">You don&apos;t have any trust connections yet.</p>
          <p className="text-xs text-text-muted">
            Connections grow through the help you give and receive.
          </p>
        </div>
      </div>
    )
  }

  const selectedNode = selectedNodeId
    ? model.nodes.find(node => node.id === selectedNodeId)
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
        aria-label="Your trust connections"
      >
        <g ref={rootRef}>
          <g aria-hidden="true" fill="none" stroke={PERSON_COLORS.ordinaryNode} strokeOpacity={0.15}>
            {orbitRadii.map((radius, index) => (
              <circle key={index} cx={0} cy={0} r={radius} style={{ pointerEvents: 'none' }} />
            ))}
          </g>

          <g fill="none" aria-label="Relationships">
            {model.links.map(item => {
              const visual = edgeVisual(item.link, currentUserId, activeFocus)
              const incident =
                !!activeFocus &&
                (item.link.source === activeFocus || item.link.target === activeFocus)
              return (
                <line
                  key={item.key}
                  data-link-key={item.key}
                  x1={item.x1}
                  y1={item.y1}
                  x2={item.x2}
                  y2={item.y2}
                  stroke={visual.stroke}
                  strokeWidth={visual.width}
                  strokeOpacity={activeFocus && !incident ? UNRELATED_OPACITY : visual.opacity}
                  className="transition-opacity motion-reduce:transition-none"
                >
                  <title>{visual.label}</title>
                </line>
              )
            })}
          </g>

          <g aria-label="People in your network">
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
                    node.displayDistance ?? undefined,
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
                      node.id === currentUserId ? PERSON_COLORS.callerNode : PERSON_COLORS.ordinaryNode
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
        <span>Strong relationship</span>
        <span>Warm relationship</span>
        <span>Fading relationship</span>
        <span>Nearly forgotten relationship</span>
      </div>

      {selectedNode && (
        <div className="mt-3 rounded-lg border border-border bg-surface p-4 text-sm">
          <div className="font-semibold text-text">{selectedNode.name}</div>
          {selectedNode.id === currentUserId ? (
            <div className="mt-1 text-emerald-500">This is you</div>
          ) : (
            selectedNode.displayDistance != null && (
              <div className="mt-1 text-text-muted">
                {selectedNode.displayDistance}{' '}
                {selectedNode.displayDistance === 1 ? 'degree' : 'degrees'} away
              </div>
            )
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
