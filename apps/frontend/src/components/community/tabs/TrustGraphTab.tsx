import { useEffect, useState, useCallback } from 'react'
import { socialGraphService } from '@/lib/api'
import TrustGraph from '@/components/TrustGraph'

interface TrustGraphTabProps {
  communityId: string
  currentUserId: string
}

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
  effective_weight: number
}

interface GraphData {
  nodes: TrustNode[]
  links: TrustLink[]
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

export default function TrustGraphTab({ communityId, currentUserId }: TrustGraphTabProps) {
  const [graphData, setGraphData] = useState<GraphData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set())
  const [expandingNodeId, setExpandingNodeId] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    setError(null)
    socialGraphService.getTrustGraph(communityId)
      .then((res: any) => {
        setGraphData(res.data)
        setExpandedNodes(new Set([currentUserId]))
      })
      .catch(() => setError('Failed to load trust graph.'))
      .finally(() => setLoading(false))
  }, [communityId, currentUserId])

  const handleExpandNode = useCallback(async (nodeId: string) => {
    if (expandedNodes.has(nodeId) || expandingNodeId) return
    setExpandingNodeId(nodeId)
    try {
      const res: any = await socialGraphService.getTrustGraph(communityId, nodeId)
      setGraphData(prev => prev ? mergeGraphData(prev, res.data) : res.data)
      setExpandedNodes(prev => new Set([...prev, nodeId]))
    } catch {
      // silently ignore — node stays unexpanded
    } finally {
      setExpandingNodeId(null)
    }
  }, [communityId, expandedNodes, expandingNodeId])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-text-muted text-sm">
        Loading trust graph…
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center py-16 text-red-500 text-sm">
        {error}
      </div>
    )
  }

  if (!graphData) return null

  return (
    <div>
      <div className="mb-4 flex items-start justify-between">
        <div>
          <h3 className="text-base font-semibold text-text">Your Trust Neighborhood</h3>
          <p className="text-sm text-text-muted mt-1">
            Shows your direct connections. <span className="text-indigo-400">Click a neighbor</span> to expand their network.
          </p>
        </div>
        {expandingNodeId && (
          <span className="text-xs text-text-muted mt-1">Expanding…</span>
        )}
      </div>
      <TrustGraph
        graphData={graphData}
        currentUserId={currentUserId}
        expandedNodes={expandedNodes}
        expandingNodeId={expandingNodeId}
        onExpandNode={handleExpandNode}
      />
    </div>
  )
}
