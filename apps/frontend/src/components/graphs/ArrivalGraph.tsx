import { useMemo } from 'react'
import { useGraphContainerWidth } from '../../hooks/useGraphContainerWidth'
import { buildCommunityRingModel } from './communityRingModel'
import { NEW_BOND_COLOR, PERSON_COLORS, edgeVisual } from './graphVisualEncoding'
import type { GraphData, TrustNode } from './types'

interface ArrivalGraphProps {
  /** The joined community's disclosed member graph (nodes required; links may be empty). */
  graphData: GraphData
  currentUserId: string
  /** Invite path only: the invitation bond's other end. Provenance, NOT a trust edge. */
  inviter?: { id?: string; name: string }
  height?: number
}

const NODE_RADIUS = 6
const SELF_RADIUS = 9
// Keep the first ring readable: you + your inviter always survive the cap.
const MAX_RING_NODES = 24

/**
 * Sprint 118 (ADR-085) — the purpose-built arrival presentation. Reuses the community ring
 * primitives but is NEVER gated on edge count: a zero-trust-edge arrival (you among your new
 * neighbours on the ring) is the intended picture, not an empty state. The invitation bond is
 * drawn from funnel context as a visually distinct chord (dashed, new-bond hue) — it is
 * provenance that BECOMES trust through exchanges, never a trust edge itself.
 */
export default function ArrivalGraph({
  graphData,
  currentUserId,
  inviter,
  height = 420,
}: ArrivalGraphProps) {
  const { containerRef, width } = useGraphContainerWidth()

  const ringGraph = useMemo(() => {
    const seen = new Set<string>()
    const nodes: TrustNode[] = []
    for (const node of graphData.nodes) {
      if (!seen.has(node.id)) {
        seen.add(node.id)
        nodes.push(node)
      }
    }
    // The funnel context may know the inviter (and self) before the graph fetch does — make sure
    // the bond always has ring nodes to land on.
    if (inviter?.id && !seen.has(inviter.id)) {
      seen.add(inviter.id)
      nodes.push({ id: inviter.id, name: inviter.name })
    }
    if (currentUserId && !seen.has(currentUserId)) {
      nodes.push({ id: currentUserId, name: 'You', isCurrentUser: true })
    }
    if (nodes.length <= MAX_RING_NODES) return { nodes, links: graphData.links }
    const keep = nodes.filter(n => n.id === currentUserId || n.id === inviter?.id)
    const rest = nodes.filter(n => n.id !== currentUserId && n.id !== inviter?.id)
    const kept = [...keep, ...rest.slice(0, MAX_RING_NODES - keep.length)]
    const keptIds = new Set(kept.map(n => n.id))
    return {
      nodes: kept,
      links: graphData.links.filter(l => keptIds.has(l.source) && keptIds.has(l.target)),
    }
  }, [graphData.nodes, graphData.links, currentUserId, inviter?.id, inviter?.name])

  const model = useMemo(
    () => buildCommunityRingModel(ringGraph, width, height),
    [ringGraph, width, height]
  )

  const self = model.nodes.find(node => node.id === currentUserId)
  const inviterNode = inviter?.id ? model.nodes.find(node => node.id === inviter.id) : undefined

  return (
    <div ref={containerRef} className="relative" data-testid="arrival-graph">
      <svg
        width={width}
        height={height}
        viewBox={`${-width / 2} ${-height / 2} ${width} ${height}`}
        style={{ maxWidth: '100%' }}
        aria-label="Your first belonging graph"
      >
        {/* the community ring guide */}
        <circle
          cx={0}
          cy={0}
          r={model.radius}
          fill="none"
          stroke={PERSON_COLORS.ordinaryNode}
          strokeOpacity={0.18}
        />

        {/* disclosed trust links between neighbours (may legitimately be none) */}
        <g fill="none" aria-label="Existing bonds in this community">
          {model.links.map(item => {
            const visual = edgeVisual(item.link, currentUserId)
            return (
              <path
                key={item.key}
                d={item.path}
                stroke={visual.stroke}
                strokeWidth={visual.width}
                strokeOpacity={visual.opacity}
              >
                <title>{visual.label}</title>
              </path>
            )
          })}
        </g>

        {/* the invitation bond — provenance, rendered distinctly from every trust edge */}
        {self && inviterNode && (
          <line
            data-invitation-bond
            x1={self.x}
            y1={self.y}
            x2={inviterNode.x}
            y2={inviterNode.y}
            stroke={NEW_BOND_COLOR}
            strokeWidth={2.4}
            strokeDasharray="6 4"
            strokeOpacity={0.9}
          >
            <title>Your invitation bond — it becomes trust when you help each other</title>
          </line>
        )}

        <g aria-label="Your new neighbours">
          {model.nodes.map(node => {
            const isSelf = node.id === currentUserId
            const isInviter = inviter?.id != null && node.id === inviter.id
            return (
              <g key={node.id} data-node-id={node.id} transform={`translate(${node.x},${node.y})`}>
                <title>{isSelf ? 'You' : node.name}</title>
                <circle
                  r={isSelf ? SELF_RADIUS : NODE_RADIUS}
                  fill={isSelf ? PERSON_COLORS.callerNode : PERSON_COLORS.ordinaryNode}
                  stroke={isSelf || isInviter ? PERSON_COLORS.focusRing : 'none'}
                  strokeWidth={isSelf ? 2.5 : isInviter ? 2 : 0}
                />
                <text
                  className="node-label"
                  x={0}
                  y={isSelf ? -14 : -11}
                  textAnchor="middle"
                  fill="#cbd5e1"
                  fontSize={isSelf ? 13 : 11}
                  fontWeight={isSelf || isInviter ? 600 : 400}
                  style={{ pointerEvents: 'none' }}
                >
                  {isSelf ? 'You' : node.name}
                </text>
              </g>
            )
          })}
        </g>
      </svg>
    </div>
  )
}
