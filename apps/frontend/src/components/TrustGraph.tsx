import dynamic from 'next/dynamic'
import TrustGraphHEB from './graphs/TrustGraphHEB'

// Cytoscape can't be server-rendered — load the radial view client-side only.
const TrustGraphRadial = dynamic(() => import('./graphs/TrustGraphRadial'), { ssr: false })

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
  /** ego = radial (Cytoscape), community/fission = hierarchical edge bundling (D3). */
  mode?: 'ego' | 'community' | 'fission'
  // Fission props (forwarded to HEB)
  groupMap?: Record<string, 'group_a' | 'group_b'>
  groupALabel?: string
  groupBLabel?: string
  onSwitchGroup?: (nodeId: string, currentGroup: 'group_a' | 'group_b' | null) => Promise<void>
  // Ego props (forwarded to Radial)
  onNodeClick?: (nodeId: string) => void
  height?: number
}

export default function TrustGraph(props: TrustGraphProps) {
  // Default keeps older callers working: a groupMap means fission, otherwise ego.
  const mode = props.mode ?? (props.groupMap ? 'fission' : 'ego')

  if (mode === 'ego') {
    return (
      <TrustGraphRadial
        graphData={props.graphData}
        currentUserId={props.currentUserId}
        onNodeClick={props.onNodeClick}
        height={props.height}
      />
    )
  }

  return (
    <TrustGraphHEB
      graphData={props.graphData}
      currentUserId={props.currentUserId}
      mode={mode}
      groupMap={props.groupMap}
      groupALabel={props.groupALabel}
      groupBLabel={props.groupBLabel}
      onSwitchGroup={props.onSwitchGroup}
      height={props.height}
    />
  )
}
