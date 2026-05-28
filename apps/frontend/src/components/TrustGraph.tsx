import { useEffect, useRef, useState } from 'react'

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
}: TrustGraphProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [ForceGraph, setForceGraph] = useState<any>(null)
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)

  useEffect(() => {
    import('react-force-graph-2d').then(({ default: FG }) => {
      setForceGraph(() => FG)
    })
  }, [])

  const maxTrust = Math.max(...graphData.nodes.map(n => n.trust_score), 1)
  const maxWeight = Math.max(...graphData.links.map(l => l.effective_weight), 1)
  const nodeSize = (score: number) => 3 + (score / maxTrust) * 6
  const linkThickness = (w: number) => 1 + (w / maxWeight) * 3

  const fgData = {
    nodes: graphData.nodes.map(n => ({ ...n })),
    links: graphData.links.map(l => ({ ...l })),
  }

  const selectedNode = selectedNodeId
    ? graphData.nodes.find(n => n.id === selectedNodeId)
    : null

  const connectedNodeIds = selectedNodeId
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
      if (selectedNodeId && !connectedNodeIds?.has(node.id)) return '#94a3b8'
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
          graphData={fgData}
          width={700}
          height={500}
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
              if (node.id === currentUserId) {
                // White solid ring to identify the current user within their group color
                ctx.save()
                ctx.beginPath()
                ctx.arc(node.x, node.y, r, 0, 2 * Math.PI)
                ctx.strokeStyle = 'white'
                ctx.lineWidth = 2 / globalScale
                ctx.stroke()
                ctx.restore()
              } else if (node.isIsolated) {
                // Dashed ring to signal "no trust connections in this community"
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
            // Draw a dashed ring on unexpanded non-self nodes to signal they're expandable
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
              if (selectedNodeId && src !== selectedNodeId && tgt !== selectedNodeId) {
                return 'rgba(156,163,175,0.08)'
              }
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
            if (onExpandNode && node.id !== currentUserId && !expandedNodes.has(node.id)) {
              onExpandNode(node.id)
            }
          }}
          onBackgroundClick={() => setSelectedNodeId(null)}
          backgroundColor="transparent"
          cooldownTicks={100}
        />
      )}

      {/* Legend */}
      {groupMap ? (
        <div className="flex gap-4 text-xs text-text-muted mt-2 px-1">
          <span className="flex items-center gap-1">
            <span className="inline-block w-2.5 h-2.5 rounded-full bg-blue-500" /> {groupALabel}
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block w-2.5 h-2.5 rounded-full bg-orange-500" /> {groupBLabel}
          </span>
          <span className="flex items-center gap-1 text-gray-400">— white ring = you · dashed ring = no connections</span>
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
        <div className="mt-4 p-4 bg-surface rounded-lg border border-border text-sm">
          <div className="font-semibold text-text mb-2">{selectedNode.name}</div>
          <div className="grid grid-cols-2 gap-2 text-text-muted">
            <span>Trust score</span>
            <span className="text-text">{Number(selectedNode.trust_score).toFixed(1)}</span>
            <span>Karma</span>
            <span className="text-text">{selectedNode.karma}</span>
            <span>Connections</span>
            <span className="text-text">
              {(selectedNode as any).isIsolated ? (
                <span className="text-gray-400 italic">none yet</span>
              ) : (
                graphData.links.filter(l => {
                  const src = typeof l.source === 'object' ? (l.source as any).id : l.source
                  const tgt = typeof l.target === 'object' ? (l.target as any).id : l.target
                  return src === selectedNode.id || tgt === selectedNode.id
                }).length
              )}
            </span>
            {!groupMap && !expandedNodes.has(selectedNode.id) && selectedNode.id !== currentUserId && (
              <>
                <span>Network</span>
                <span className="text-indigo-400">loading…</span>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
