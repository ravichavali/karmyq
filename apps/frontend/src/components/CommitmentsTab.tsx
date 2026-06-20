import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import Link from 'next/link'
import { requestService } from '@/lib/api'
import { getOffersForRequest, acceptOffer, declineOffer } from '@/lib/api/providerApi'
import EmptyState from './EmptyState'
import { sortByActionPriority } from '../utils/commitmentSort'
import ExpandableConversation from './ExpandableConversation'
import { TrustCard } from './TrustCard'
import RatingPrompt from './RatingPrompt'
import DecisionBand from './Feed/DecisionBand'
import type { DecisionData, OfferedAwaitingItem, UnifiedFeedItem } from '@/types/unified-feed'
import { extractCompletion, submitExchangeRating } from '../utils/completion'

interface Match {
  id: string
  request_id: string
  responder_id: string
  requester_id?: string
  status: string
  created_at: string
  completed_at?: string | null
  request_title?: string
  requester_name?: string
  responder_name?: string
  admin_proposed?: boolean
  requester_done_at?: string | null
  responder_done_at?: string | null
}

function completedFadeOpacity(completedAt: string | null | undefined): number {
  if (!completedAt) return 1
  const days = (Date.now() - new Date(completedAt).getTime()) / 86_400_000
  return 1 - Math.min(1, days / 30) * 0.55
}

// ── Step indicator ────────────────────────────────────────────────────────────

const STEP_COLORS: Record<string, string> = {
  proposed: 'text-amber-500',
  matched: 'text-blue-500',
  completed: 'text-green-600',
}

function StepIndicator({ status }: { status: string }) {
  const colorCls = STEP_COLORS[status] ?? 'text-text-muted'
  const dots: Array<'filled' | 'empty'> = [
    status === 'proposed' ? 'filled' : 'empty',
    status === 'matched' ? 'filled' : 'empty',
    status === 'completed' ? 'filled' : 'empty',
  ]
  return (
    <span className={`text-xs tracking-widest ${colorCls}`} aria-label={`status: ${status}`}>
      {dots.map((d, i) => (
        <span key={i}>{d === 'filled' ? '●' : '○'}</span>
      ))}
    </span>
  )
}

// ── Collapsible section ───────────────────────────────────────────────────────

