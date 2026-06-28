import { useEffect, useRef, useState, useMemo } from 'react'
import * as d3 from 'd3'
import type { GraphData, TrustLink, TrustNode } from './types'
import { linkKey } from './normalizeGraphData'
import GraphZoomControls from './GraphZoomControls'
import { clearGraphZoom, installGraphZoom, zoomBy, zoomReset } from './graphZoom'
import { useGraphContainerWidth } from '../../hooks/useGraphContainerWidth'

// Sprint 90 / ADR-070 — visible decay: fade an edge's opacity by how quiet the bond has gone, so the
// graph perceptibly fades alongside the relationship faces. `strong`/undefined = no extra fade.
const DECAY_OPACITY_FACTOR: Record<NonNullable<TrustLink['decayTier']>, number> = {
  strong: 1,
  warm: 0.92,
  fading: 0.7,
  nearly_forgotten: 0.5,
  swept: 0.3,
}

// Sprint 112 (ADR-082): person graphs no longer carry a numeric edge weight — only the qualitative
// relationship state (decayTier). Derive a nominal weight from that state so fission edge width and
// opacity still reflect bond strength. The split proposal supplies real weights where it has them.
const STATE_WEIGHT: Record<NonNullable<TrustLink['decayTier']>, number> = {
  strong: 4,
  warm: 3,
  fading: 2,
  nearly_forgotten: 1,
  swept: 0.5,
}
function linkWeight(l: TrustLink): number {
  if (typeof l.effective_weight === 'number') return l.effective_weight
  return l.decayTier ? STATE_WEIGHT[l.decayTier] : 1
}

interface TrustGraphHEBProps {
  graphData: GraphData
  currentUserId: string
  /** Sprint 115 (ADR-083): the HEB radial now renders ONLY the fission group split. Person modes (ego,
   *  community) and the across-communities hub each have their own dedicated renderer. */
  mode: 'fission'
  groupMap?: Record<string, 'group_a' | 'group_b'>
  groupALabel?: string
  groupBLabel?: string
  onSwitchGroup?: (nodeId: string, currentGroup: 'group_a' | 'group_b' | null) => Promise<void>
  height?: number
  // Sprint 111 / ADR-081 — interaction surface:
  focusedNodeId?: string
  onNodeActivate?: (nodeId: string) => void
  enableZoom?: boolean
}

// Uniform node sizing (ADR-063): every node is the same radius so the eye reads
// structure (clusters, ties) rather than mistaking dot size for importance. Only
// the current user is enlarged + white-ringed as a "you are here" anchor.
const NODE_RADIUS = 5
const CURRENT_USER_RADIUS = NODE_RADIUS + 3

const FADE_OPACITY = 0.15
const TRANSITION_MS = 400

const nodeLabel = (n: TrustNode, currentUserId: string) =>
  n.id === currentUserId ? `${n.name} (you)` : n.name

