import { useEffect, useRef, useState } from 'react'

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

interface TrustGraphData {
  nodes: TrustNode[]
  links: TrustLink[]
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

  // Normalize to fixed visual ranges so raw score magnitude doesn't matter
  const maxTrust = Math.max(...graphData.nodes.map(n => n.trust_score), 1)
  const maxWeight = Math.max(...graphData.links.map(l => l.effective_weight), 1)
  const nodeSize = (score: number) => 3 + (score / maxTrust) * 6   // 3–9 px radius
  const linkThickness = (w: number) => 1 + (w / maxWeight) * 3     // 1–4 px width

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
          .filter(l => l.source === selectedNodeId || l.target === selectedNodeId)
          .flatMap(l => [l.source, l.target])
      )
    : null

  if (graphData.links.length === 0) {
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
          nodeLabel={(node: any) => node.name}
          nodeVal={(node: any) => nodeSize(node.trust_score)}
          nodeColor={(node: any) => {
            if (selectedNodeId && !connectedNodeIds?.has(node.id)) return '#94a3b8'
            if (node.isCurrentUser || node.id === currentUserId) return '#10b981'
            return '#6366f1'
          }}
          linkWidth={(link: any) => linkThickness(link.effective_weight)}
          linkDistance={80}
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
          cooldownTicks={100}
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
              {graphData.links.filter(l => l.source === selectedNode.id || l.target === selectedNode.id).length}
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
