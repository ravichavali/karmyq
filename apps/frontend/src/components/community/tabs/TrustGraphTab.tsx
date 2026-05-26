import { useEffect, useState } from 'react'
import { socialGraphService } from '@/lib/api'
import TrustGraph from '@/components/TrustGraph'

interface TrustGraphTabProps {
  communityId: string
  currentUserId: string
}

interface TrustGraphData {
  nodes: any[]
  links: any[]
}

export default function TrustGraphTab({ communityId, currentUserId }: TrustGraphTabProps) {
  const [graphData, setGraphData] = useState<TrustGraphData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    setError(null)
    socialGraphService.getTrustGraph(communityId)
      .then((res: any) => setGraphData(res.data))
      .catch(() => setError('Failed to load trust graph.'))
      .finally(() => setLoading(false))
  }, [communityId])

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
      <div className="mb-4">
        <h3 className="text-base font-semibold text-text">Your Trust Neighborhood</h3>
        <p className="text-sm text-text-muted mt-1">
          Shows you and the members you've directly exchanged with. Node size = trust score · Click a node to highlight connections.
        </p>
      </div>
      <TrustGraph graphData={graphData} currentUserId={currentUserId} />
    </div>
  )
}
