import { useEffect, useState } from 'react'
import { requestService } from '@/lib/api'
import FilterChipRow, { RequestTypeFilter, UrgencyFilter } from './FilterChipRow'
import EmptyState from './EmptyState'
import TrustPathBadge, { TrustPathBadgeSkeleton } from './TrustPathBadge'
import { useTrustPath } from '@/hooks/useTrustPath'
import BrowseModeControl, { BrowseMode } from './BrowseModeControl'

interface HelpRequest {
  id: string
  title: string
  description: string
  status: string
  urgency: string
  request_type?: string
  community_name?: string
  requester_id: string
  requester_name?: string
  created_at: string
  match_score?: number
}

function RequestTrustBadge({ requesterId }: { requesterId?: string }) {
  const { trustPath, loading } = useTrustPath(requesterId)
  if (loading) return <TrustPathBadgeSkeleton compact />
  if (!trustPath) return null
  return <TrustPathBadge trustPath={trustPath} compact />
}

const URGENCY_COLORS: Record<string, string> = {
  urgent: 'text-red-600 bg-red-50',
  high: 'text-orange-600 bg-orange-50',
  medium: 'text-amber-600 bg-amber-50',
  low: 'text-text-muted bg-surface-raised',
}

const TYPE_LABELS: Record<string, string> = {
  generic: 'General',
  ride: '🚗 Ride',
  service: '🔧 Service',
  event: '📅 Event',
  borrow: '📦 Borrow',
}

function formatTime(timestamp: string): string {
  const date = new Date(timestamp)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)
  if (diffMins < 1) return 'just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays === 1) return 'yesterday'
  if (diffDays < 7) return `${diffDays}d ago`
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

interface BrowseFeedProps {
  communityId?: string
  communityType?: 'mutual_aid' | 'group'
  isOnDuty?: boolean
  providerServiceTypes?: string[]
  noCommunities?: boolean
  browseMode?: BrowseMode
  onBrowseModeChange?: (mode: BrowseMode) => void
}

