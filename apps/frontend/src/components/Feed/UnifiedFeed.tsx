import { useEffect, useRef, useState } from 'react'
import { requestService } from '@/lib/api'
import FilterChipRow, { RequestTypeFilter, UrgencyFilter } from '@/components/FilterChipRow'
import EmptyState from '@/components/EmptyState'
import BrowseModeControl, { BrowseMode } from '@/components/BrowseModeControl'
import RequestCard from './RequestCard'
import ActivityCard from './ActivityCard'
import StoryCard from './StoryCard'
import DecisionBand from './DecisionBand'
import type { ActivityData, DecisionData, RequestCardData, UnifiedFeedItem } from '@/types/unified-feed'
import type { StoryData } from '@/types/feed-items'

/**
 * The unified feed (Sprint 85/86 / ADR-066) — ONE model rendered in two views, in server-ranked
 * array order:
 *   - view="home" (Dashboard Home): the decisions you owe (DecisionBand) on top, then the requests
 *     you can fill, ranked by action altitude.
 *   - view="community" (Community tab): the requests you can fill, then the community texture
 *     (ActivityCard summary, then StoryCards). NO decision band, no provider browse-mode control.
 * Replaces every legacy bespoke card surface with the canonical RequestCard + texture cards.
 */

interface UnifiedFeedProps {
  /** Which view to render/fetch. 'home' = decisions + requests; 'community' = requests + texture. */
  view?: 'home' | 'community'
  communityId?: string
  communityType?: 'mutual_aid' | 'group'
  isOnDuty?: boolean
  providerServiceTypes?: string[]
  noCommunities?: boolean
  browseMode?: BrowseMode
  onBrowseModeChange?: (mode: BrowseMode) => void
  /**
   * Sprint 89 / ADR-068 — on community Home the weekly summary is rendered once by the hero-level
   * CommunityPulse, so suppress the duplicate in-feed ActivityCard here. Stories still render.
   */
  suppressActivity?: boolean
}

function readCurrentUserId(): string | null {
  const userData = typeof window !== 'undefined' ? localStorage.getItem('user') : null
  return userData ? (JSON.parse(userData).id ?? null) : null
}

