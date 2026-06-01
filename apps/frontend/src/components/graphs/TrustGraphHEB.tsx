import { useEffect, useRef, useState, useMemo } from 'react'
import * as d3 from 'd3'

interface TrustNode {
  id: string
  name: string
  trust_score: number
  karma: number
  isCurrentUser?: boolean
  isIsolated?: boolean
}

interface TrustLink {
  source: string
  target: string
  raw_weight: number
  effective_weight: number
}

interface TrustGraphData {
  nodes: TrustNode[]
  links: TrustLink[]
}

interface TrustGraphHEBProps {
  graphData: TrustGraphData
  currentUserId: string
  /** community + ego share visuals (cluster color + amber your-edges); fission uses the split groups. */
  mode: 'community' | 'fission' | 'ego'
  groupMap?: Record<string, 'group_a' | 'group_b'>
  groupALabel?: string
  groupBLabel?: string
  onSwitchGroup?: (nodeId: string, currentGroup: 'group_a' | 'group_b' | null) => Promise<void>
  height?: number
}

// Uniform node sizing (ADR-063): every node is the same radius so the eye reads
// structure (clusters, ties) rather than mistaking dot size for importance. Only
// the current user is enlarged + white-ringed as a "you are here" anchor.
const NODE_RADIUS = 5
const CURRENT_USER_RADIUS = NODE_RADIUS + 3

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
    .sort((a, b) => b.effective_weight - a.effective_weight)
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

export default function TrustGraphHEB({
  graphData,
  currentUserId,
  mode,
  groupMap,
  groupALabel = 'Group A',
  groupBLabel = 'Group B',
  onSwitchGroup,
  height = 560,
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
    () => Math.max(...graphData.links.map(l => l.effective_weight), 1),
    [graphData.links]
  )

  useEffect(() => {
    if (!svgRef.current || graphData.nodes.length === 0) return

    const svg = d3.select(svgRef.current)
    svg.selectAll('*').remove()

    const radius = Math.max(60, Math.min(width, height) / 2 - 90)
    const g = svg.append('g').attr('transform', `translate(${width / 2},${height / 2})`)

    // Build root -> clusters -> nodes hierarchy, contiguous by cluster on the circle.
    const clusterIds = [...new Set(graphData.nodes.map(n => clusterOf.get(n.id) ?? 0))].sort((a, b) => a - b)
    const groups = clusterIds.map(cid => ({
      children: graphData.nodes.filter(n => (clusterOf.get(n.id) ?? 0) === cid),
    }))
    const root = d3.hierarchy<any>({ children: groups }, d => d.children)
    d3.cluster<any>().size([2 * Math.PI, radius])(root)

    const leaves = root.leaves()
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
      if (mode === 'fission') return sameCluster(l) ? '#22c55e' : '#ef4444'
      if (isMyEdge(l)) return '#fb923c'
      return sameCluster(l) ? '#6366f1' : '#94a3b8'
    }
    const edgeOpacity = (l: TrustLink): number => {
      const base = 0.12 + 0.7 * (l.effective_weight / maxWeight)
      if (mode === 'community' && isMyEdge(l)) return Math.max(0.7, base)
      if (mode === 'community' && !sameCluster(l)) return Math.min(base, 0.3)
      return base
    }

    // Resolve each link to its bundled hierarchical path; drop edges whose endpoints aren't present.
    const linkPaths = graphData.links
      .map(l => {
        const a = leafById.get(l.source)
        const b = leafById.get(l.target)
        return a && b ? { link: l, path: a.path(b) } : null
      })
      .filter((x): x is { link: TrustLink; path: d3.HierarchyPointNode<any>[] } => x !== null)
      // My edges last so amber renders on top.
      .sort((p, q) => Number(isMyEdge(p.link)) - Number(isMyEdge(q.link)))

    g.append('g')
      .attr('fill', 'none')
      .selectAll('path')
      .data(linkPaths)
      .join('path')
      .attr('d', d => line(d.path))
      .attr('stroke', d => edgeColor(d.link))
      .attr('stroke-opacity', d => edgeOpacity(d.link))
      .attr('stroke-width', d => Math.max(0.6, Math.log1p(d.link.effective_weight) * 1.2))

    const nodeColor = (n: TrustNode): string => {
      if (mode === 'fission') {
        const grp = groupMap?.[n.id]
        if (grp === 'group_a') return '#3b82f6'
        if (grp === 'group_b') return '#f97316'
        return '#94a3b8'
      }
      if (n.isCurrentUser || n.id === currentUserId) return '#10b981'
      return '#818cf8'
    }
    const nodeRadius = (n: TrustNode) =>
      n.id === currentUserId ? CURRENT_USER_RADIUS : NODE_RADIUS

    const node = g.append('g')
      .selectAll('g')
      .data(leaves)
      .join('g')
      .attr('transform', d => `rotate(${(d as any).x * 180 / Math.PI - 90}) translate(${(d as any).y},0)`)
      .style('cursor', 'pointer')
      .on('click', (_event, d) => {
        const id = d.data.id as string
        setSelectedNodeId(prev => (prev === id ? null : id))
      })

    node.append('circle')
      .attr('r', d => nodeRadius(d.data))
      .attr('fill', d => nodeColor(d.data))
      .attr('stroke', d => (d.data.id === currentUserId ? '#fff' : 'none'))
      .attr('stroke-width', d => (d.data.id === currentUserId ? 2 : 0))

    // Dashed ring marks members with no trust connections (fission view).
    node.filter(d => mode === 'fission' && !!d.data.isIsolated && d.data.id !== currentUserId)
      .append('circle')
      .attr('r', d => nodeRadius(d.data) + 3)
      .attr('fill', 'none')
      .attr('stroke', d => nodeColor(d.data))
      .attr('stroke-opacity', 0.5)
      .attr('stroke-dasharray', '2,2')

    node.append('text')
      .attr('dy', '0.31em')
      .attr('x', d => ((d as any).x < Math.PI ? 8 : -8))
      .attr('text-anchor', d => ((d as any).x < Math.PI ? 'start' : 'end'))
      .attr('transform', d => ((d as any).x >= Math.PI ? 'rotate(180)' : null))
      .attr('font-size', '9px')
      .attr('fill', '#94a3b8')
      .style('pointer-events', 'none')
      .text(d => (d.data.id === currentUserId ? `${d.data.name} (you)` : d.data.name))
  }, [graphData, clusterOf, mode, groupMap, currentUserId, width, height, maxWeight])

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
      ) : (
        <div className="flex flex-wrap gap-4 text-xs text-text-muted mt-2 px-1">
          <span className="flex items-center gap-1">
            <span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-500" /> You
          </span>
          <span className="flex items-center gap-1 text-orange-500">— your connections</span>
          <span className="flex items-center gap-1 text-indigo-500">— within-cluster</span>
          <span className="flex items-center gap-1 text-slate-400">— cross-cluster</span>
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
          ) : (
            <div className="grid grid-cols-2 gap-2 text-text-muted">
              <span>Trust score</span>
              <span className="text-text">{Number(selectedNode.trust_score).toFixed(1)}</span>
              <span>Karma</span>
              <span className="text-text">{selectedNode.karma}</span>
              <span>Connections</span>
              <span className="text-text">{connectionCount(selectedNode.id)}</span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