export default function TrustGraphHEB({
  graphData,
  currentUserId,
  mode,
  groupMap,
  groupALabel = 'Group A',
  groupBLabel = 'Group B',
  onSwitchGroup,
  height = 560,
  focusedNodeId,
  onNodeActivate,
  enableZoom = false,
}: TrustGraphHEBProps) {
  const { containerRef, width } = useGraphContainerWidth()
  const svgRef = useRef<SVGSVGElement>(null)
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [switching, setSwitching] = useState(false)
  // Sprint 113 / BUG-027 — the live zoom behavior + its seeded initial transform, lifted to refs so the
  // zoom control buttons can drive the SAME d3.zoom the scroll/pinch gestures use (single owner).
  const zoomBehaviorRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null)
  const initialTransformRef = useRef<d3.ZoomTransform>(d3.zoomIdentity)

  // Fission cluster assignment: each node sits in its proposed group (a / b / unassigned).
  const clusterOf = useMemo(() => {
    const m = new Map<string, number>()
    graphData.nodes.forEach(n => {
      const g = groupMap?.[n.id]
      m.set(n.id, g === 'group_a' ? 0 : g === 'group_b' ? 1 : 2)
    })
    return m
  }, [graphData, groupMap])

  const maxWeight = useMemo(
    () => Math.max(...graphData.links.map(linkWeight), 1),
    [graphData.links]
  )

  useEffect(() => {
    if (!svgRef.current || graphData.nodes.length === 0) return

    const svg = d3.select(svgRef.current)

    // Persistent renderer-owned layers (created once). Sprint 111: keyed joins + transitions replace
    // the old `svg.selectAll('*').remove()` teardown so explorer expansions animate instead of flashing.
    let root = svg.select<SVGGElement>('g.heb-root')
    if (root.empty()) {
      root = svg.append('g').attr('class', 'heb-root')
      root.append('g').attr('class', 'edges').attr('fill', 'none')
      root.append('g').attr('class', 'nodes')
    }
    const edgesG = root.select<SVGGElement>('g.edges')
    const nodesG = root.select<SVGGElement>('g.nodes')

    const cx = width / 2
    const cy = height / 2
    const radius = Math.max(60, Math.min(width, height) / 2 - 90)

    // Build root -> clusters -> nodes hierarchy, contiguous by cluster on the circle.
    const clusterIds = [...new Set(graphData.nodes.map(n => clusterOf.get(n.id) ?? 0))].sort((a, b) => a - b)
    const groups = clusterIds.map(cid => ({
      children: graphData.nodes.filter(n => (clusterOf.get(n.id) ?? 0) === cid),
    }))
    const hierarchyRoot = d3.hierarchy<any>({ children: groups }, d => d.children)
    d3.cluster<any>().size([2 * Math.PI, radius])(hierarchyRoot)

    const leaves = hierarchyRoot.leaves()
    const leafById = new Map<string, d3.HierarchyPointNode<any>>(
      leaves.map(l => [l.data.id as string, l as d3.HierarchyPointNode<any>])
    )

    const line = d3.lineRadial<d3.HierarchyPointNode<any>>()
      .curve(d3.curveBundle.beta(0.85))
      .radius(d => (d as any).y)
      .angle(d => (d as any).x)

    const sameCluster = (l: TrustLink) =>
      (clusterOf.get(l.source) ?? -1) === (clusterOf.get(l.target) ?? -2)

    // Within-group ties are green, cross-group ties red — the split's structural tension at a glance.
    const edgeColor = (l: TrustLink): string => (sameCluster(l) ? '#22c55e' : '#ef4444')
    const edgeOpacity = (l: TrustLink): number => {
      const base = 0.12 + 0.7 * (linkWeight(l) / maxWeight)
      const decay = l.decayTier ? DECAY_OPACITY_FACTOR[l.decayTier] : 1
      return base * decay
    }
    const edgeWidth = (l: TrustLink): number =>
      Math.max(0.6, Math.log1p(linkWeight(l)) * 1.2)

    const nodeColor = (n: TrustNode): string => {
      const grp = groupMap?.[n.id]
      if (grp === 'group_a') return '#3b82f6'
      if (grp === 'group_b') return '#f97316'
      return '#94a3b8'
    }
    const nodeRadius = (n: TrustNode) => (n.id === currentUserId ? CURRENT_USER_RADIUS : NODE_RADIUS)
    // The "you" anchor is a STROKE ring, not a larger circle, so node radius stays uniform (ADR-063).
    const ringed = (n: TrustNode) => n.id === currentUserId

    // Adjacency for hover/focus highlight (built once per render).
    const adjacency = new Map<string, Set<string>>()
    graphData.nodes.forEach(n => adjacency.set(n.id, new Set([n.id])))
    graphData.links.forEach(l => {
      adjacency.get(l.source)?.add(l.target)
      adjacency.get(l.target)?.add(l.source)
    })

    const nodeTransform = (d: any) => `rotate(${(d.x * 180) / Math.PI - 90}) translate(${d.y},0)`

    // ── edges ──────────────────────────────────────────────────────────────────────────────────
    const linkPaths = graphData.links
      .map(l => {
        const a = leafById.get(l.source)
        const b = leafById.get(l.target)
        return a && b ? { link: l, path: a.path(b) } : null
      })
      .filter((x): x is { link: TrustLink; path: d3.HierarchyPointNode<any>[] } => x !== null)

    const edgeSel = edgesG.selectAll<SVGPathElement, { link: TrustLink; path: any }>('path.edge')
      .data(linkPaths, (d: any) => linkKey(d.link))
    edgeSel.exit().remove()
    const edgeMerge = edgeSel.enter()
      .append('path')
      .attr('class', 'edge')
      .attr('fill', 'none')
      .merge(edgeSel as any)
    edgeMerge
      .attr('stroke', d => edgeColor(d.link))
      .attr('stroke-width', d => edgeWidth(d.link))
      .attr('stroke-dasharray', d => (d.link.type === 'fission' ? '6,4' : null))
    edgeMerge.transition().duration(TRANSITION_MS).attr('d', d => line(d.path))

    // ── nodes (label is a child so highlight cascades) ───────────────────────────────────────────
    const activate = (id: string) => {
      if (onNodeActivate) onNodeActivate(id)
      else setSelectedNodeId(prev => (prev === id ? null : id))
    }

    const nodeSel = nodesG.selectAll<SVGGElement, d3.HierarchyPointNode<any>>('g.node')
      .data(leaves, (d: any) => d.data.id)
    nodeSel.exit().remove()
    const nodeEnter = nodeSel.enter()
      .append('g')
      .attr('class', 'node')
      .attr('data-node-id', (d: any) => d.data.id)
      .attr('role', 'button')
      .attr('tabindex', '0')
      .style('cursor', 'pointer')
      .attr('transform', nodeTransform)
    nodeEnter.append('circle').attr('class', 'node-dot')
    nodeEnter.append('title')
    nodeEnter.append('text')
      .attr('class', 'label')
      .attr('dy', '0.31em')
      .attr('font-size', '9px')
      .attr('fill', '#94a3b8')
      .style('pointer-events', 'none')

    const nodeMerge = nodeEnter.merge(nodeSel as any)
    nodeMerge.attr('aria-label', (d: any) => nodeLabel(d.data, currentUserId))
    nodeMerge.select('title').text((d: any) => nodeLabel(d.data, currentUserId))
    nodeMerge.select('circle.node-dot')
      .attr('r', (d: any) => nodeRadius(d.data))
      .attr('fill', (d: any) => nodeColor(d.data))
      .attr('stroke', (d: any) => (ringed(d.data) ? '#fff' : 'none'))
      .attr('stroke-width', (d: any) => (ringed(d.data) ? 2 : 0))

    // A dashed ring marks members with no trust connections yet (matches the legend's "dashed = no
    // connections"). Managed idempotently so keyed updates add/remove it as needed.
    nodeMerge.each(function (d: any) {
      const sel = d3.select(this)
      const showRing = !!d.data.isIsolated && d.data.id !== currentUserId
      const ring = sel.select('circle.iso-ring')
      if (showRing && ring.empty()) {
        sel.append('circle')
          .attr('class', 'iso-ring')
          .attr('r', nodeRadius(d.data) + 3)
          .attr('fill', 'none')
          .attr('stroke', nodeColor(d.data))
          .attr('stroke-opacity', 0.5)
          .attr('stroke-dasharray', '2,2')
          .style('pointer-events', 'none')
      } else if (!showRing && !ring.empty()) {
        ring.remove()
      }
    })
    nodeMerge.select('text.label')
      .attr('x', (d: any) => (d.x < Math.PI ? 8 : -8))
      .attr('text-anchor', (d: any) => (d.x < Math.PI ? 'start' : 'end'))
      .attr('transform', (d: any) => (d.x >= Math.PI ? 'rotate(180)' : null))
      .text((d: any) => nodeLabel(d.data, currentUserId))
    nodeMerge.transition().duration(TRANSITION_MS).attr('transform', nodeTransform)

    // Rebind handlers each render so they capture the latest props/closures.
    nodeMerge
      .on('click', (_e: any, d: any) => activate(d.data.id))
      .on('keydown', (e: any, d: any) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          activate(d.data.id)
        }
      })
      .on('mouseenter', (_e: any, d: any) => applyHighlight(d.data.id))
      .on('mouseleave', () => applyHighlight(focusedNodeId ?? null))
      .on('focus', (_e: any, d: any) => applyHighlight(d.data.id))
      .on('blur', () => applyHighlight(focusedNodeId ?? null))

    function applyHighlight(focusId: string | null) {
      if (!focusId) {
        nodeMerge.attr('opacity', 1)
        edgeMerge.attr('stroke-opacity', d => edgeOpacity(d.link))
        return
      }
      const related = adjacency.get(focusId) ?? new Set([focusId])
      nodeMerge.attr('opacity', (d: any) => (related.has(d.data.id) ? 1 : FADE_OPACITY))
      edgeMerge.attr('stroke-opacity', d =>
        d.link.source === focusId || d.link.target === focusId ? edgeOpacity(d.link) : FADE_OPACITY
      )
    }

    // Initial highlight state (pinned focus, else fully visible).
    applyHighlight(focusedNodeId ?? null)

    // ── pan/zoom (single owner; shared contract with CommunityHubGraph) ──────────────────────────────
    if (enableZoom) {
      const { behavior, initialTransform } = installGraphZoom(svgRef.current, root, { width, height, cx, cy })
      zoomBehaviorRef.current = behavior
      initialTransformRef.current = initialTransform
    } else {
      clearGraphZoom(svgRef.current, root, cx, cy)
      zoomBehaviorRef.current = null
    }
  }, [graphData, clusterOf, mode, groupMap, currentUserId, width, height, maxWeight, enableZoom, focusedNodeId, onNodeActivate])

  // Remove the zoom listener on unmount.
  useEffect(() => {
    const node = svgRef.current
    return () => {
      if (node) d3.select(node).on('.zoom', null)
    }
  }, [])

  // Button-driven zoom: drive the SAME d3.zoom the gestures use (single owner; shared with the hub).
  const handleZoomBy = (factor: number) => {
    if (svgRef.current && zoomBehaviorRef.current) zoomBy(svgRef.current, zoomBehaviorRef.current, factor)
  }
  const handleZoomReset = () => {
    if (svgRef.current && zoomBehaviorRef.current) zoomReset(svgRef.current, zoomBehaviorRef.current, initialTransformRef.current)
  }

  const selectedNode = selectedNodeId
    ? graphData.nodes.find(n => n.id === selectedNodeId)
    : null
  const connectionCount = (id: string) =>
    graphData.links.filter(l => l.source === id || l.target === id).length

  return (
    <div ref={containerRef} className="relative">
      {enableZoom && graphData.nodes.length > 0 && (
        <GraphZoomControls
          onZoomIn={() => handleZoomBy(1.2)}
          onZoomOut={() => handleZoomBy(1 / 1.2)}
          onReset={handleZoomReset}
        />
      )}
      <svg ref={svgRef} width={width} height={height} style={{ maxWidth: '100%' }} />

      {/* Fission legend: group colors, within/cross-group tie hues, you-anchor + isolation marks. */}
      <div className="flex flex-wrap gap-4 text-xs text-text-muted mt-2 px-1">
        <span className="flex items-center gap-1">
          <span className="inline-block w-2.5 h-2.5 rounded-full bg-blue-500" /> {groupALabel}
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-2.5 h-2.5 rounded-full bg-orange-500" /> {groupBLabel}
        </span>
        <span className="flex items-center gap-1 text-green-600">— within-group tie</span>
        <span className="flex items-center gap-1 text-red-500">— cross-group tie</span>
        <span className="text-gray-400">white ring = you · dashed = no connections</span>
      </div>

      {selectedNode && (
        <div className="mt-3 p-4 bg-surface rounded-lg border border-border text-sm">
          <div className="font-semibold text-text mb-2">{selectedNode.name}</div>
          <div className="space-y-3">
            <div className="flex items-center justify-between text-text-muted">
              <span>Group</span>
              {groupMap?.[selectedNode.id] === 'group_a' ? (
                <span className="font-medium text-blue-600">{groupALabel}</span>
              ) : groupMap?.[selectedNode.id] === 'group_b' ? (
                <span className="font-medium text-orange-600">{groupBLabel}</span>
              ) : (
                <span className="text-gray-400 italic">unassigned</span>
              )}
            </div>
            <div className="flex items-center justify-between text-text-muted">
              <span>Connections</span>
              {selectedNode.isIsolated ? (
                <span className="text-gray-400 italic">none yet</span>
              ) : (
                <span className="text-text">{connectionCount(selectedNode.id)}</span>
              )}
            </div>
            {onSwitchGroup && selectedNode.id !== currentUserId && groupMap?.[selectedNode.id] && (
              <button
                disabled={switching}
                onClick={async () => {
                  setSwitching(true)
                  try {
                    await onSwitchGroup(selectedNode.id, groupMap[selectedNode.id] ?? null)
                    setSelectedNodeId(null)
                  } finally {
                    setSwitching(false)
                  }
                }}
                className={`w-full py-1.5 rounded text-sm font-medium transition-colors disabled:opacity-50 ${
                  groupMap[selectedNode.id] === 'group_a'
                    ? 'bg-orange-100 text-orange-700 hover:bg-orange-200'
                    : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                }`}
              >
                {switching ? '…' : `Move to ${groupMap[selectedNode.id] === 'group_a' ? groupBLabel : groupALabel}`}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
