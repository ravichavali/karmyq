import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { requestService, dibsService, reputationService } from '@/lib/api'
import { getOffersForRequest, acceptOffer, declineOffer } from '@/lib/api/providerApi'
import EmptyState from './EmptyState'
import { sortByActionPriority } from '../utils/commitmentSort'
import ExpandableConversation from './ExpandableConversation'
import { TrustCard } from './TrustCard'
import DibsCard from './commitments/DibsCard'

interface Match {
  id: string
  request_id: string
  responder_id: string
  requester_id?: string
  status: string
  created_at: string
  request_title?: string
  requester_name?: string
  responder_name?: string
  admin_proposed?: boolean
  requester_done_at?: string | null
  responder_done_at?: string | null
}

interface PendingDibs {
  id: string
  requestTitle: string
  scheduledFor: string
  expiresAt: string
  requesterName?: string
}

// ── Rating prompt ─────────────────────────────────────────────────────────────

function RatingPrompt({ onRate }: { onRate: (rating: number | null) => void }) {
  const [hovered, setHovered] = useState(0)
  return (
    <div className="flex items-center justify-end gap-3 mt-3">
      <span className="text-xs text-text-muted">Rate this exchange:</span>
      <div className="flex gap-0.5">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            className="text-base leading-none text-amber-400 hover:text-amber-500 transition-colors"
            onMouseEnter={() => setHovered(star)}
            onMouseLeave={() => setHovered(0)}
            onClick={() => onRate(star)}
          >
            {star <= hovered ? '★' : '☆'}
          </button>
        ))}
      </div>
      <button
        className="text-xs text-text-muted hover:text-text underline underline-offset-2"
        onClick={() => onRate(null)}
      >
        Skip
      </button>
    </div>
  )
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
  const [helping, setHelping] = useState<Match[]>([])
  const [requested, setRequested] = useState<Match[]>([])
  const [myOpenRequests, setMyOpenRequests] = useState<any[]>([])
  const [offersByRequest, setOffersByRequest] = useState<Record<string, any[]>>({})
  const [offersLoading, setOffersLoading] = useState<Record<string, boolean>>({})
  const [pendingDibs, setPendingDibs] = useState<PendingDibs[]>([])
  const [loading, setLoading] = useState(true)
  const [markingDone, setMarkingDone] = useState<string | null>(null)
  const [pendingRatingId, setPendingRatingId] = useState<string | null>(null)
  const [actioning, setActioning] = useState<string | null>(null)
  const [offerActioning, setOfferActioning] = useState<string | null>(null)
  const [currentUserId, setCurrentUserId] = useState<string>('')
  const [selectedProfileUserId, setSelectedProfileUserId] = useState<string | null>(null)

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

  useEffect(() => {
    const userData = typeof window !== 'undefined' ? localStorage.getItem('user') : null
    let currentUser = null
    try { currentUser = userData ? JSON.parse(userData) : null } catch { currentUser = null }
    if (!currentUser) return
    setCurrentUserId(currentUser.id ?? '')

    // Fetch pending dibs for provider (non-blocking — errors are silently ignored)
    dibsService.getPendingDibsForProvider().then((res) => {
      const items: any[] = res.data ?? []
      const mapped = items.map((d: any) => ({
        id: d.id,
        requestTitle: d.request_title ?? d.requestTitle ?? 'Request',
        scheduledFor: d.scheduled_for ?? d.scheduledFor ?? '',
        expiresAt: d.expires_at ?? d.expiresAt ?? '',
        requesterName: d.requester_name ?? d.requesterName ?? undefined,
      }))
      setPendingDibs(mapped)
      onDibsLoaded?.(mapped.length)
    }).catch(() => {
      // Dibs fetch is optional; do not surface errors to the user
    })

    requestService.getMatches({ user_id: currentUser.id, limit: 200 }).then((res) => {
      const allMatches: Match[] = res.data?.matches ?? []
      return requestService.getRequests({ requester_id: currentUser.id, limit: 100 }).then((reqRes) => {
        const myRequests: any[] = reqRes.data?.requests ?? []
        const myRequestIds = new Set(myRequests.map((r: any) => r.id))

        const helpingMatches = allMatches.filter(
          (m) => m.responder_id === currentUser.id && !myRequestIds.has(m.request_id)
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
  }, [])

  const handleMarkDone = async (matchId: string) => {
    const userData = typeof window !== 'undefined' ? localStorage.getItem('user') : null
    let currentUser = null
    try { currentUser = userData ? JSON.parse(userData) : null } catch { currentUser = null }
    if (!currentUser) return

    setMarkingDone(matchId)
    try {
      const res = await requestService.completeMatch(matchId, currentUser.id)
      const { fully_completed } = res.data?.data ?? res.data ?? {}
      const now = new Date().toISOString()
      setHelping((prev) => prev.map((m) => m.id === matchId
        ? fully_completed
          ? { ...m, status: 'completed', responder_done_at: now }
          : { ...m, responder_done_at: now }
        : m
      ))
      setPendingRatingId(matchId)
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to mark done')
    } finally {
      setMarkingDone(null)
    }
  }

  const handleConfirmDone = async (matchId: string) => {
    const userData = typeof window !== 'undefined' ? localStorage.getItem('user') : null
    let currentUser = null
    try { currentUser = userData ? JSON.parse(userData) : null } catch { currentUser = null }
    if (!currentUser) return

    setMarkingDone(matchId)
    try {
      const res = await requestService.completeMatch(matchId, currentUser.id)
      const { fully_completed } = res.data?.data ?? res.data ?? {}
      const now = new Date().toISOString()
      setRequested((prev) => prev.map((m) => m.id === matchId
        ? fully_completed
          ? { ...m, status: 'completed', requester_done_at: now }
          : { ...m, requester_done_at: now }
        : m
      ))
      setPendingRatingId(matchId)
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to confirm done')
    } finally {
      setMarkingDone(null)
    }
  }

  const handleRate = async (match: Match, rating: number | null) => {
    if (rating !== null && communityId) {
      const isHelper = match.responder_id === currentUserId
      const toUserId = isHelper ? match.requester_id : match.responder_id
      if (toUserId) {
        try {
          await reputationService.submitFeedback({
            match_id: match.id,
            to_user_id: toUserId,
            community_id: communityId,
            rating,
          })
        } catch {
          // Silently ignore — feedback is best-effort
        }
      }
    }
    setPendingRatingId(null)
  }

  const handleAccept = async (matchId: string, side: 'helping' | 'requested') => {
    setActioning(matchId)
    try {
      const userData = typeof window !== 'undefined' ? localStorage.getItem('user') : null
      let currentUser = null
      try { currentUser = userData ? JSON.parse(userData) : null } catch { currentUser = null }
      if (!currentUser) return

      await requestService.acceptMatch(matchId, currentUser.id)

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
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to accept offer')
    } finally {
      setActioning(null)
    }
  }

  const handleDecline = async (matchId: string, side: 'helping' | 'requested') => {
    setActioning(matchId)
    try {
      const userData = typeof window !== 'undefined' ? localStorage.getItem('user') : null
      let currentUser = null
      try { currentUser = userData ? JSON.parse(userData) : null } catch { currentUser = null }
      if (!currentUser) return

      await requestService.rejectMatch(matchId, currentUser.id)

      if (side === 'helping') {
        setHelping((prev) => prev.filter((m) => m.id !== matchId))
      } else {
        setRequested((prev) => prev.filter((m) => m.id !== matchId))
      }
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to decline offer')
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
      alert(err.response?.data?.message || 'Failed to accept offer')
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
      alert(err.response?.data?.message || 'Failed to decline offer')
    } finally {
      setOfferActioning(null)
    }
  }

  const handleAcceptDibs = async (dibsId: string) => {
    try {
      await dibsService.acceptDibs(dibsId)
      // Optimistic: remove from list on success
      setPendingDibs((prev) => prev.filter((d) => d.id !== dibsId))
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to accept dibs invitation')
    }
  }

  const handleDeclineDibs = async (dibsId: string) => {
    try {
      await dibsService.declineDibs(dibsId)
      // Optimistic: remove from list on success
      setPendingDibs((prev) => prev.filter((d) => d.id !== dibsId))
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to decline dibs invitation')
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
    return (
      <div key={m.id} className="card p-4 mb-3">
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
        {m.status === 'proposed' && (
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
    return (
      <div key={m.id} className="card p-4 mb-3">
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
        {m.status === 'proposed' && (
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

  const helpingGroups = groupAndSort(helping)
  const requestedGroups = groupAndSort(requested)

  return (
    <div className="max-w-2xl mx-auto px-4 py-4 space-y-8">
      {/* Dibs Requests — shown first so provider can't miss them */}
      {pendingDibs.length > 0 && (
        <section>
          <h3 className="text-sm font-semibold text-amber-700 uppercase tracking-wide mb-3 flex items-center gap-1.5">
            <span>⏳</span> First Dibs — Respond Before Time Runs Out
          </h3>
          {pendingDibs.map((dibs) => (
            <DibsCard
              key={dibs.id}
              requestTitle={dibs.requestTitle}
              scheduledFor={dibs.scheduledFor}
              expiresAt={dibs.expiresAt}
              requesterName={dibs.requesterName}
              onAccept={() => handleAcceptDibs(dibs.id)}
              onDecline={() => handleDeclineDibs(dibs.id)}
            />
          ))}
        </section>
      )}

      {/* I'm Helping */}
      <section>
        <h2 className="section-heading mb-3">I&apos;m Helping</h2>
        {helping.length === 0 ? (
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