export default function BrowseFeed({ communityId, communityType, isOnDuty, providerServiceTypes, noCommunities, browseMode: externalBrowseMode, onBrowseModeChange }: BrowseFeedProps) {
  const [requests, setRequests] = useState<HelpRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [activeType, setActiveType] = useState<RequestTypeFilter>('all')
  const [activeUrgency, setActiveUrgency] = useState<UrgencyFilter>('all')
  const [offering, setOffering] = useState<string | null>(null)
  const [internalBrowseMode, setInternalBrowseMode] = useState<BrowseMode>(() => {
    if (typeof window === 'undefined') return 'provider'
    return (localStorage.getItem('karmyq_browse_mode') as BrowseMode) ?? 'provider'
  })

  const browseMode = externalBrowseMode ?? internalBrowseMode

  const handleBrowseModeChange = (mode: BrowseMode) => {
    setInternalBrowseMode(mode)
    localStorage.setItem('karmyq_browse_mode', mode)
    onBrowseModeChange?.(mode)
  }

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(false)

    const userData = typeof window !== 'undefined' ? localStorage.getItem('user') : null
    const currentUserId = userData ? JSON.parse(userData).id : null

    requestService.getCuratedRequests({
      community_id: communityId && communityId !== 'all' ? communityId : undefined,
      limit: 50,
    }).then((res) => {
      if (cancelled) return
      const all: HelpRequest[] = res.data?.requests ?? res.data ?? []
      // Only show open requests from other users
      setRequests(all.filter((r) => r.status === 'open' && r.requester_id !== currentUserId))
    }).catch(() => {
      if (!cancelled) setError(true)
    }).finally(() => {
      if (!cancelled) setLoading(false)
    })

    return () => { cancelled = true }
  }, [communityId])

  const filtered = requests.filter((r) => {
    const typeMatch = activeType === 'all' || r.request_type === activeType
    const urgencyMatch = activeUrgency === 'all' || r.urgency === activeUrgency
    const serviceMatch =
      !isOnDuty ||
      browseMode === 'community' ||
      browseMode === 'both' ||
      (browseMode === 'provider' && (providerServiceTypes ?? []).includes(r.request_type ?? ''))
    return typeMatch && urgencyMatch && serviceMatch
  })

  const handleOffer = async (requestId: string) => {
    const userData = typeof window !== 'undefined' ? localStorage.getItem('user') : null
    const currentUser = userData ? JSON.parse(userData) : null
    if (!currentUser) return

    setOffering(requestId)
    try {
      await requestService.createMatch({ request_id: requestId, responder_id: currentUser.id })
      // Remove from feed after offering
      setRequests((prev) => prev.filter((r) => r.id !== requestId))
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to offer help')
    } finally {
      setOffering(null)
    }
  }

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="card p-4 animate-pulse">
              <div className="h-4 bg-border rounded w-3/4 mb-2" />
              <div className="h-3 bg-border rounded w-1/2" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-8">
        <EmptyState heading="Couldn't load requests" body="Check your connection and try refreshing." />
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto px-4">
      {isOnDuty && (
        <BrowseModeControl browseMode={browseMode} onChange={handleBrowseModeChange} />
      )}

      {communityType === 'group' && (
        <div className="text-sm text-muted-foreground bg-muted/50 rounded-md px-3 py-2 mb-3 border border-border">
          This is a group community. Use the <strong>Activities</strong> tab for event coordination.
          Help requests from group members appear below.
        </div>
      )}

      <FilterChipRow
        activeType={activeType}
        activeUrgency={activeUrgency}
        onTypeChange={setActiveType}
        onUrgencyChange={setActiveUrgency}
      />

      {filtered.length === 0 ? (
        noCommunities ? (
          <EmptyState
            icon="🏘️"
            heading="Join a community to see requests"
            body="Once you're part of a community, you'll see requests here from your neighbours."
            ctaLabel="Find Communities"
            ctaHref="/communities"
          />
        ) : communityType === 'group' ? (
          <EmptyState
            heading="No requests yet"
            body="Group members can post help requests, or check the Activities tab for upcoming events."
          />
        ) : (
          <EmptyState
            heading="No open requests"
            body={activeType !== 'all' || activeUrgency !== 'all' ? 'Try clearing your filters.' : 'Check back soon — your community will post requests here.'}
          />
        )
      ) : (
        <div className="space-y-3 pb-4">
          {filtered.map((request) => {
            const isProviderMatch =
              isOnDuty &&
              browseMode !== 'community' &&
              (providerServiceTypes ?? []).includes(request.request_type ?? '')
            return (
            <div key={request.id} className={`feed-card ${isProviderMatch ? 'border-l-4 border-amber-400' : ''}`}>
              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center text-white text-xs font-semibold shrink-0">
                    {request.requester_name?.charAt(0).toUpperCase() ?? '?'}
                  </div>
                  <div className="min-w-0">
                    <span className="text-sm font-medium text-text truncate block">{request.requester_name ?? 'Community member'}</span>
                    {request.requester_id && <RequestTrustBadge requesterId={request.requester_id} />}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {request.match_score != null && request.match_score > 0 && (
                    <span className="text-xs text-primary font-medium">{Math.round(request.match_score * 100)}% match</span>
                  )}
                  <span className="text-xs text-text-muted">{formatTime(request.created_at)}</span>
                </div>
              </div>

              <h3 className="font-medium text-text mb-1">{request.title}</h3>

              {isProviderMatch && (
                <span className="inline-block text-xs px-2 py-0.5 rounded-full text-amber-600 bg-amber-50 mb-2">
                  Provider match
                </span>
              )}

              {request.description && (
                <p className="text-sm text-text-muted mb-3 line-clamp-2">{request.description}</p>
              )}

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {request.request_type && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-surface border border-border text-text-muted">
                      {TYPE_LABELS[request.request_type] ?? request.request_type}
                    </span>
                  )}
                  {request.urgency && (
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${URGENCY_COLORS[request.urgency] ?? 'text-text-muted bg-surface-raised'}`}>
                      {request.urgency}
                    </span>
                  )}
                  {request.community_name && (
                    <span className="text-xs text-text-subtle">{request.community_name}</span>
                  )}
                </div>
                <button
                  onClick={() => handleOffer(request.id)}
                  disabled={offering === request.id}
                  className="btn-primary text-sm py-1.5 px-4 disabled:opacity-50"
                >
                  {offering === request.id ? 'Offering…' : 'Offer to Help'}
                </button>
              </div>
            </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
