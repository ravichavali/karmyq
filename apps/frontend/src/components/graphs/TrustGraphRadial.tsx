import { useMemo } from 'react'
import CytoscapeComponent from 'react-cytoscapejs'
import type cytoscape from 'cytoscape'

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

interface TrustGraphData {
  nodes: TrustNode[]
  links: TrustLink[]
}

interface TrustGraphRadialProps {
  graphData: TrustGraphData
  currentUserId: string
  onNodeClick?: (nodeId: string) => void
  height?: number
}

export default function TrustGraphRadial({
  graphData,
  currentUserId,
  onNodeClick,
  height = 560,
}: TrustGraphRadialProps) {
  const maxScore = useMemo(
    () => Math.max(...graphData.nodes.map(n => n.trust_score), 1),
    [graphData.nodes]
  )
  const maxWeight = useMemo(
    () => Math.max(...graphData.links.map(l => l.effective_weight), 1),
    [graphData.links]
  )

  const elements = useMemo<cytoscape.ElementDefinition[]>(() => {
    const nodeIds = new Set(graphData.nodes.map(n => n.id))
    return [
      ...graphData.nodes.map(n => ({
        data: {
          id: n.id,
          label: n.id === currentUserId ? `${n.name} (you)` : n.name,
          trust_score: n.trust_score,
          isCurrentUser: n.isCurrentUser || n.id === currentUserId ? 1 : 0,
        },
      })),
      // Guard against edges referencing a node that isn't in the set.
      ...graphData.links
        .filter(l => nodeIds.has(l.source) && nodeIds.has(l.target))
        .map(l => ({
          data: {
            id: `${l.source}__${l.target}`,
            source: l.source,
            target: l.target,
            effective_weight: l.effective_weight,
          },
        })),
    ]
  }, [graphData, currentUserId])

  // mapData(...) expressions are valid Cytoscape style syntax but not in the strict TS types.
  const stylesheet = useMemo<any[]>(() => [
    {
      selector: 'node',
      style: {
        'background-color': '#64748b',
        'width': `mapData(trust_score, 0, ${maxScore}, 16, 32)`,
        'height': `mapData(trust_score, 0, ${maxScore}, 16, 32)`,
        'label': 'data(label)',
        'font-size': '10px',
        'color': '#e2e8f0',
        'text-valign': 'bottom',
        'text-margin-y': 4,
      },
    },
    {
      selector: 'node[isCurrentUser = 1]',
      style: {
        'background-color': '#6366f1',
        'width': 36,
        'height': 36,
        'font-size': '11px',
        'font-weight': 'bold',
      },
    },
    {
      selector: 'edge',
      style: {
        'line-color': '#94a3b8',
        'width': `mapData(effective_weight, 0, ${maxWeight}, 1, 5)`,
        'opacity': `mapData(effective_weight, 0, ${maxWeight}, 0.2, 0.85)`,
        'curve-style': 'bezier',
      },
    },
    {
      selector: 'edge.my-edge',
      style: { 'line-color': '#fb923c', 'opacity': 0.85 },
    },
  ], [maxScore, maxWeight])

  const layout = useMemo(() => ({
    name: 'concentric',
    concentric: (node: cytoscape.NodeSingular) =>
      node.data('isCurrentUser') ? 1000 : node.data('trust_score') + 1,
    levelWidth: () => 3,
    minNodeSpacing: 30,
    animate: true,
    animationDuration: 400,
  }), [])

  if (graphData.nodes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-2 text-center">
        <p className="text-text-muted text-sm">You don&apos;t have any trust connections in this community yet.</p>
        <p className="text-text-muted text-xs">Complete a help exchange with a member to appear on the graph.</p>
      </div>
    )
  }

  return (
    <div>
      <CytoscapeComponent
        elements={elements}
        stylesheet={stylesheet}
        layout={layout}
        style={{ width: '100%', height }}
        cy={(cy: cytoscape.Core) => {
          cy.edges().forEach(e => {
            if (e.source().id() === currentUserId || e.target().id() === currentUserId) {
              e.addClass('my-edge')
            }
          })
          cy.off('tap', 'node')
          if (onNodeClick) {
            cy.on('tap', 'node', evt => onNodeClick(evt.target.id()))
          }
        }}
      />
      <div className="flex flex-wrap gap-4 text-xs text-text-muted mt-2 px-1">
        <span className="flex items-center gap-1">
          <span className="inline-block w-2.5 h-2.5 rounded-full bg-indigo-500" /> You (center)
        </span>
        <span className="flex items-center gap-1 text-orange-500">— your direct connections</span>
        <span className="text-gray-400">rings = trust distance · thicker = stronger</span>
      </div>
    </div>
  )
}
