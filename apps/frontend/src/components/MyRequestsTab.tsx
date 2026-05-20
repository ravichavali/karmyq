import { useEffect, useState } from 'react'
import { requestService } from '@/lib/api'
import EmptyState from './EmptyState'
import BrowseModeControl, { BrowseMode } from './BrowseModeControl'

interface Offer {
  id: string
  helper_name?: string
  responder_id?: string
  status: string
}

interface MyRequest {
  id: string
  title: string
  status: string
  urgency?: string
  created_at: string
  offers?: Offer[]
  offer_count?: number
}

interface MyRequestsTabProps {
  onNewRequest: () => void
  isOnDuty?: boolean
  browseMode?: BrowseMode
  onBrowseModeChange?: (mode: BrowseMode) => void
}

export default function MyRequestsTab({ onNewRequest, isOnDuty, browseMode, onBrowseModeChange }: MyRequestsTabProps) {
  const [requests, setRequests] = useState<MyRequest[]>([])
  const [expanded, setExpanded] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [acting, setActing] = useState<string | null>(null)

  const fetchMyRequests = () => {
    const userData = typeof window !== 'undefined' ? localStorage.getItem('user') : null
    const currentUser = userData ? JSON.parse(userData) : null
    if (!currentUser) return

    Promise.all([
      requestService.getRequests({ requester_id: currentUser.id, limit: 50 }),
      requestService.getMatches({ user_id: currentUser.id, limit: 200 }),
    ]).then(([reqRes, matchRes]) => {
      const myRequests: MyRequest[] = reqRes.data?.requests ?? []
      const allMatches: any[] = matchRes.data?.matches ?? []

      const enriched = myRequests.map((r) => {
        const requestMatches = allMatches.filter(
          (m) => m.request_id === r.id && m.status !== 'rejected' && m.status !== 'cancelled'
        )
        return {
          ...r,
          offers: requestMatches.map((m) => ({
            id: m.id,
            helper_name: m.responder_name ?? 'Community member',
            responder_id: m.responder_id,
            status: m.status,
          })),
          offer_count: requestMatches.length,
        }
      })

      setRequests(enriched)
    }).catch((err) => {
      console.error('Failed to load my requests', { error: err instanceof Error ? err.message : String(err) })
    }).finally(() => {
      setLoading(false)
    })
  }

  useEffect(() => {
    fetchMyRequests()
  }, [])

  const handleAccept = async (offerId: string, _requestId: string) => {
    const userData = typeof window !== 'undefined' ? localStorage.getItem('user') : null
    const currentUser = userData ? JSON.parse(userData) : null
    if (!currentUser) return

    setActing(offerId)
    try {
      await requestService.acceptMatch(offerId, currentUser.id)
      fetchMyRequests()
      setExpanded(null)
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to accept offer')
    } finally {
      setActing(null)
    }
  }

  const handleDecline = async (offerId: string) => {
    setActing(offerId)
    try {
      const userData = typeof window !== 'undefined' ? localStorage.getItem('user') : null
      const currentUser = userData ? JSON.parse(userData) : null
      if (!currentUser) return

      await requestService.rejectMatch(offerId, currentUser.id)
      fetchMyRequests()
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to decline offer')
    } finally {
      setActing(null)
    }
  }

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="space-y-3">
          {[1, 2].map((i) => (
            <div key={i} className="card p-4 animate-pulse">
              <div className="h-4 bg-border rounded w-2/3 mb-2" />
              <div className="h-3 bg-border rounded w-1/4" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-4">
      {isOnDuty && browseMode && onBrowseModeChange && (
        <BrowseModeControl browseMode={browseMode} onChange={onBrowseModeChange} />
      )}

      <div className="flex items-center justify-between mb-4">
        <h2 className="section-heading !mb-0">My Requests</h2>
        <button className="btn-primary text-sm" onClick={onNewRequest}>+ New Request</button>
      </div>

      {requests.length === 0 ? (
        <EmptyState
          heading="No requests yet"
          body="Ask your community for help — they're here for you."
          ctaLabel="Post a Request"
          ctaOnClick={onNewRequest}
        />
      ) : (
        <div className="space-y-2">
          {requests.map((r) => (
            <div key={r.id} className="card">
              <div
                className="p-4 flex items-center justify-between cursor-pointer"
                onClick={() => setExpanded(expanded === r.id ? null : r.id)}
              >
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-text">{r.title}</p>
                  <p className="text-sm text-text-muted mt-0.5 capitalize">{r.status}</p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  {(r.offer_count ?? 0) > 0 && (
                    <span className="text-sm text-primary font-medium">
                      {r.offer_count} offer{r.offer_count !== 1 ? 's' : ''}
                    </span>
                  )}
                  <svg
                    className={`w-4 h-4 text-text-muted transition-transform ${expanded === r.id ? 'rotate-180' : ''}`}
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </div>
              </div>

              {expanded === r.id && (
                <div className="border-t border-border px-4 pb-4 pt-3 space-y-3">
                  {!r.offers || r.offers.length === 0 ? (
                    <p className="text-sm text-text-muted">No offers yet.</p>
                  ) : (
                    r.offers.map((offer) => (
                      <div key={offer.id} className="flex items-center justify-between">
                        <span className="text-sm text-text">{offer.helper_name}</span>
                        {r.status === 'open' && offer.status === 'proposed' && (
                          <div className="flex gap-2">
                            <button
                              className="btn-primary text-sm py-1 px-3 disabled:opacity-50"
                              disabled={acting === offer.id}
                              onClick={() => handleAccept(offer.id, r.id)}
                            >
                              Accept
                            </button>
                            <button
                              className="btn-ghost text-sm py-1 px-3 disabled:opacity-50"
                              disabled={acting === offer.id}
                              onClick={() => handleDecline(offer.id)}
                            >
                              Decline
                            </button>
                          </div>
                        )}
                        {offer.status !== 'proposed' && (
                          <span className="text-xs text-text-muted capitalize">{offer.status}</span>
                        )}
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
