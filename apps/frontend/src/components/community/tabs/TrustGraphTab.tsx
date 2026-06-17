import { useEffect, useState, useCallback } from 'react'
import { socialGraphService } from '@/lib/api'
import TrustGraph from '@/components/TrustGraph'
import ReWarmingNudge from '@/components/relationships/ReWarmingNudge'

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
  raw_weight: number
  effective_weight: number
  decayTier?: 'strong' | 'warm' | 'fading' | 'nearly_forgotten' | 'swept' // Sprint 90 / ADR-070
}

interface GraphData {
  nodes: TrustNode[]
  links: TrustLink[]
}

type SubTab = 'community' | 'ego'

/**
 * Sprint 102 / ADR-070 — explain why some lines look softer, so fading is text-legible (not just
 * lower opacity) and "nearly forgotten" reads as a gentle, optional state rather than a warning.
 */
function MemoryLegend() {
  return (
    <section className="kq-action-band mb-4" aria-label="How memory fades">
      <p className="kq-section-label !mt-0">How memory fades</p>
      <div className="grid gap-2 text-sm text-text-muted md:grid-cols-3">
        <div>
          <span className="font-semibold text-text">Strong and warm bonds</span>
          <p>Recent or well-tended relationships stay vivid.</p>
        </div>
        <div>
          <span className="font-semibold text-text">Fading bonds</span>
          <p>Quiet relationships look softer so the graph reflects what is alive now.</p>
        </div>
        <div>
          <span className="font-semibold text-text">Nearly forgotten bonds</span>
          <p>Helping each other again keeps them alive, or you can let them fade from active memory.</p>
        </div>
      </div>
    </section>
  )
}

export default function TrustGraphTab({ communityId, currentUserId }: TrustGraphTabProps) {
  const [subTab, setSubTab] = useState<SubTab>('community')
  const [communityGraph, setCommunityGraph] = useState<GraphData | null>(null)
  const [egoGraph, setEgoGraph] = useState<GraphData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Fetch the full community graph once.
  useEffect(() => {
    setLoading(true)
    setError(null)
    socialGraphService.getFullCommunityGraph(communityId)
      .then((res: any) => setCommunityGraph(res.data))
      .catch(() => setError('Failed to load community graph.'))
      .finally(() => setLoading(false))
  }, [communityId])

  // Fetch the ego graph (the calling user's first-degree network in this community).
  const loadEgo = useCallback(() => {
    setLoading(true)
    setError(null)
    socialGraphService.getTrustGraph(communityId)
      .then((res: any) => setEgoGraph(res.data))
      .catch(() => setError('Failed to load your network.'))
      .finally(() => setLoading(false))
  }, [communityId])

  useEffect(() => {
    if (subTab === 'ego' && !egoGraph) loadEgo()
  }, [subTab, egoGraph, loadEgo])

  const tabClass = (active: boolean) =>
    `px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
      active ? 'bg-indigo-600 text-white' : 'bg-surface text-text-muted hover:text-text'
    }`

  return (
    <div>
      <div className="mb-4">
        <h3 className="text-base font-semibold text-text">Trust Graph</h3>
        <p className="text-sm text-text-muted mt-1">
          {subTab === 'community'
            ? 'Every member, grouped by how closely they connect. Amber lines are your connections.'
            : 'Your first-degree network, clustered by how closely your connections connect to each other. Amber lines are yours.'}
        </p>
      </div>

      <div className="flex gap-2 mb-3">
        <button onClick={() => setSubTab('community')} className={tabClass(subTab === 'community')}>
          Community
        </button>
        <button onClick={() => setSubTab('ego')} className={tabClass(subTab === 'ego')}>
          My Network
        </button>
      </div>

      {/* Sprint 102 / ADR-070 — explain fading before the graph, then the gentle re-warm nudge. */}
      <MemoryLegend />

      {/* Sprint 90 / ADR-070 — re-warm bonds about to be swept. Self-suppresses when none. */}
      <ReWarmingNudge communityId={communityId} className="mb-4" />

      <div className="w-full min-h-[600px] h-[calc(100vh-320px)]">
        {error ? (
          <div className="flex items-center justify-center py-16 text-red-500 text-sm">{error}</div>
        ) : loading && (subTab === 'community' ? !communityGraph : !egoGraph) ? (
          <div className="flex items-center justify-center py-16 text-text-muted text-sm">
            Loading trust graph…
          </div>
        ) : subTab === 'community' ? (
          communityGraph && (
            <TrustGraph
              mode="community"
              graphData={communityGraph}
              currentUserId={currentUserId}
              height={560}
            />
          )
        ) : (
          egoGraph && (
            <TrustGraph
              mode="ego"
              graphData={egoGraph}
              currentUserId={currentUserId}
              height={560}
            />
          )
        )}
      </div>
    </div>
  )
}
