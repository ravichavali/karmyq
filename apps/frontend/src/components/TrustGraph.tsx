import { useEffect, useRef, useState } from 'react'

interface TrustNode {
  id: string
  name: string
  trust_score: number
  karma: number
}

interface TrustEdge {
  source: string
  target: string
  raw_weight: number
  effective_weight: number
  match_completed_count: number
  endorsement_count: number
  karma_given_count: number
  event_count: number
  last_interaction_at: string
}

interface TrustGraphData {
  nodes: TrustNode[]
  edges: TrustEdge[]
}

interface TrustGraphProps {
  graphData: TrustGraphData
  currentUserId: string
}

export default function TrustGraph({ graphData, currentUserId }: TrustGraphProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [ForceGraph, setForceGraph] = useState<any>(null)
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)

  useEffect(() => {
    import('react-force-graph-2d').then(({ default: FG }) => {
      setForceGraph(() => FG)
    })
  }, [])

  const fgData = {
    nodes: graphData.nodes.map(n => ({ ...n })),
    links: graphData.edges.map(e => ({ ...e })),
  }

  const selectedNode = selectedNodeId
    ? graphData.nodes.find(n => n.id === selectedNodeId)
    : null

  const connectedNodeIds = selectedNodeId
    ? new Set(
        graphData.edges
          .filter(e => e.source === selectedNodeId || e.target === selectedNodeId)
          .flatMap(e => [e.source, e.target])
      )
    : null

  if (graphData.edges.length === 0) {
    return (
      <div className="flex items-center justify-center py-16 text-text-muted text-sm">
        No trust connections yet — complete help exchanges to build the graph.
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
          nodeLabel={(node: any) => node.name}
          nodeVal={(node: any) => Math.max(5, node.trust_score / 10)}
          nodeColor={(node: any) => {
            if (selectedNodeId && !connectedNodeIds?.has(node.id)) return '#94a3b8'
            if (node.id === currentUserId) return '#10b981'
            return '#6366f1'
          }}
          linkWidth={(link: any) => Math.max(1, link.effective_weight / 5)}
          linkColor={(link: any) => {
            if (!selectedNodeId) return 'rgba(99,102,241,0.4)'
            const src = typeof link.source === 'object' ? link.source.id : link.source
            const tgt = typeof link.target === 'object' ? link.target.id : link.target
            return src === selectedNodeId || tgt === selectedNodeId
              ? 'rgba(99,102,241,0.9)'
              : 'rgba(99,102,241,0.1)'
          }}
          onNodeClick={(node: any) => {
            setSelectedNodeId(prev => (prev === node.id ? null : node.id))
          }}
          onBackgroundClick={() => setSelectedNodeId(null)}
          backgroundColor="transparent"
        />
      )}

      {selectedNode && (
        <div className="mt-4 p-4 bg-surface rounded-lg border border-border text-sm">
          <div className="font-semibold text-text mb-2">{selectedNode.name}</div>
          <div className="grid grid-cols-2 gap-2 text-text-muted">
            <span>Trust score</span><span className="text-text">{selectedNode.trust_score.toFixed(1)}</span>
            <span>Karma</span><span className="text-text">{selectedNode.karma}</span>
            <span>Connections</span>
            <span className="text-text">
              {graphData.edges.filter(e => e.source === selectedNode.id || e.target === selectedNode.id).length}
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
