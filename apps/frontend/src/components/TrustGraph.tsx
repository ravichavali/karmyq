import TrustGraphHEB from './graphs/TrustGraphHEB'

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
  /** All modes render via hierarchical edge bundling (D3 HEB). ego/community share
   *  cluster visuals + amber your-edges; fission colors by the proposed split groups. */
  mode?: 'ego' | 'community' | 'fission'
  // Fission props (forwarded to HEB)
  groupMap?: Record<string, 'group_a' | 'group_b'>
  groupALabel?: string
  groupBLabel?: string
  onSwitchGroup?: (nodeId: string, currentGroup: 'group_a' | 'group_b' | null) => Promise<void>
  height?: number
}

export default function TrustGraph(props: TrustGraphProps) {
  // Default keeps older callers working: a groupMap means fission, otherwise ego.
  const mode = props.mode ?? (props.groupMap ? 'fission' : 'ego')

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
