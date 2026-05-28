import { useEffect, useRef, useState, useMemo } from 'react'

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

interface TrustGraphProps {
  graphData: TrustGraphData
  currentUserId: string
  expandedNodes?: Set<string>
  expandingNodeId?: string | null
  onExpandNode?: (nodeId: string) => void
  groupMap?: Record<string, 'group_a' | 'group_b'>
  groupALabel?: string
  groupBLabel?: string
  onSwitchGroup?: (nodeId: string, currentGroup: 'group_a' | 'group_b' | null) => Promise<void>
}

export default function TrustGraph({
  graphData,
  currentUserId,
  expandedNodes = new Set(),
  expandingNodeId = null,
  onExpandNode,
  groupMap,
  groupALabel = 'Group A',
  groupBLabel = 'Group B',
  onSwitchGroup,
}: TrustGraphProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const fgRef = useRef<any>(null)
  const [ForceGraph, setForceGraph] = useState<any>(null)
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [switching, setSwitching] = useState(false)
  const [graphWidth, setGraphWidth] = useState(700)

  useEffect(() => {
    import('react-force-graph-2d').then(({ default: FG }) => {
      setForceGraph(() => FG)
    })
  }, [])

  useEffect(() => {
    if (!containerRef.current) return
    const el = containerRef.current
    const update = () => setGraphWidth(el.clientWidth || 700)
    update()
    const observer = new ResizeObserver(update)
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (!fgRef.current || !groupMap) return
    const fg = fgRef.current

    const xForce = (alpha: number) => {
      const data = fg.graphData()
      if (!data?.nodes) return
      data.nodes.forEach((node: any) => {
        const group = groupMap[node.id]
        const targetX = group === 'group_a'
          ? graphWidth * 0.28
          : group === 'group_b'
          ? graphWidth * 0.72
          : graphWidth * 0.5

        node.vx = (node.vx ?? 0) + (targetX - (node.x ?? 0)) * 0.4 * alpha
      })
    }

    fg.d3Force('x-group', xForce)
    fg.d3ReheatSimulation()
  }, [graphData, groupMap, graphWidth])

  const maxTrust = Math.max(...graphData.nodes.map(n => n.trust_score), 1)
  const maxWeight = Math.max(...graphData.links.map(l => l.effective_weight), 1)
  const nodeSize = (score: number) => 3 + (score / maxTrust) * 6
  const linkThickness = (w: number) => 1 + (w / maxWeight) * 3

  // Memoized so the force simulation doesn't restart on every parent re-render.
  // groupMap intentionally excluded — it only drives colors, not graph structure.
  const fgData = useMemo(() => ({
    nodes: graphData.nodes.map(n => ({
      ...n,
      ...(n.id === currentUserId ? { fx: 0, fy: 0 } : {}),
    })),
    links: graphData.links.map(l => ({ ...l })),
  }), [graphData, currentUserId])

  const selectedNode = selectedNodeId
    ? graphData.nodes.find(n => n.id === selectedNodeId)
    : null

  // Only used in non-groupMap mode for connection highlighting
  const connectedNodeIds = (!groupMap && selectedNodeId)
    ? new Set(
        graphData.links
          .filter(l => {
            const src = typeof l.source === 'object' ? (l.source as any).id : l.source
            const tgt = typeof l.target === 'object' ? (l.target as any).id : l.target
            return src === selectedNodeId || tgt === selectedNodeId
          })
          .flatMap(l => {
            const src = typeof l.source === 'object' ? (l.source as any).id : l.source
            const tgt = typeof l.target === 'object' ? (l.target as any).id : l.target
            return [src, tgt]
          })
      )
    : null

  const nodeColor = (node: any) => {
    if (groupMap) {
      // In fission mode: group color is always the signal, no dimming on selection
      const group = groupMap[node.id]
      if (group === 'group_a') return '#3b82f6'  // blue-500
      if (group === 'group_b') return '#f97316'  // orange-500
      return '#94a3b8'                            // unassigned
    }
    if (node.id === expandingNodeId) return '#f59e0b'
    if (selectedNodeId && !connectedNodeIds?.has(node.id)) return '#94a3b8'
    if (node.isCurrentUser || node.id === currentUserId) return '#10b981'
    if (!expandedNodes.has(node.id)) return '#818cf8'
    return '#6366f1'
  }

  if (!groupMap && graphData.links.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-2 text-center">
        <p className="text-text-muted text-sm">You don't have any direct trust connections in this community yet.</p>
        <p className="text-text-muted text-xs">Complete a help exchange with a member to appear on the graph.</p>
      </div>
    )
  }

  return (
    <div ref={containerRef}>
      {ForceGraph && (
        <ForceGraph
          ref={fgRef}
          graphData={fgData}
          width={graphWidth}
          height={groupMap ? 380 : 500}
          warmupTicks={120}
          cooldownTicks={50}
          // In fission mode: allow zoom/pan but not dragging individual nodes
          enableNodeDrag={!groupMap}
          nodeLabel={(node: any) => {
            if (groupMap) return node.isIsolated ? `${node.name} · no trust connections` : node.name
            const canExpand = onExpandNode && !expandedNodes.has(node.id) && node.id !== currentUserId
            return `${node.name}${canExpand ? ' · click to expand' : ''}`
          }}
          nodeVal={(node: any) => nodeSize(node.trust_score)}
          nodeColor={nodeColor}
          nodeCanvasObjectMode={() => 'after'}
          nodeCanvasObject={(node: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
            if (groupMap) {
              const r = Math.sqrt(nodeSize(node.trust_score || 1)) * 4 + 2
              // Amber ring on selected node
              if (node.id === selectedNodeId) {
                ctx.save()
                ctx.beginPath()
                ctx.arc(node.x, node.y, r + 3 / globalScale, 0, 2 * Math.PI)
                ctx.strokeStyle = '#fbbf24'
                ctx.lineWidth = 2.5 / globalScale
                ctx.stroke()
                ctx.restore()
              }
              if (node.id === currentUserId) {
                // White solid ring to identify current user within their group color
                ctx.save()
                ctx.beginPath()
                ctx.arc(node.x, node.y, r, 0, 2 * Math.PI)
                ctx.strokeStyle = 'white'
                ctx.lineWidth = 2 / globalScale
                ctx.stroke()
                ctx.restore()
              } else if (node.isIsolated) {
                // Dashed ring: "no trust connections in this community"
                const group = groupMap[node.id]
                ctx.save()
                ctx.beginPath()
                ctx.arc(node.x, node.y, r, 0, 2 * Math.PI)
                ctx.setLineDash([2, 2])
                ctx.strokeStyle = group === 'group_a'
                  ? 'rgba(59,130,246,0.45)'
                  : group === 'group_b'
                    ? 'rgba(249,115,22,0.45)'
                    : 'rgba(148,163,184,0.45)'
                ctx.lineWidth = 1 / globalScale
                ctx.stroke()
                ctx.restore()
              }
              return
            }
            // Non-fission: dashed ring on unexpanded nodes to signal they're expandable
            if (expandedNodes.has(node.id) || node.id === currentUserId) return
            const r = Math.sqrt(nodeSize(node.trust_score)) * 4 + 2
            ctx.save()
            ctx.beginPath()
            ctx.arc(node.x, node.y, r, 0, 2 * Math.PI)
            ctx.setLineDash([2, 2])
            ctx.strokeStyle = node.id === expandingNodeId ? '#f59e0b' : '#818cf8'
            ctx.lineWidth = 1 / globalScale
            ctx.stroke()
            ctx.restore()
          }}
          linkWidth={(link: any) => linkThickness(link.effective_weight)}
          linkDistance={80}
          linkColor={(link: any) => {
            const src = typeof link.source === 'object' ? link.source.id : link.source
            const tgt = typeof link.target === 'object' ? link.target.id : link.target
            if (groupMap) {
              // No selection-based dimming in fission mode — group color is always visible
              const srcGroup = groupMap[src]
              const tgtGroup = groupMap[tgt]
              if (srcGroup && tgtGroup && srcGroup === tgtGroup) {
                return srcGroup === 'group_a'
                  ? 'rgba(59,130,246,0.55)'   // within group A: blue
                  : 'rgba(249,115,22,0.55)'   // within group B: orange
              }
              return 'rgba(156,163,175,0.2)'  // cross-group: muted gray
            }
            const decayRatio = link.raw_weight > 0
              ? Math.min(1, link.effective_weight / link.raw_weight)
              : 1
            const baseOpacity = 0.2 + decayRatio * 0.8
            if (!selectedNodeId) return `rgba(99,102,241,${baseOpacity.toFixed(2)})`
            return src === selectedNodeId || tgt === selectedNodeId
              ? `rgba(99,102,241,${Math.min(1, baseOpacity + 0.3).toFixed(2)})`
              : `rgba(99,102,241,${(baseOpacity * 0.15).toFixed(2)})`
          }}
          onNodeClick={(node: any) => {
            setSelectedNodeId(prev => (prev === node.id ? null : node.id))
            if (!groupMap && onExpandNode && node.id !== currentUserId && !expandedNodes.has(node.id)) {
              onExpandNode(node.id)
            }
          }}
          onBackgroundClick={() => setSelectedNodeId(null)}
          backgroundColor="transparent"
        />
      )}

      {/* Legend */}
      {groupMap ? (
        <div className="flex flex-wrap gap-4 text-xs text-text-muted mt-2 px-1">
          <span className="flex items-center gap-1">
            <span className="inline-block w-2.5 h-2.5 rounded-full bg-blue-500" /> {groupALabel}
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block w-2.5 h-2.5 rounded-full bg-orange-500" /> {groupBLabel}
          </span>
          <span className="flex items-center gap-1 text-gray-400">— click a node to select · white ring = you · dashed = no connections</span>
        </div>
      ) : (
        <div className="flex gap-4 text-xs text-text-muted mt-2 px-1">
          <span className="flex items-center gap-1">
            <span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-500" /> You
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block w-2.5 h-2.5 rounded-full bg-indigo-500" /> Expanded
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block w-2.5 h-2.5 rounded-full bg-indigo-300" /> Click to expand
          </span>
        </div>
      )}

      {selectedNode && (
        <div className="mt-3 p-4 bg-surface rounded-lg border border-border text-sm">
          <div className="font-semibold text-text mb-2">{selectedNode.name}</div>
          {groupMap ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-text-muted">
                <span>Group</span>
                {groupMap[selectedNode.id] === 'group_a' ? (
                  <span className="font-medium text-blue-600">{groupALabel}</span>
                ) : groupMap[selectedNode.id] === 'group_b' ? (
                  <span className="font-medium text-orange-600">{groupBLabel}</span>
                ) : (
                  <span className="text-gray-400 italic">unassigned</span>
                )}
              </div>
              <div className="flex items-center justify-between text-text-muted">
                <span>Connections</span>
                {(selectedNode as any).isIsolated ? (
                  <span className="text-gray-400 italic">none yet</span>
                ) : (
                  <span className="text-text">
                    {graphData.links.filter(l => {
                      const src = typeof l.source === 'object' ? (l.source as any).id : l.source
                      const tgt = typeof l.target === 'object' ? (l.target as any).id : l.target
                      return src === selectedNode.id || tgt === selectedNode.id
                    }).length}
                  </span>
                )}
              </div>
              {onSwitchGroup && selectedNode.id !== currentUserId && groupMap[selectedNode.id] && (
                <button
                  disabled={switching}
                  onClick={async () => {
                    setSwitching(true)
                    try {
                      await onSwitchGroup(selectedNode.id, groupMap![selectedNode.id] ?? null)
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
              <span className="text-text">
                {graphData.links.filter(l => {
                  const src = typeof l.source === 'object' ? (l.source as any).id : l.source
                  const tgt = typeof l.target === 'object' ? (l.target as any).id : l.target
                  return src === selectedNode.id || tgt === selectedNode.id
                }).length}
              </span>
              {!expandedNodes.has(selectedNode.id) && selectedNode.id !== currentUserId && (
                <>
                  <span>Network</span>
                  <span className="text-indigo-400">loading…</span>
                </>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
