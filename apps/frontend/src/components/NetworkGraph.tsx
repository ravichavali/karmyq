import { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import { socialGraphService } from '@/lib/api'

interface TrustNode {
  id: string
  name: string
  trust_score: number
  karma: number
  isCurrentUser?: boolean
}

interface TrustLink {
  source: string
  target: string
  raw_weight: number
  effective_weight: number
}

interface GraphData {
  nodes: TrustNode[]
  links: TrustLink[]
}

interface NetworkGraphProps {
  currentUserId: string
}

function mergeGraphData(existing: GraphData, incoming: GraphData): GraphData {
  const nodeMap = new Map(existing.nodes.map(n => [n.id, n]))
  const linkKeys = new Set(
    existing.links.map(l => {
      const src = typeof l.source === 'object' ? (l.source as any).id : l.source
      const tgt = typeof l.target === 'object' ? (l.target as any).id : l.target
      return [src, tgt].sort().join('|')
    })
  )

  for (const node of incoming.nodes) {
    if (!nodeMap.has(node.id)) nodeMap.set(node.id, node)
  }

  const mergedLinks = [...existing.links]
  for (const link of incoming.links) {
    const src = typeof link.source === 'object' ? (link.source as any).id : link.source
    const tgt = typeof link.target === 'object' ? (link.target as any).id : link.target
    const key = [src, tgt].sort().join('|')
    if (!linkKeys.has(key)) {
      mergedLinks.push(link)
      linkKeys.add(key)
    }
  }

  return { nodes: [...nodeMap.values()], links: mergedLinks }
}

// Cross-community aggregate ego-network. Force-directed (react-force-graph-2d);
// unchanged behaviour from the previous shared TrustGraph, now self-contained here.
export default function NetworkGraph({ currentUserId }: NetworkGraphProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const fgRef = useRef<any>(null)
  const [ForceGraph, setForceGraph] = useState<any>(null)
  const [graphData, setGraphData] = useState<GraphData | null>(null)
  const [loading, setLoading] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set())
  const [expandingNodeId, setExpandingNodeId] = useState<string | null>(null)
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [graphWidth, setGraphWidth] = useState(700)

  useEffect(() => {
    import('react-force-graph-2d').then(({ default: FG }) => setForceGraph(() => FG))
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

  const fetchInitial = useCallback(async () => {
    if (loaded) return
    setLoading(true)
    try {
      const resp = await socialGraphService.getTrustGraphAggregate()
      setGraphData(resp.data ?? null)
      setExpandedNodes(new Set([currentUserId]))
    } catch {
      setGraphData({ nodes: [], links: [] })
    } finally {
      setLoading(false)
      setLoaded(true)
    }
  }, [loaded, currentUserId])

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const observer = new IntersectionObserver(
      (entries) => { if (entries[0].isIntersecting) { fetchInitial(); observer.disconnect() } },
      { threshold: 0.1 }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [fetchInitial])

  const handleExpandNode = useCallback(async (nodeId: string) => {
    if (expandedNodes.has(nodeId) || expandingNodeId) return
    setExpandingNodeId(nodeId)
    try {
      const resp = await socialGraphService.getTrustGraphAggregate(nodeId)
      setGraphData(prev => prev ? mergeGraphData(prev, resp.data) : resp.data)
      setExpandedNodes(prev => new Set([...prev, nodeId]))
    } catch {
      // silently ignore — node stays unexpanded
    } finally {
      setExpandingNodeId(null)
    }
  }, [expandedNodes, expandingNodeId])

  const maxTrust = Math.max(...(graphData?.nodes.map(n => n.trust_score) ?? []), 1)
  const maxWeight = Math.max(...(graphData?.links.map(l => l.effective_weight) ?? []), 1)
  const nodeSize = (score: number) => 3 + (score / maxTrust) * 6
  const linkThickness = (w: number) => 1 + (w / maxWeight) * 3

  const fgData = useMemo(() => ({
    nodes: (graphData?.nodes ?? []).map(n => ({
      ...n,
      ...(n.id === currentUserId ? { fx: 0, fy: 0 } : {}),
    })),
    links: (graphData?.links ?? []).map(l => ({ ...l })),
  }), [graphData, currentUserId])

  const selectedNode = selectedNodeId
    ? graphData?.nodes.find(n => n.id === selectedNodeId)
    : null

  const connectedNodeIds = selectedNodeId
    ? new Set(
        (graphData?.links ?? [])
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
    if (node.id === expandingNodeId) return '#f59e0b'
    if (selectedNodeId && !connectedNodeIds?.has(node.id)) return '#94a3b8'
    if (node.isCurrentUser || node.id === currentUserId) return '#10b981'
    if (!expandedNodes.has(node.id)) return '#818cf8'
    return '#6366f1'
  }

  return (
    <div ref={containerRef} className="bg-surface-raised rounded-xl border border-border p-4 mb-6">
      <div className="flex items-start justify-between mb-3">
        <div>
          <h2 className="text-base font-semibold text-text">Your Network</h2>
          <p className="text-xs text-text-muted mt-0.5">
            Your direct connections across all communities. <span className="text-indigo-400">Click a neighbor</span> to expand.
          </p>
        </div>
        {expandingNodeId && <span className="text-xs text-text-muted mt-1">Expanding…</span>}
      </div>

      {loading && (
        <div className="flex items-center justify-center py-12 text-text-muted text-sm">
          Loading network…
        </div>
      )}

      {loaded && graphData && graphData.links.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12 gap-2 text-center">
          <p className="text-text-muted text-sm">You don&apos;t have any trust connections yet.</p>
          <p className="text-text-muted text-xs">Complete a help exchange with a member to appear here.</p>
        </div>
      )}

      {loaded && graphData && graphData.links.length > 0 && (
        <div className="w-full min-h-[600px] h-[calc(100vh-300px)]">
          {ForceGraph && (
            <ForceGraph
              ref={fgRef}
              graphData={fgData}
              width={graphWidth}
              height="100%"
              warmupTicks={120}
              cooldownTicks={50}
              nodeLabel={(node: any) => {
                const canExpand = !expandedNodes.has(node.id) && node.id !== currentUserId
                return `${node.name}${canExpand ? ' · click to expand' : ''}`
              }}
              nodeVal={(node: any) => nodeSize(node.trust_score)}
              nodeColor={nodeColor}
              nodeCanvasObjectMode={() => 'after'}
              nodeCanvasObject={(node: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
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
                if (node.id !== currentUserId && !expandedNodes.has(node.id)) {
                  handleExpandNode(node.id)
                }
              }}
              onBackgroundClick={() => setSelectedNodeId(null)}
              backgroundColor="transparent"
            />
          )}

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

          {selectedNode && (
            <div className="mt-3 p-4 bg-surface rounded-lg border border-border text-sm">
              <div className="font-semibold text-text mb-2">{selectedNode.name}</div>
              <div className="grid grid-cols-2 gap-2 text-text-muted">
                <span>Trust score</span>
                <span className="text-text">{Number(selectedNode.trust_score).toFixed(1)}</span>
                <span>Karma</span>
                <span className="text-text">{selectedNode.karma}</span>
                <span>Connections</span>
                <span className="text-text">
                  {(graphData.links).filter(l => {
                    const src = typeof l.source === 'object' ? (l.source as any).id : l.source
                    const tgt = typeof l.target === 'object' ? (l.target as any).id : l.target
                    return src === selectedNode.id || tgt === selectedNode.id
                  }).length}
                </span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
