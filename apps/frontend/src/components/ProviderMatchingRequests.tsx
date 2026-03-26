import { useEffect, useState } from 'react'
import { getMatchingRequests } from '@/lib/api/providerApi'
import SubmitOfferModal from './SubmitOfferModal'

interface HelpRequest {
  id: string
  title: string
  request_type?: string
  status: string
  urgency?: string
  community_name?: string
  requester_id: string
  created_at: string
}

const TYPE_LABELS: Record<string, string> = {
  generic: 'General',
  ride: 'Ride',
  service: 'Service',
  event: 'Event',
  borrow: 'Borrow',
}

interface OfferTarget {
  requestId: string
  requestTitle: string
}

export default function ProviderMatchingRequests() {
  const [requests, setRequests] = useState<HelpRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [offerTarget, setOfferTarget] = useState<OfferTarget | null>(null)

  const fetchRequests = async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await getMatchingRequests()
      // data is either an array or an object with a requests field
      const list: HelpRequest[] = Array.isArray(data) ? data : (data?.requests ?? [])
      setRequests(list)
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to load requests.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchRequests()
  }, [])

  const handleOfferSubmitted = () => {
    fetchRequests()
  }

  return (
    <div className="bg-surface-raised border border-border rounded-xl p-4 mb-4">
      <h2 className="font-semibold text-text mb-3">Open Requests Near You</h2>

      {loading && (
        <div className="flex items-center justify-center py-6">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
        </div>
      )}

      {!loading && error && (
        <p className="text-sm text-red-600">{error}</p>
      )}

      {!loading && !error && requests.length === 0 && (
        <p className="text-sm text-text-muted py-2">
          No open requests in your communities right now.
        </p>
      )}

      {!loading && !error && requests.length > 0 && (
        <div className="flex flex-col gap-3">
          {requests.map((request) => (
            <div
              key={request.id}
              className="bg-surface rounded-lg p-3 border border-border"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-medium text-text truncate">{request.title}</h3>
                  <div className="flex items-center gap-2 mt-1">
                    {request.request_type && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-surface border border-border text-text-muted">
                        {TYPE_LABELS[request.request_type] ?? request.request_type}
                      </span>
                    )}
                    {request.community_name && (
                      <span className="text-xs text-text-muted">{request.community_name}</span>
                    )}
                  </div>
                </div>
                <button
                  onClick={() =>
                    setOfferTarget({ requestId: request.id, requestTitle: request.title })
                  }
                  className="btn-primary text-xs py-1.5 px-3 shrink-0"
                >
                  Make Offer
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {offerTarget && (
        <SubmitOfferModal
          requestId={offerTarget.requestId}
          requestTitle={offerTarget.requestTitle}
          defaultPrice={null}
          onClose={() => setOfferTarget(null)}
          onSubmitted={handleOfferSubmitted}
        />
      )}
    </div>
  )
}
