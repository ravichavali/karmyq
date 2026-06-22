import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import Link from 'next/link'
import { requestService } from '@/lib/api'
import RequestPayloadRenderer from '@/components/Feed/RequestPayloadRenderer'
import EmptyState from '@/components/EmptyState'
import { getOfferActionLabel, getOfferErrorFallback } from '@/lib/requestActionCopy'
import { getRequestStatusDisplay, getRequestUrgencyDisplay } from '@/lib/requestDisplay'
import type { PayloadType } from '@/types/unified-feed'
import type { RequestPayload } from '@/types/request-payloads'

/**
 * Request Detail / Action page (Sprint 101).
 *
 * Replaces the old redirect shim. This is the canonical action surface: a community open-ask click
 * (or any /requests/[id] link) lands here and sees the ask plus the ONE true next step for them, in
 * the ask's current state. Eligibility is NOT guessed on the client — the server derives
 * `viewer_relation` (own_request | already_offered | can_offer | not_actionable) so we never show an
 * Offer button that would 403 on click.
 */

type ViewerRelation = 'own_request' | 'already_offered' | 'can_offer' | 'not_actionable'

interface RequestDetail {
  id: string
  requester_id?: string
  title: string
  description?: string
  status: string
  expired?: boolean
  urgency?: string
  request_type?: string
  requester_name?: string
  community_name?: string
  payload_type?: PayloadType
  payload?: RequestPayload | null
  requirements?: Record<string, string | number | boolean>
  viewer_relation: ViewerRelation
  viewer_match?: { id: string; status: string } | null
}

const TYPE_LABELS: Record<string, string> = {
  generic: 'Everyday help',
  ride: 'Ride',
  service: 'Service',
  event: 'Event',
  borrow: 'Borrow',
}

/** Lifecycle-true copy for a request that can't be offered on. Never says "open" for a closed ask. */
function finiteStateCopy(status: string, expired?: boolean): string {
  if (expired && status === 'open') return 'This ask has expired.'
  switch (status) {
    case 'completed': return 'This ask is completed.'
    case 'cancelled': return 'This ask was cancelled.'
    case 'matched': return 'This ask is already matched.'
    case 'dibs_pending': return 'This ask is reserved.'
    default: return 'This ask is no longer open.'
  }
}