function SectionBlock({
  label,
  items,
  renderItem,
}: {
  label: string
  items: Match[]
  renderItem: (m: Match) => ReactNode
}) {
  const [open, setOpen] = useState(true)
  if (items.length === 0) return null
  return (
    <div className="mb-4">
      <button
        className="flex items-center gap-2 mb-2 w-full text-left focus:outline-none"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <span className="text-sm font-semibold text-text-muted uppercase tracking-wide">
          {label}
        </span>
        <span className="text-xs text-text-muted ml-auto">{open ? '▲' : '▼'}</span>
      </button>
      <div className={open ? 'block' : 'hidden'}>
        {items.map((m) => renderItem(m))}
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

interface CommitmentsTabProps {
  onDibsLoaded?: (count: number) => void
  communityId?: string
}

export default function CommitmentsTab({ onDibsLoaded, communityId }: CommitmentsTabProps = {}) {
  // BUG-015: the "needs your response" DecisionBand (decisions the member owes — accept/decline,
  // mark-done, rate, dibs) now lives at the top of the Helping tab, server-ranked across communities.
  const [decisions, setDecisions] = useState<DecisionData[]>([])
  const [helping, setHelping] = useState<Match[]>([])
  const [requested, setRequested] = useState<Match[]>([])
  const [myOpenRequests, setMyOpenRequests] = useState<any[]>([])
  const [offersByRequest, setOffersByRequest] = useState<Record<string, any[]>>({})
  const [offersLoading, setOffersLoading] = useState<Record<string, boolean>>({})
  const [offeredAwaiting, setOfferedAwaiting] = useState<{ count: number; items: OfferedAwaitingItem[] }>({ count: 0, items: [] })
  const [loading, setLoading] = useState(true)
  const [markingDone, setMarkingDone] = useState<string | null>(null)
  const [pendingRatingId, setPendingRatingId] = useState<string | null>(null)
  const [actioning, setActioning] = useState<string | null>(null)
  const [offerActioning, setOfferActioning] = useState<string | null>(null)
  const [currentUserId, setCurrentUserId] = useState<string>('')
  const [selectedProfileUserId, setSelectedProfileUserId] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  const fetchOffersForRequest = async (requestId: string) => {
    setOffersLoading((prev) => ({ ...prev, [requestId]: true }))
    try {
      const data = await getOffersForRequest(requestId)
      const offers: any[] = data?.offers ?? data ?? []
      setOffersByRequest((prev) => ({ ...prev, [requestId]: offers }))
    } catch {
      // silently ignore offer fetch errors
    } finally {
      setOffersLoading((prev) => ({ ...prev, [requestId]: false }))
    }
  }

  const loadOfferedAwaiting = () => {
    requestService.getOfferedAwaiting().then((res) => {
      setOfferedAwaiting({
        count: Number(res.data?.count) || 0,
        items: (res.data?.items ?? []) as OfferedAwaitingItem[],
      })
    }).catch(() => {
      setOfferedAwaiting({ count: 0, items: [] })
    })
  }

  // The "needs your response" queue — same server-ranked decisions feed the Dashboard uses, scoped
  // across communities (no community filter) so the band shows every decision the member owes.
  // The curated feed is scoped to the caller server-side (JWT), so this needs no user id.
  const loadDecisions = () => {
    requestService
      .getCuratedRequests({ view: 'home', limit: 50 })
      .then((res) => {
        const items = (res.data?.items ?? []) as UnifiedFeedItem[]
        const nextDecisions = items
          .filter((i): i is Extract<UnifiedFeedItem, { kind: 'decision' }> => i.kind === 'decision')
          .map((i) => i.data)
        setDecisions(nextDecisions)
        const dibsDecisionCount = nextDecisions.filter((d) => d.subject_kind === 'dibs').length
        onDibsLoaded?.(dibsDecisionCount)
      })
      .catch(() => {
        // The band is best-effort — a fetch error degrades to no band, never breaks the tab.
      })
  }

  const loadCommitments = (userId: string) => {
    requestService.getMatches({ user_id: userId, limit: 200 }).then((res) => {
      const allMatches: Match[] = res.data?.matches ?? []
      return requestService.getRequests({ requester_id: userId, limit: 100 }).then((reqRes) => {
        const myRequests: any[] = reqRes.data?.requests ?? []
        const myRequestIds = new Set(myRequests.map((r: any) => r.id))

        const helpingMatches = allMatches.filter(
          (m) => m.responder_id === userId && !myRequestIds.has(m.request_id)
        )
        const requestedMatches = allMatches.filter((m) => myRequestIds.has(m.request_id))

        setHelping(helpingMatches)
        setRequested(requestedMatches)

        const openRequests = myRequests.filter(
          (r: any) => r.status === 'open' || r.status === 'pending'
        )
        setMyOpenRequests(openRequests)
        openRequests.forEach((r: any) => fetchOffersForRequest(r.id))
      })
    }).catch((err) => {
      console.error('Failed to load commitments', { error: err instanceof Error ? err.message : String(err) })
    }).finally(() => {
      setLoading(false)
    })
  }

  useEffect(() => {
    const userData = typeof window !== 'undefined' ? localStorage.getItem('user') : null
    let currentUser = null
    try { currentUser = userData ? JSON.parse(userData) : null } catch { currentUser = null }
    if (!currentUser) return
    setCurrentUserId(currentUser.id ?? '')
    loadDecisions()
    loadOfferedAwaiting()
    loadCommitments(currentUser.id)
  }, [])

  // A band action resolves against the shared decision service → drop the row and reconcile both
  // the band and the commitment cards (a band accept/mark-done changes the cards' state too).
  const handleDecisionResolved = (subjectId: string) => {
    setDecisions((prev) => prev.filter((d) => d.subject_id !== subjectId))
    loadDecisions()
    loadOfferedAwaiting()
    if (currentUserId) {
      loadCommitments(currentUserId)
    }
  }

  const handleMarkDone = async (matchId: string) => {
    setMarkingDone(matchId)
    try {
      const res = await requestService.completeMatch(matchId)
      const { fullyCompleted } = extractCompletion(res)
      const now = new Date().toISOString()
      setHelping((prev) => prev.map((m) => m.id === matchId
        ? fullyCompleted
          ? { ...m, status: 'completed', responder_done_at: now }
          : { ...m, responder_done_at: now }
        : m
      ))
      // BUG-005: rating unlocks only on the transition to fully completed, never on
      // a one-sided done.
      if (fullyCompleted) setPendingRatingId(matchId)
    } catch (err: any) {
      setActionError(err.response?.data?.error?.message || err.response?.data?.message || 'Failed to mark done')
    } finally {
      setMarkingDone(null)
    }
  }

  const handleConfirmDone = async (matchId: string) => {
    setMarkingDone(matchId)
    try {
      const res = await requestService.completeMatch(matchId)
      const { fullyCompleted } = extractCompletion(res)
      const now = new Date().toISOString()
      setRequested((prev) => prev.map((m) => m.id === matchId
        ? fullyCompleted
          ? { ...m, status: 'completed', requester_done_at: now }
          : { ...m, requester_done_at: now }
        : m
      ))
      // BUG-005: rating unlocks only on the transition to fully completed.
      if (fullyCompleted) setPendingRatingId(matchId)
    } catch (err: any) {
      setActionError(err.response?.data?.error?.message || err.response?.data?.message || 'Failed to confirm done')
    } finally {
      setMarkingDone(null)
    }
  }

  const handleRate = async (match: Match, rating: number | null) => {
    const isHelper = match.responder_id === currentUserId
    const toUserId = isHelper ? match.requester_id : match.responder_id
    // BUG-005: shared rating submitter (one source of truth with DecisionBand).
    await submitExchangeRating({ matchId: match.id, toUserId, communityId, rating })
    setPendingRatingId(null)
  }

  const handleAccept = async (matchId: string, side: 'helping' | 'requested') => {
    setActioning(matchId)
    try {
      await requestService.acceptMatch(matchId)

      if (side === 'requested') {
        const acceptedMatch = requested.find((m) => m.id === matchId)
        if (acceptedMatch?.request_id) {
          setMyOpenRequests((prev) => prev.filter((r) => r.id !== acceptedMatch.request_id))
        }
        setRequested((prev) =>
          prev.map((m) => (m.id === matchId ? { ...m, status: 'matched' } : m))
        )
      } else {
        setHelping((prev) =>
          prev.map((m) => (m.id === matchId ? { ...m, status: 'matched' } : m))
        )
      }
      loadOfferedAwaiting()
    } catch (err: any) {
      setActionError(err.response?.data?.error?.message || err.response?.data?.message || 'Failed to accept offer')
    } finally {
      setActioning(null)
    }
  }

  const handleDecline = async (matchId: string, side: 'helping' | 'requested') => {
    setActioning(matchId)
    try {
      await requestService.rejectMatch(matchId)

      if (side === 'helping') {
        setHelping((prev) => prev.filter((m) => m.id !== matchId))
      } else {
        setRequested((prev) => prev.filter((m) => m.id !== matchId))
      }
      loadOfferedAwaiting()
    } catch (err: any) {
      setActionError(err.response?.data?.error?.message || err.response?.data?.message || 'Failed to decline offer')
    } finally {
      setActioning(null)
    }
  }

  const handleAcceptProviderOffer = async (offerId: string, requestId: string) => {
    setOfferActioning(offerId)
    try {
      await acceptOffer(offerId)
      await fetchOffersForRequest(requestId)
    } catch (err: any) {
      setActionError(err.response?.data?.error?.message || err.response?.data?.message || 'Failed to accept offer')
    } finally {
      setOfferActioning(null)
    }
  }

  const handleDeclineProviderOffer = async (offerId: string, requestId: string) => {
    setOfferActioning(offerId)
    try {
      await declineOffer(offerId)
      await fetchOffersForRequest(requestId)
    } catch (err: any) {
      setActionError(err.response?.data?.error?.message || err.response?.data?.message || 'Failed to decline offer')
    } finally {
      setOfferActioning(null)
    }
  }

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-4 space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="card p-4 animate-pulse">
            <div className="h-4 bg-border rounded w-3/4 mb-2" />
            <div className="h-3 bg-border rounded w-1/2" />
          </div>
        ))}
      </div>
    )
  }

  function renderHelpingCard(m: Match) {
    const showConversation = m.status === 'proposed' || m.status === 'matched'
    const fadeOpacity = m.status === 'completed'
      ? completedFadeOpacity(m.completed_at ?? m.responder_done_at)
      : 1
    return (
      <div key={m.id} className="card p-4 mb-3" style={{ opacity: fadeOpacity }}>
        {/* Top row: title + step indicator */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <p className="font-medium text-text truncate">{m.request_title ?? 'Request'}</p>
            <p className="text-sm text-text-muted mt-0.5">
              For{' '}
              {m.requester_id ? (
                <button
                  className="font-medium text-primary hover:underline"
                  onClick={() => setSelectedProfileUserId(m.requester_id!)}
                >
                  {m.requester_name ?? 'community member'}
                </button>
              ) : (
                <span>{m.requester_name ?? 'community member'}</span>
              )}
            </p>
          </div>
          <StepIndicator status={m.status} />
        </div>
        {m.admin_proposed && (
          <p className="text-xs text-teal-700 font-medium mt-1">
            Suggested by your community admin
          </p>
        )}
        {/* Conversation widget: below status indicator, above footer actions */}
        {showConversation && currentUserId && (
          <ExpandableConversation
            matchId={m.id}
            otherUserName={m.requester_name ?? 'Requester'}
            currentUserId={currentUserId}
          />
        )}
        {/* Footer actions: right-aligned */}
        {m.status === 'proposed' && m.admin_proposed && (
          <div className="flex justify-end gap-2 mt-3">
            <button
              className="text-xs py-1 px-2 rounded bg-green-100 text-green-700 hover:bg-green-200 disabled:opacity-50"
              disabled={actioning === m.id}
              onClick={() => handleAccept(m.id, 'helping')}
            >
              Accept
            </button>
            <button
              className="text-xs py-1 px-2 rounded bg-red-100 text-red-700 hover:bg-red-200 disabled:opacity-50"
              disabled={actioning === m.id}
              onClick={() => handleDecline(m.id, 'helping')}
            >
              Decline
            </button>
          </div>
        )}
        {m.status === 'proposed' && !m.admin_proposed && (
          <div className="flex justify-end mt-3">
            <button
              className="text-xs py-1 px-2 rounded bg-red-100 text-red-700 hover:bg-red-200 disabled:opacity-50"
              disabled={actioning === m.id}
              onClick={() => handleDecline(m.id, 'helping')}
            >
              {actioning === m.id ? 'Withdrawing…' : 'Withdraw Offer'}
            </button>
          </div>
        )}
        {m.status === 'matched' && !m.responder_done_at && (
          <div className="flex justify-end mt-3">
            <button
              className="btn-primary text-sm py-1 px-3 disabled:opacity-50"
              disabled={markingDone === m.id}
              onClick={() => handleMarkDone(m.id)}
            >
              {markingDone === m.id ? 'Saving…' : 'Mark Done'}
            </button>
          </div>
        )}
        {pendingRatingId === m.id && (
          <RatingPrompt onRate={(rating) => handleRate(m, rating)} />
        )}
        {m.status === 'matched' && m.responder_done_at && pendingRatingId !== m.id && (
          <p className="text-xs text-text-muted text-right mt-3">Waiting for requester to confirm</p>
        )}
      </div>
    )
  }

  function renderRequestedCard(m: Match) {
    const showConversation = m.status === 'proposed' || m.status === 'matched'
    const fadeOpacity = m.status === 'completed'
      ? completedFadeOpacity(m.completed_at ?? m.requester_done_at)
      : 1
    return (
      <div key={m.id} className="card p-4 mb-3" style={{ opacity: fadeOpacity }}>
        {/* Top row: title + step indicator */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <p className="font-medium text-text truncate">{m.request_title ?? 'Request'}</p>
            <p className="text-sm text-text-muted mt-0.5">
              {m.responder_name ? (
                <>
                  Helper:{' '}
                  <button
                    className="font-medium text-primary hover:underline"
                    onClick={() => setSelectedProfileUserId(m.responder_id)}
                  >
                    {m.responder_name}
                  </button>
                </>
              ) : (
                'Waiting for helper'
              )}
            </p>
          </div>
          <StepIndicator status={m.status} />
        </div>
        {m.admin_proposed && (
          <p className="text-xs text-teal-700 font-medium mt-1">
            Suggested by your community admin
          </p>
        )}
        {/* Conversation widget: below status indicator, above footer actions */}
        {showConversation && currentUserId && (
          <ExpandableConversation
            matchId={m.id}
            otherUserName={m.responder_name ?? 'Helper'}
            currentUserId={currentUserId}
          />
        )}
        {/* Footer actions: right-aligned */}
        {m.status === 'proposed' && m.admin_proposed && (
          <p className="text-xs text-text-muted text-right mt-3">
            Waiting for {m.responder_name ?? 'suggested helper'} to respond
          </p>
        )}
        {m.status === 'proposed' && !m.admin_proposed && (
          <div className="flex justify-end gap-2 mt-3">
            <button
              className="text-xs py-1 px-2 rounded bg-green-100 text-green-700 hover:bg-green-200 disabled:opacity-50"
              disabled={actioning === m.id}
              onClick={() => handleAccept(m.id, 'requested')}
            >
              Accept
            </button>
            <button
              className="text-xs py-1 px-2 rounded bg-red-100 text-red-700 hover:bg-red-200 disabled:opacity-50"
              disabled={actioning === m.id}
              onClick={() => handleDecline(m.id, 'requested')}
            >
              Decline
            </button>
          </div>
        )}
        {m.status === 'matched' && !m.requester_done_at && (
          <div className="flex justify-end mt-3">
            <button
              className="btn-primary text-sm py-1 px-3 disabled:opacity-50"
              disabled={markingDone === m.id}
              onClick={() => handleConfirmDone(m.id)}
            >
              {markingDone === m.id ? 'Saving…' : 'Confirm Done'}
            </button>
          </div>
        )}
        {pendingRatingId === m.id && (
          <RatingPrompt onRate={(rating) => handleRate(m, rating)} />
        )}
        {m.status === 'matched' && m.requester_done_at && pendingRatingId !== m.id && (
          <p className="text-xs text-text-muted text-right mt-3">Waiting for helper to confirm</p>
        )}
      </div>
    )
  }

  function groupAndSort(matches: Match[]) {
    const sorted = sortByActionPriority(matches)
    return {
      proposed: sorted.filter((m) => m.status === 'proposed'),
      matched: sorted.filter((m) => m.status === 'matched'),
      completed: sorted.filter((m) => m.status === 'completed'),
    }
  }

  const helpingGroups = groupAndSort(
    helping.filter((m) => m.status !== 'proposed' || m.admin_proposed)
  )
  const requestedGroups = groupAndSort(requested)

  return (
    <div className="max-w-2xl mx-auto px-4 py-4 space-y-8">
      {/* BUG-015: decisions you owe, server-ranked, at the top of Helping. */}
      <DecisionBand decisions={decisions} onResolved={handleDecisionResolved} />
      {actionError && (
        <div className="flex items-start justify-between gap-3 px-4 py-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
          <span>{actionError}</span>
          <button
            className="shrink-0 text-red-400 hover:text-red-600"
            onClick={() => setActionError(null)}
            aria-label="Dismiss"
          >
            ✕
          </button>
        </div>
      )}
      {/* I'm Helping */}
      <section>
        <h2 className="section-heading mb-3">I&apos;m Helping</h2>
        {offeredAwaiting.count > 0 && (
          <div className="kq-action-band mb-4">
            <h3 className="text-sm font-semibold text-text">Offers awaiting requester</h3>
            <p className="text-sm text-text-muted mt-1">Waiting for the requester to respond.</p>
            <ul className="mt-3 divide-y divide-border">
              {offeredAwaiting.items.map((item) => (
                <li key={item.match_id}>
                  <Link
                    href={`/requests/${item.request_id}`}
                    className="flex items-center justify-between gap-3 py-2 hover:bg-surface-raised transition-colors rounded"
                  >
                    <span className="text-sm text-text truncate">{item.title}</span>
                    {item.community_name && (
                      <span className="text-xs text-text-muted shrink-0">{item.community_name}</span>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
            {offeredAwaiting.count > offeredAwaiting.items.length && (
              <p className="text-xs text-text-muted mt-2">
                Showing the most recent {offeredAwaiting.items.length} of {offeredAwaiting.count}.
              </p>
            )}
          </div>
        )}
        {helpingGroups.proposed.length === 0 &&
        helpingGroups.matched.length === 0 &&
        helpingGroups.completed.length === 0 &&
        offeredAwaiting.count === 0 ? (
          <EmptyState
            heading="No active commitments"
            body="Browse requests to find someone to help."
          />
        ) : (
          <>
            <SectionBlock
              label="Awaiting Acceptance"
              items={helpingGroups.proposed}
              renderItem={renderHelpingCard}
            />
            <SectionBlock
              label="In Progress"
              items={helpingGroups.matched}
              renderItem={renderHelpingCard}
            />
            <SectionBlock
              label="Completed"
              items={helpingGroups.completed}
              renderItem={renderHelpingCard}
            />
          </>
        )}
      </section>

      {/* I Asked For Help */}
      <section>
        <h2 className="section-heading mb-3">I Asked For Help</h2>

        {/* Offers Received: open requests with pending provider offers */}
        {myOpenRequests.map((req) => {
          const pendingOffers = (offersByRequest[req.id] ?? []).filter(
            (o: any) => o.status === 'pending'
          )
          const isDibsPending = req.status === 'dibs_pending'
          if (pendingOffers.length === 0 && !isDibsPending) return null
          return (
            <div key={req.id} className="card p-4 mb-3">
              <div className="flex items-center gap-2 min-w-0">
                <p className="font-medium text-text truncate flex-1">{req.title ?? 'Request'}</p>
                {isDibsPending && (
                  <span className="shrink-0 text-xs font-medium bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">
                    First refusal sent
                  </span>
                )}
              </div>
              {pendingOffers.length > 0 && (
              <p className="text-xs font-semibold text-text-muted uppercase tracking-wide mt-2 mb-2">
                Offers Received
              </p>
              )}
              {pendingOffers.length > 0 && (
                offersLoading[req.id] ? (
                  <p className="text-xs text-text-muted">Loading offers…</p>
                ) : (
                  pendingOffers.map((offer: any) => (
                    <div key={offer.id} className="flex items-start justify-between gap-4 py-2 border-t border-border first:border-t-0">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-text">{offer.provider_email}</p>
                        <p className="text-xs text-text-muted">
                          {offer.price ? `$${offer.price}` : 'Price TBD'}
                        </p>
                        {offer.note && (
                          <p className="text-xs text-text-muted mt-0.5 italic">{offer.note}</p>
                        )}
                      </div>
                      <div className="flex gap-2 shrink-0">
                        <button
                          className="text-xs py-1 px-2 rounded bg-green-100 text-green-700 hover:bg-green-200 disabled:opacity-50"
                          disabled={offerActioning === offer.id}
                          onClick={() => handleAcceptProviderOffer(offer.id, req.id)}
                        >
                          {offerActioning === offer.id ? '…' : 'Accept'}
                        </button>
                        <button
                          className="text-xs py-1 px-2 rounded bg-red-100 text-red-700 hover:bg-red-200 disabled:opacity-50"
                          disabled={offerActioning === offer.id}
                          onClick={() => handleDeclineProviderOffer(offer.id, req.id)}
                        >
                          {offerActioning === offer.id ? '…' : 'Decline'}
                        </button>
                      </div>
                    </div>
                  ))
                )
              )}
            </div>
          )
        })}

        {requested.length === 0 && myOpenRequests.every((req) => {
          const pendingOffers = (offersByRequest[req.id] ?? []).filter((o: any) => o.status === 'pending')
          return pendingOffers.length === 0 && req.status !== 'dibs_pending'
        }) ? (
          <EmptyState
            heading="No matched requests"
            body="Post a request and accept an offer to see it here."
          />
        ) : requested.length > 0 ? (
          <>
            <SectionBlock
              label="Needs Your Response"
              items={requestedGroups.proposed}
              renderItem={renderRequestedCard}
            />
            <SectionBlock
              label="In Progress"
              items={requestedGroups.matched}
              renderItem={renderRequestedCard}
            />
            <SectionBlock
              label="Completed"
              items={requestedGroups.completed}
              renderItem={renderRequestedCard}
            />
          </>
        ) : null}
      </section>

      {selectedProfileUserId && (
        <TrustCard
          userId={selectedProfileUserId}
          onClose={() => setSelectedProfileUserId(null)}
        />
      )}
    </div>
  )
}
