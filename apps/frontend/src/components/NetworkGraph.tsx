import { useEffect, useRef, useState, useCallback } from 'react'
import { socialGraphService } from '@/lib/api'
import TrustGraph from '@/components/TrustGraph'

interface TrustNode {
  id: string
  name: string
  trust_score: number
  karma: number
  isCurrentUser: boolean
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

export default function NetworkGraph({ currentUserId }: NetworkGraphProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [graphData, setGraphData] = useState<GraphData | null>(null)
  const [loading, setLoading] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set())
  const [expandingNodeId, setExpandingNodeId] = useState<string | null>(null)

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

      {loaded && graphData && (
        <TrustGraph
          graphData={graphData}
          currentUserId={currentUserId}
          expandedNodes={expandedNodes}
          expandingNodeId={expandingNodeId}
          onExpandNode={handleExpandNode}
        />
      )}
    </div>
  )
}