export default function RequestDetailPage() {
  const router = useRouter()
  const [detail, setDetail] = useState<RequestDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [offering, setOffering] = useState(false)
  const [offered, setOffered] = useState(false)
  const [withdrawing, setWithdrawing] = useState(false)
  const [withdrawn, setWithdrawn] = useState(false)

  useEffect(() => {
    if (!router.isReady) return
    const id = router.query.id
    if (typeof id !== 'string') return
    let stale = false
    setLoading(true)
    setNotFound(false)
    requestService
      .getRequest(id)
      .then((res) => {
        if (stale) return
        setDetail(res.data as RequestDetail)
      })
      .catch((err: any) => {
        if (stale) return
        if (err?.response?.status === 404) setNotFound(true)
        else setError('Could not load this request.')
      })
      .finally(() => {
        if (!stale) setLoading(false)
      })
    return () => {
      stale = true
    }
  }, [router.isReady, router.query.id])

  const handleOffer = async () => {
    if (!detail) return
    setOffering(true)
    setError(null)
    try {
      // No responder_id — the server derives it from the JWT (ADR-064), so the offer never depends on
      // a present/valid localStorage.user (which a direct detail link may not have hydrated).
      await requestService.createMatch({ request_id: detail.id })
      setOffered(true)
    } catch (err: any) {
      setError(err?.response?.data?.message ?? getOfferErrorFallback(detail.request_type))
    } finally {
      setOffering(false)
    }
  }

  // S108: withdraw a pending self-offer from the ask itself (the offered-awaiting band and Home preview
  // link here). rejectMatch authorizes either participant on a proposed match, so the responder can
  // pull their own offer; once the requester has accepted (status 'matched') there is nothing to withdraw.
  const handleWithdraw = async () => {
    if (!detail?.viewer_match) return
    setWithdrawing(true)
    setError(null)
    try {
      await requestService.rejectMatch(detail.viewer_match.id)
      setWithdrawn(true)
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'Could not withdraw your offer — try again.')
    } finally {
      setWithdrawing(false)
    }
  }

  const backLink = (
    <Link href="/dashboard" className="text-sm text-primary">← Back to dashboard</Link>
  )

  if (loading) {
    return (
      <div className="kq-page py-10">
        <div className="kq-card animate-pulse">
          <div className="h-5 bg-border rounded w-2/3 mb-3" />
          <div className="h-3 bg-border rounded w-1/2" />
        </div>
      </div>
    )
  }

  if (notFound) {
    return (
      <div className="kq-page py-10">
        <EmptyState
          heading="Request not found"
          body="This ask may have been removed."
          ctaLabel="Back to dashboard"
          ctaHref="/dashboard"
        />
        {backLink}
      </div>
    )
  }

  if (error && !detail) {
    return (
      <div className="kq-page py-10">
        <EmptyState
          heading="Couldn't load this request"
          body={error}
          ctaLabel="Back to dashboard"
          ctaHref="/dashboard"
        />
        {backLink}
      </div>
    )
  }

  if (!detail) return null
  const statusDisplay = detail.status ? getRequestStatusDisplay(detail.status) : null
  const urgencyDisplay = getRequestUrgencyDisplay(detail.urgency)

  return (
    <>
      <Head>
        <title>{detail.title} · Karmyq</title>
      </Head>
      <div className="kq-page py-8">
        <div className="mb-4">{backLink}</div>

        <article className="kq-card">
          <div className="mb-2 flex items-center gap-2 flex-wrap">
            {detail.request_type && (
              <span className="kq-pill">{TYPE_LABELS[detail.request_type] ?? detail.request_type}</span>
            )}
            {statusDisplay && (
              <span className={`kq-pill border ${statusDisplay.className}`}>
                {statusDisplay.label}
              </span>
            )}
            {detail.urgency && (
              <span className={`kq-pill border ${urgencyDisplay.className}`}>
                {urgencyDisplay.label}
              </span>
            )}
          </div>

          <h1 className="kq-headline-sm mb-2">
            {detail.title}
          </h1>

          <p className="kq-quiet-meta mb-4">
            Asked by {detail.requester_name ?? 'a community member'}
            {detail.community_name ? ` · ${detail.community_name}` : ''}
          </p>

          {detail.description && <p className="text-sm text-text mb-4 whitespace-pre-line">{detail.description}</p>}

          {detail.payload_type && detail.payload && (
            <RequestPayloadRenderer
              type={detail.payload_type}
              payload={detail.payload}
              requirements={detail.requirements}
              className="mb-4"
            />
          )}

          {/* The one true next step for this member, in this state — derived server-side. */}
          <div className="mt-4 border-t border-border pt-4">
            {detail.viewer_relation === 'can_offer' && (
              offered ? (
                <p className="text-sm text-text">
                  Offer sent —{' '}
                  <Link href="/dashboard?tab=helping" className="text-primary font-medium underline underline-offset-2">
                    track it in Helping
                  </Link>
                  .
                </p>
              ) : (
                <button onClick={handleOffer} disabled={offering} className="btn-primary text-sm py-2 px-5 disabled:opacity-50">
                  {getOfferActionLabel(detail.request_type, offering ? 'pending' : 'idle')}
                </button>
              )
            )}

            {detail.viewer_relation === 'already_offered' && (
              withdrawn ? (
                <p className="text-sm text-text">Offer withdrawn. This ask is open again.</p>
              ) : (
                <div className="space-y-3">
                  <p className="text-sm text-text">
                    You’ve offered to help. Waiting for the requester to respond.{' '}
                    <Link href="/dashboard?tab=helping" className="text-primary font-medium underline underline-offset-2">
                      View in Helping
                    </Link>
                    .
                  </p>
                  {detail.viewer_match?.status === 'proposed' && (
                    <button
                      onClick={handleWithdraw}
                      disabled={withdrawing}
                      className="text-sm py-1.5 px-3 text-text-muted hover:text-text disabled:opacity-50"
                    >
                      {withdrawing ? 'Withdrawing…' : 'Withdraw offer'}
                    </button>
                  )}
                </div>
              )
            )}

            {detail.viewer_relation === 'own_request' && (
              <p className="text-sm text-text">
                This is your ask.{' '}
                <Link href="/dashboard?tab=asks" className="text-primary font-medium underline underline-offset-2">
                  Manage it in Asks
                </Link>
                .
              </p>
            )}

            {detail.viewer_relation === 'not_actionable' && (
              <p className="text-sm text-text-muted">{finiteStateCopy(detail.status, detail.expired)}</p>
            )}

            {error && <p className="text-xs text-error mt-2">{error}</p>}
          </div>
        </article>
      </div>
    </>
  )
}