export default function UnifiedFeed({
  view = 'home',
  communityId,
  communityType,
  isOnDuty,
  providerServiceTypes,
  noCommunities,
  browseMode: externalBrowseMode,
  onBrowseModeChange,
  suppressActivity = false,
}: UnifiedFeedProps) {
  const isCommunity = view === 'community'
  const [items, setItems] = useState<UnifiedFeedItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [activeType, setActiveType] = useState<RequestTypeFilter>('all')
  const [activeUrgency, setActiveUrgency] = useState<UrgencyFilter>('all')
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [showingMoreOpen, setShowingMoreOpen] = useState(false)
  const [internalBrowseMode, setInternalBrowseMode] = useState<BrowseMode>(() => {
    if (typeof window === 'undefined') return 'provider'
    return (localStorage.getItem('karmyq_browse_mode') as BrowseMode) ?? 'provider'
  })

  const browseMode = externalBrowseMode ?? internalBrowseMode
  const minScore = showingMoreOpen ? 0 : 30

  const handleBrowseModeChange = (mode: BrowseMode) => {
    setInternalBrowseMode(mode)
    localStorage.setItem('karmyq_browse_mode', mode)
    onBrowseModeChange?.(mode)
  }

  // Monotonic request id: only the LATEST fetch may apply its result. Guards against an out-of-order
  // background reconcile (fetchFeed(false) after a decision action) landing after a newer fetch — a
  // fast Accept-then-navigate could otherwise let a stale Home response overwrite the current view.
  const fetchSeq = useRef(0)
  // Don't apply a fetch that resolves after the component unmounted (e.g. navigate away mid-reconcile).
  const mountedRef = useRef(true)
  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  const fetchFeed = (showLoading = true) => {
    const seq = ++fetchSeq.current
    const isStale = () => seq !== fetchSeq.current || !mountedRef.current
    if (showLoading) {
      setLoading(true)
      setError(false)
    }
    setCurrentUserId(readCurrentUserId())

    requestService
      .getCuratedRequests({
        view,
        community_id: communityId && communityId !== 'all' ? communityId : undefined,
        minScore,
        limit: 50,
      })
      .then((res) => {
        if (isStale()) return
        // createApiClient unwraps the envelope → res.data is { items, count }.
        setItems((res.data?.items as UnifiedFeedItem[]) ?? [])
      })
      .catch(() => {
        if (!isStale() && showLoading) setError(true)
      })
      .finally(() => {
        if (!isStale() && showLoading) setLoading(false)
      })
  }

  useEffect(() => fetchFeed(true), [communityId, view, minScore])

  const decisions = items
    .filter((i): i is Extract<UnifiedFeedItem, { kind: 'decision' }> => i.kind === 'decision')
    .map((i) => i.data)

  // Texture layer (community view): server-ranked below requests; rendered in array order.
  const activityCards = (suppressActivity ? [] : items
    .filter((i): i is Extract<UnifiedFeedItem, { kind: 'activity' }> => i.kind === 'activity')
    .map((i) => i.data as ActivityData))
  const storyCards = items
    .filter((i): i is Extract<UnifiedFeedItem, { kind: 'story' }> => i.kind === 'story')
    .map((i) => i.data as StoryData)
  const hasTexture = activityCards.length > 0 || storyCards.length > 0

  const requestCards = items
    .filter((i): i is Extract<UnifiedFeedItem, { kind: 'request' }> => i.kind === 'request')
    .map((i) => i.data)
    .filter((r) => {
      // request_type holds the request_type_enum (generic|ride|…) at runtime — RequestCardData
      // types it as the payload-subtype union, so compare as string against the enum filter.
      const requestType = (r.request_type as string | undefined) ?? ''
      const typeMatch = activeType === 'all' || requestType === activeType
      const urgencyMatch = activeUrgency === 'all' || r.urgency === activeUrgency
      // Provider browse-mode filtering is a Home concern; the community view shows every request.
      const serviceMatch =
        isCommunity ||
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
  const resolveDecision = (subjectId: string) => {
    dropDecision(subjectId)
    fetchFeed(false)
  }

  // The widen-feed affordance applies only to an unfiltered feed for a user who has communities.
  // Before widening we offer "Show more"; after widening (minScore=0) we close it with a finite note.
  const isUnfilteredFeed = !noCommunities && activeType === 'all' && activeUrgency === 'all'
  const canShowMoreOpen = !showingMoreOpen && isUnfilteredFeed
  const showWidenedTerminalNote = showingMoreOpen && isUnfilteredFeed

  const showMoreOpenButton = canShowMoreOpen ? (
    <button type="button" className="btn-ghost mt-4" onClick={() => setShowingMoreOpen(true)}>
      Show more open requests
    </button>
  ) : null

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
      {/* Provider browse-mode + decision band are Home-only — the community view omits them. */}
      {!isCommunity && (
        <div className={isOnDuty ? '' : 'invisible pointer-events-none'}>
          <BrowseModeControl browseMode={browseMode} onChange={handleBrowseModeChange} />
        </div>
      )}

      {communityType === 'group' && (
        <div className="text-sm text-muted-foreground bg-muted/50 rounded-md px-3 py-2 mb-3 border border-border">
          This is a group community. Use the <strong>Activities</strong> tab for event coordination.
          Help requests from group members appear below.
        </div>
      )}

      {!isCommunity && <DecisionBand decisions={decisions} onResolved={resolveDecision} />}

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
        ) : isCommunity ? (
          // Community view: only show the "nothing here" state when there's no texture either.
          !hasTexture ? (
            <div className="kq-finite-state">
              <EmptyState
                icon="🤝"
                heading="No open requests right now"
                body={
                  showingMoreOpen
                    ? "That's everyone for now. We'll let you know when a neighbour needs help here."
                    : "You're caught up on the most relevant asks here."
                }
              />
              {showMoreOpenButton}
            </div>
          ) : null
        ) : (
          <div className="kq-finite-state">
            <EmptyState
              icon="✅"
              heading="You're caught up"
              body={
                showingMoreOpen
                  ? "That's everyone for now. We'll let you know when a neighbour needs you — quietly."
                  : "No open requests you can fill right now. You can look further, or browse your communities."
              }
              ctaLabel="Browse communities"
              ctaHref="/communities"
            />
            {showMoreOpenButton}
          </div>
        )
      ) : (
        <div className="space-y-3 pb-4">
          {requestCards.map((data) => (
            <RequestCard key={data.request_id} data={data} currentUserId={currentUserId} onOffered={dropRequest} />
          ))}
          {showMoreOpenButton && (
            <div className="pt-1 text-center">
              {showMoreOpenButton}
            </div>
          )}
          {/* BUG-097-003: once the feed has been widened (minScore=0) there is no more to show,
              so close it with a clear finite note — never before the user clicks Show more. */}
          {showWidenedTerminalNote && (
            <div className="kq-finite-state">
              <EmptyState
                icon="✅"
                heading="That's everyone for now"
                body={
                  isCommunity
                    ? "You're seeing every open ask in this community."
                    : "You're seeing every open ask you can fill right now."
                }
              />
            </div>
          )}
        </div>
      )}

      {/* Community texture, server-ranked below the requests. */}
      {isCommunity && hasTexture && (
        <div className="space-y-3 pb-4">
          {activityCards.map((data) => (
            <ActivityCard key={`activity-${data.community_id}`} data={data} />
          ))}
          {storyCards.map((data, idx) => (
            <StoryCard key={`story-${data.type}-${idx}`} data={data} />
          ))}
        </div>
      )}
    </div>
  )
}
