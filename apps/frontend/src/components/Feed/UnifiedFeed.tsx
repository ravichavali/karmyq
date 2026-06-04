import { useEffect, useState } from 'react'
import { requestService } from '@/lib/api'
import FilterChipRow, { RequestTypeFilter, UrgencyFilter } from '@/components/FilterChipRow'
import EmptyState from '@/components/EmptyState'
import BrowseModeControl, { BrowseMode } from '@/components/BrowseModeControl'
import RequestCard from './RequestCard'
import DecisionBand from './DecisionBand'
import type { DecisionData, RequestCardData, UnifiedFeedItem } from '@/types/unified-feed'

/**
 * Dashboard Home — the unified feed (Sprint 85 / ADR-066). Renders ONE model in array order:
 * the decisions you owe (DecisionBand) on top, then the requests you can fill (the canonical
 * RequestCard), already ranked server-side by action altitude. When no fillable requests remain,
 * the "you're caught up" end-state points the member toward their communities. Replaces BrowseFeed's
 * bespoke card with the canonical one.
 */

interface UnifiedFeedProps {
  communityId?: string
  communityType?: 'mutual_aid' | 'group'
  isOnDuty?: boolean
  providerServiceTypes?: string[]
  noCommunities?: boolean
  browseMode?: BrowseMode
  onBrowseModeChange?: (mode: BrowseMode) => void
}

function readCurrentUserId(): string | null {
  const userData = typeof window !== 'undefined' ? localStorage.getItem('user') : null
  return userData ? (JSON.parse(userData).id ?? null) : null
}

export default function UnifiedFeed({
  communityId,
  communityType,
  isOnDuty,
  providerServiceTypes,
  noCommunities,
  browseMode: externalBrowseMode,
  onBrowseModeChange,
}: UnifiedFeedProps) {
  const [items, setItems] = useState<UnifiedFeedItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [activeType, setActiveType] = useState<RequestTypeFilter>('all')
  const [activeUrgency, setActiveUrgency] = useState<UrgencyFilter>('all')
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
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

  const fetchFeed = () => {
    let cancelled = false
    setLoading(true)
    setError(false)
    setCurrentUserId(readCurrentUserId())

    requestService
      .getCuratedRequests({
        view: 'home',
        community_id: communityId && communityId !== 'all' ? communityId : undefined,
        limit: 50,
      })
      .then((res) => {
        if (cancelled) return
        // createApiClient unwraps the envelope → res.data is { items, count }.
        setItems((res.data?.items as UnifiedFeedItem[]) ?? [])
      })
      .catch(() => {
        if (!cancelled) setError(true)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }

  useEffect(fetchFeed, [communityId])

  const decisions = items
    .filter((i): i is Extract<UnifiedFeedItem, { kind: 'decision' }> => i.kind === 'decision')
    .map((i) => i.data)

  const requestCards = items
    .filter((i): i is Extract<UnifiedFeedItem, { kind: 'request' }> => i.kind === 'request')
    .map((i) => i.data)
    .filter((r) => {
      // request_type holds the request_type_enum (generic|ride|…) at runtime — RequestCardData
      // types it as the payload-subtype union, so compare as string against the enum filter.
      const requestType = (r.request_type as string | undefined) ?? ''
      const typeMatch = activeType === 'all' || requestType === activeType
      const urgencyMatch = activeUrgency === 'all' || r.urgency === activeUrgency
      const serviceMatch =
        !isOnDuty ||
        browseMode === 'community' ||
        browseMode === 'both' ||
        (browseMode === 'provider' && (providerServiceTypes ?? []).includes(requestType))
      return typeMatch && urgencyMatch && serviceMatch
    })

  // Optimistically drop a card/decision once acted on; a background refetch reconciles.
  const dropRequest = (requestId: string) =>
    setItems((prev) => prev.filter((i) => !(i.kind === 'request' && (i.data as RequestCardData).request_id === requestId)))
  const dropDecision = (subjectId: string) =>
    setItems((prev) => prev.filter((i) => !(i.kind === 'decision' && (i.data as DecisionData).subject_id === subjectId)))

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
        <EmptyState heading="Couldn't load your feed" body="Check your connection and try refreshing." />
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto px-4">
      <div className={isOnDuty ? '' : 'invisible pointer-events-none'}>
        <BrowseModeControl browseMode={browseMode} onChange={handleBrowseModeChange} />
      </div>

      {communityType === 'group' && (
        <div className="text-sm text-muted-foreground bg-muted/50 rounded-md px-3 py-2 mb-3 border border-border">
          This is a group community. Use the <strong>Activities</strong> tab for event coordination.
          Help requests from group members appear below.
        </div>
      )}

      <DecisionBand decisions={decisions} onResolved={dropDecision} />

      <FilterChipRow
        activeType={activeType}
        activeUrgency={activeUrgency}
        onTypeChange={setActiveType}
        onUrgencyChange={setActiveUrgency}
      />

      {requestCards.length === 0 ? (
        noCommunities ? (
          <EmptyState
            icon="🏘️"
            heading="Join a community to see requests"
            body="Once you're part of a community, you'll see requests here from your neighbours."
            ctaLabel="Find Communities"
            ctaHref="/communities"
          />
        ) : activeType !== 'all' || activeUrgency !== 'all' ? (
          <EmptyState heading="No matching requests" body="Try clearing your filters." />
        ) : (
          <EmptyState
            icon="✅"
            heading="You're caught up"
            body="No open requests you can fill right now. Browse your communities to see what's happening."
            ctaLabel="Browse communities"
            ctaHref="/communities"
          />
        )
      ) : (
        <div className="space-y-3 pb-4">
          {requestCards.map((data) => (
            <RequestCard key={data.request_id} data={data} currentUserId={currentUserId} onOffered={dropRequest} />
          ))}
        </div>
      )}
    </div>
  )
}
