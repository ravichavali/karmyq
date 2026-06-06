import { useState } from 'react'
import { requestService } from '@/lib/api'
import RequestPayloadRenderer from '@/components/Feed/RequestPayloadRenderer'
import TrustPathBadge, { TrustPathBadgeSkeleton } from '@/components/TrustPathBadge'
import { useTrustPath } from '@/hooks/useTrustPath'
import { isBoostActive } from '@/utils/boost'
import { describeMatchSignal } from '@/utils/matchSignal'
import type { RequestCardData, RequestStatusToken, UrgencyLevel } from '@/types/unified-feed'

/**
 * The ONE canonical request card (Sprint 85 / ADR-066). Used wherever a help request is shown —
 * absorbs the trust-path + Karma signals, the canonical status token, the explainable match
 * score, the polymorphic payload (commitment legibility), and the inline Offer-to-Help action.
 */

const URGENCY_COLORS: Record<UrgencyLevel, string> = {
  urgent: 'text-red-600 bg-red-50',
  high: 'text-orange-600 bg-orange-50',
  medium: 'text-amber-600 bg-amber-50',
  low: 'text-text-muted bg-surface-raised',
}

const TYPE_LABELS: Record<string, string> = {
  generic: 'Everyday help',
  ride: 'Ride',
  service: 'Service',
  event: 'Event',
  borrow: 'Borrow',
}

// Member-facing status labels. 'proposed' is the awaiting-acceptance state (ADR-066 Principle 6).
const STATUS_LABELS: Record<RequestStatusToken, string> = {
  open: 'Open',
  proposed: 'Awaiting response',
  matched: 'Matched',
  dibs_pending: 'Reserved',
  completed: 'Completed',
  cancelled: 'Cancelled',
}

function RequestTrustBadge({ requesterId }: { requesterId?: string }) {
  const { trustPath, loading } = useTrustPath(requesterId)
  if (loading) return <TrustPathBadgeSkeleton compact />
  if (!trustPath) return null
  return <TrustPathBadge trustPath={trustPath} compact presentation="feed" />
}

interface RequestCardProps {
  data: RequestCardData
  currentUserId?: string | null
  /** Called after a successful offer so the container can optimistically remove the card. */
  onOffered?: (requestId: string) => void
}

export default function RequestCard({ data, currentUserId, onOffered }: RequestCardProps) {
  const [offering, setOffering] = useState(false)
  const [offered, setOffered] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isOwnRequest = !!currentUserId && data.requester_id === currentUserId
  const matchSignal = describeMatchSignal(data.match_score, data.match_reason)

  const handleOffer = async () => {
    if (!currentUserId) return
    setOffering(true)
    setError(null)
    try {
      await requestService.createMatch({ request_id: data.request_id, responder_id: currentUserId })
      setOffered(true)
      onOffered?.(data.request_id)
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'Failed to offer help')
    } finally {
      setOffering(false)
    }
  }

  return (
    <article className="feed-card kq-card">
      {data.requester_id && (
        <div className="mb-3 flex items-center gap-2">
          <RequestTrustBadge requesterId={data.requester_id} />
        </div>
      )}

      <div className="flex items-start gap-3 mb-3">
        <div className="w-9 h-9 rounded-full bg-primary text-white flex items-center justify-center text-sm font-semibold shrink-0">
          {data.author_name?.charAt(0).toUpperCase() ?? '?'}
        </div>
        <div className="min-w-0">
          <span className="text-sm font-medium text-text block truncate">{data.author_name ?? 'Community member'}</span>
          {data.community_name && <span className="kq-quiet-meta block">{data.community_name}</span>}
        </div>
      </div>

      <h3 className="mb-2 text-[22px] leading-snug font-semibold text-text" style={{ fontFamily: "'Fraunces', Georgia, serif" }}>
        {data.title}
      </h3>

      {isBoostActive(data) && (
        <span className="inline-block text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium mb-3">
          Community pick
        </span>
      )}

      {data.description && (
        <p className="text-sm text-text-muted mb-4 line-clamp-2">{data.description}</p>
      )}

      {/* ADR-067: render payload off the fine `payload_type` (from DB category), not the coarse
          `request_type` enum. Renderer no-ops on an unmapped type / empty payload (safe fallback). */}
      {data.payload_type && data.payload && (
        <RequestPayloadRenderer
          type={data.payload_type}
          payload={data.payload}
          requirements={data.requirements}
          preferredStartDate={data.preferred_start_date}
          className="mb-3"
        />
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex items-center gap-2 flex-wrap">
          {data.request_type && (
            <span className="kq-pill">
              {TYPE_LABELS[data.request_type] ?? data.request_type}
            </span>
          )}
          {data.urgency && (
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${URGENCY_COLORS[data.urgency] ?? 'text-text-muted bg-surface-raised'}`}>
              {data.urgency}
            </span>
          )}
          <span className="text-xs px-2 py-0.5 rounded-full bg-surface-raised text-text-muted" title={data.status}>
            {STATUS_LABELS[data.status] ?? data.status}
          </span>
        </div>
        {!isOwnRequest && (
          offered ? (
            <a
              href="/dashboard?tab=helping"
              className="text-sm font-medium text-primary underline underline-offset-2 hover:no-underline shrink-0"
            >
              Offer sent → Track in Helping
            </a>
          ) : (
            <button
              onClick={handleOffer}
              disabled={offering}
              className="btn-primary text-sm py-1.5 px-4 disabled:opacity-50 shrink-0"
            >
              {offering ? 'Offering…' : 'Offer to Help'}
            </button>
          )
        )}
      </div>

      {matchSignal && <p className="kq-quiet-meta mt-3">{matchSignal}</p>}
      {error && <p className="text-xs text-red-600 mt-2">{error}</p>}
    </article>
  )
}
