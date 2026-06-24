import { useEffect, useRef, useState, useMemo } from 'react'
import * as d3 from 'd3'
import type { BelongingMode, GraphData, TrustLink, TrustNode } from './types'
import { linkKey } from './normalizeGraphData'

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
// relationship state (decayTier). Derive a nominal weight from that state so edge width, opacity, and
// clustering still reflect bond strength. The inter-community depth graph still supplies real weights.
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
  /** community + ego share visuals (cluster color + amber your-edges); fission uses the split groups;
   *  communities renders communities-as-nodes (organic/fission lineage). */
  mode: BelongingMode
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

// communities-mode edge palette (HEB expression of the old CommunityDepthGraph scheme).
const ORGANIC_SLATE = '#64748b'
const FISSION_VIOLET = '#a78bfa'

const FADE_OPACITY = 0.15
const TRANSITION_MS = 400

// Greedy union-find clustering: merge nodes joined by the strongest 40% of edges.
function detectClusters(nodes: TrustNode[], links: TrustLink[]): Map<string, number> {
  const parent = new Map(nodes.map(n => [n.id, n.id]))
  const find = (x: string): string => {
    const p = parent.get(x)
    if (p === undefined || p === x) return x
    const root = find(p)
    parent.set(x, root)
    return root
  }
  const union = (a: string, b: string) => {
    if (parent.has(a) && parent.has(b)) parent.set(find(a), find(b))
  }

  ;[...links]
    .sort((a, b) => linkWeight(b) - linkWeight(a))
    .slice(0, Math.max(1, Math.floor(links.length * 0.4)))
    .forEach(l => union(l.source, l.target))

  const rootToCluster = new Map<string, number>()
  const result = new Map<string, number>()
  let nextId = 0
  nodes.forEach(n => {
    const root = find(n.id)
    if (!rootToCluster.has(root)) rootToCluster.set(root, nextId++)
    result.set(n.id, rootToCluster.get(root)!)
  })
  return result
}

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
  const containerRef = useRef<HTMLDivElement>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const [width, setWidth] = useState(700)
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [switching, setSwitching] = useState(false)

  useEffect(() => {
    if (!containerRef.current) return
    const el = containerRef.current
    const update = () => setWidth(el.clientWidth || 700)
    update()
    const observer = new ResizeObserver(update)
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  // Cluster assignment: fission uses the proposed groups, community detects clusters.
  const clusterOf = useMemo(() => {
    if (mode === 'fission') {
      const m = new Map<string, number>()
      graphData.nodes.forEach(n => {
        const g = groupMap?.[n.id]
        m.set(n.id, g === 'group_a' ? 0 : g === 'group_b' ? 1 : 2)
      })
      return m
    }
    return detectClusters(graphData.nodes, graphData.links)
  }, [graphData, groupMap, mode])

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

    const isMyEdge = (l: TrustLink) => l.source === currentUserId || l.target === currentUserId
    const sameCluster = (l: TrustLink) =>
      (clusterOf.get(l.source) ?? -1) === (clusterOf.get(l.target) ?? -2)

    const edgeColor = (l: TrustLink): string => {
      if (mode === 'communities') return l.type === 'fission' ? FISSION_VIOLET : ORGANIC_SLATE
      if (mode === 'fission') return sameCluster(l) ? '#22c55e' : '#ef4444'
      if (isMyEdge(l)) return '#fb923c'
      return sameCluster(l) ? '#6366f1' : '#94a3b8'
    }
    const edgeOpacity = (l: TrustLink): number => {
      if (mode === 'communities') return l.type === 'fission' ? 0.9 : 0.55
      const base = 0.12 + 0.7 * (linkWeight(l) / maxWeight)
      const decay = l.decayTier ? DECAY_OPACITY_FACTOR[l.decayTier] : 1
      if (mode === 'community' && isMyEdge(l)) return Math.max(0.7, base) * decay
      if (mode === 'community' && !sameCluster(l)) return Math.min(base, 0.3) * decay
      return base * decay
    }
    const edgeWidth = (l: TrustLink): number => {
      if (mode === 'communities') return l.type === 'fission' ? 2 : 1 + (linkWeight(l) / maxWeight) * 4
      return Math.max(0.6, Math.log1p(linkWeight(l)) * 1.2)
    }

    const nodeColor = (n: TrustNode): string => {
      if (mode === 'fission') {
        const grp = groupMap?.[n.id]
        if (grp === 'group_a') return '#3b82f6'
        if (grp === 'group_b') return '#f97316'
        return '#94a3b8'
      }
      if (mode === 'communities') return n.is_member ? '#10b981' : '#818cf8'
      if (n.isCurrentUser || n.id === currentUserId) return '#10b981'
      return '#818cf8'
    }
    const nodeRadius = (n: TrustNode) => (n.id === currentUserId ? CURRENT_USER_RADIUS : NODE_RADIUS)
    // Member emphasis (communities) and the "you" anchor are STROKE rings, not larger circles, so node
    // radius stays uniform (ADR-063).
    const ringed = (n: TrustNode) => n.id === currentUserId || (mode === 'communities' && !!n.is_member)

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

    // Fission-only: a dashed ring marks members with no trust connections yet (matches the legend's
    // "dashed = no connections"). Managed idempotently so keyed updates add/remove it as needed.
    nodeMerge.each(function (d: any) {
      const sel = d3.select(this)
      const showRing = mode === 'fission' && !!d.data.isIsolated && d.data.id !== currentUserId
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

    // ── pan/zoom (explorer-only) ─────────────────────────────────────────────────────────────────
    if (enableZoom) {
      const zoom = d3.zoom<SVGSVGElement, unknown>()
        .scaleExtent([0.5, 4])
        .on('zoom', (event) => root.attr('transform', event.transform.toString()))
      svg.call(zoom)
      // Seed the initial centered transform directly on the node (rather than zoom.transform, which
      // computes the SVG extent via width.baseVal — unsupported in jsdom). Gestures resume from here.
      const initial = d3.zoomIdentity.translate(cx, cy)
      ;(svgRef.current as any).__zoom = initial
      root.attr('transform', initial.toString())
    } else {
      svg.on('.zoom', null)
      root.attr('transform', `translate(${cx},${cy})`)
    }
  }, [graphData, clusterOf, mode, groupMap, currentUserId, width, height, maxWeight, enableZoom, focusedNodeId, onNodeActivate])

  // Remove the zoom listener on unmount.
  useEffect(() => {
    const node = svgRef.current
    return () => {
      if (node) d3.select(node).on('.zoom', null)
    }
  }, [])

  const selectedNode = selectedNodeId
    ? graphData.nodes.find(n => n.id === selectedNodeId)
    : null
  const connectionCount = (id: string) =>
    graphData.links.filter(l => l.source === id || l.target === id).length

  if (mode === 'community' && graphData.links.length === 0 && graphData.nodes.length <= 1) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-2 text-center">
        <p className="text-text-muted text-sm">This community doesn&apos;t have any trust connections yet.</p>
        <p className="text-text-muted text-xs">Connections appear as members complete help exchanges.</p>
      </div>
    )
  }

  if (mode === 'ego' && graphData.links.length === 0 && graphData.nodes.length <= 1) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-2 text-center">
        <p className="text-text-muted text-sm">You don&apos;t have any trust connections yet.</p>
        <p className="text-text-muted text-xs">Connections appear as you complete help exchanges with others.</p>
      </div>
    )
  }

  if (mode === 'communities' && graphData.nodes.length < 2) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-2 text-center">
        <p className="text-text-muted text-sm">Join more communities to see how they connect.</p>
        <p className="text-text-muted text-xs">Communities link through shared trust and fission lineage.</p>
      </div>
    )
  }

  return (
    <div ref={containerRef}>
      <svg ref={svgRef} width={width} height={height} style={{ maxWidth: '100%' }} />

      {/* Legend */}
      {mode === 'fission' ? (
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
      ) : mode === 'communities' ? (
        <div className="flex flex-wrap gap-4 text-xs text-text-muted mt-2 px-1">
          <span className="flex items-center gap-1">
            <span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-500" /> Your community
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block w-2.5 h-2.5 rounded-full bg-indigo-400" /> Connected community
          </span>
          <span className="flex items-center gap-1 text-slate-500">— organic trust</span>
          <span className="flex items-center gap-1 text-violet-400">— fission lineage</span>
        </div>
      ) : (
        <div className="flex flex-wrap gap-4 text-xs text-text-muted mt-2 px-1">
          <span className="flex items-center gap-1">
            <span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-500" /> You
          </span>
          <span className="flex items-center gap-1 text-orange-500">— your connections</span>
          <span className="flex items-center gap-1 text-indigo-500">— close-knit group</span>
          <span className="flex items-center gap-1 text-slate-400">— bridge between groups</span>
        </div>
      )}

      {selectedNode && (
        <div className="mt-3 p-4 bg-surface rounded-lg border border-border text-sm">
          <div className="font-semibold text-text mb-2">{selectedNode.name}</div>
          {mode === 'fission' ? (
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
          ) : mode === 'communities' ? (
            <div className="grid grid-cols-2 gap-2 text-text-muted">
              <span>Members</span>
              <span className="text-text">{selectedNode.member_count ?? 0}</span>
              <span>Status</span>
              <span className="text-text">{selectedNode.status ?? 'unknown'}</span>
              {selectedNode.is_member && (
                <span className="col-span-2 text-emerald-500">You&apos;re a member</span>
              )}
            </div>
          ) : (
            // Sprint 112 (ADR-082): the graph shows relationship STRUCTURE, not reputation. No node
            // (not even the caller's) exposes trust score or karma here — exact self metrics live only
            // in the canonical reputation summary. Node detail shows structural context only.
            <div className="grid grid-cols-2 gap-2 text-text-muted">
              {selectedNode.id === currentUserId && (
                <span className="col-span-2 text-indigo-500">This is you</span>
              )}
              {selectedNode.degrees_of_separation != null && selectedNode.id !== currentUserId && (
                <>
                  <span>Degrees away</span>
                  <span className="text-text">{selectedNode.degrees_of_separation}</span>
                </>
              )}
              <span>Connections</span>
              <span className="text-text">{connectionCount(selectedNode.id)}</span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
