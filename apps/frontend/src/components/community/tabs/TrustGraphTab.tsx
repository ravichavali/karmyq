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
  raw_weight: number
  effective_weight: number
}

interface GraphData {
  nodes: TrustNode[]
  links: TrustLink[]
}

type SubTab = 'community' | 'ego'

export default function TrustGraphTab({ communityId, currentUserId }: TrustGraphTabProps) {
  const [subTab, setSubTab] = useState<SubTab>('community')
  const [communityGraph, setCommunityGraph] = useState<GraphData | null>(null)
  const [egoGraph, setEgoGraph] = useState<GraphData | null>(null)
  const [egoCenter, setEgoCenter] = useState<string | null>(null)
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

  // Fetch the ego graph (centered on the calling user, or a clicked neighbor).
  const loadEgo = useCallback((center?: string) => {
    setLoading(true)
    setError(null)
    socialGraphService.getTrustGraph(communityId, center)
      .then((res: any) => setEgoGraph(res.data))
      .catch(() => setError('Failed to load your network.'))
      .finally(() => setLoading(false))
  }, [communityId])

  useEffect(() => {
    if (subTab === 'ego' && !egoGraph) loadEgo()
  }, [subTab, egoGraph, loadEgo])

  const handleEgoNodeClick = useCallback((nodeId: string) => {
    if (nodeId === egoCenter || nodeId === currentUserId) {
      setEgoCenter(null)
      loadEgo()
    } else {
      setEgoCenter(nodeId)
      loadEgo(nodeId)
    }
  }, [egoCenter, currentUserId, loadEgo])

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
            : 'You at the center. Closer rings are stronger connections. Click a neighbor to recenter.'}
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
              onNodeClick={handleEgoNodeClick}
              height={560}
            />
          )
        )}
      </div>
    </div>
  )
}
