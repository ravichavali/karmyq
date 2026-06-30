import { useEffect, useState } from 'react'
import type { RelationshipContext } from '@karmyq/shared'
import { requestService } from '@/lib/api'

/**
 * Sprint 116 / ADR-084 — the one cancel-safe fetcher behind every reciprocal relationship lens.
 *
 * The lens is request/offer-scoped: the server derives both participant IDs from the named resource,
 * so this hook never passes an arbitrary target user. Outcomes map to three visible states:
 *   - 200 with a context object → `data` set (render the lens)
 *   - 204 / 403 / 404           → suppressed (data null, error null → render nothing)
 *   - 5xx or transport failure  → `error: 'unavailable'` (render a small, non-blocking note)
 * The decision action (Offer/Accept/Decline/Submit) is never gated on this hook.
 */
export type RelationshipContextTarget =
  | { kind: 'request'; requestId: string }
  | { kind: 'match'; requestId: string; matchId: string }
  | { kind: 'provider-offer'; requestId: string; offerId: string }

export interface RelationshipContextResult {
  data: RelationshipContext | null
  loading: boolean
  error: 'unavailable' | null
}

function fetchFor(target: RelationshipContextTarget) {
  switch (target.kind) {
    case 'request':
      return requestService.getRequestRelationshipContext(target.requestId)
    case 'match':
      return requestService.getMatchRelationshipContext(target.requestId, target.matchId)
    case 'provider-offer':
      return requestService.getProviderOfferRelationshipContext(target.requestId, target.offerId)
  }
}

// A stable scalar key so the effect re-fetches only when the resolved target actually changes,
// not on every parent re-render that rebuilds the props object.
function targetKey(target: RelationshipContextTarget): string {
  switch (target.kind) {
    case 'request':
      return `request:${target.requestId}`
    case 'match':
      return `match:${target.requestId}:${target.matchId}`
    case 'provider-offer':
      return `provider-offer:${target.requestId}:${target.offerId}`
  }
}

export function useRelationshipContext(
  target: RelationshipContextTarget
): RelationshipContextResult {
  const [data, setData] = useState<RelationshipContext | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<'unavailable' | null>(null)
  const key = targetKey(target)

  useEffect(() => {
    let stale = false
    setLoading(true)
    setError(null)
    setData(null)
    fetchFor(target)
      .then((res: any) => {
        if (stale) return
        const context = res?.data
        // 204/empty bodies arrive as a falsy or non-object payload — treat as "no context".
        setData(context && typeof context === 'object' ? (context as RelationshipContext) : null)
      })
      .catch((err: any) => {
        if (stale) return
        const status = err?.response?.status
        // 403/404 are authorization/lifecycle outcomes that simply hide the panel; a missing status
        // (timeout / network) and any 5xx surface the small unavailable note.
        if (status === undefined || status >= 500) setError('unavailable')
      })
      .finally(() => {
        if (!stale) setLoading(false)
      })
    return () => {
      stale = true
    }
    // `target` is re-derived from `key`; depending on the object itself would re-fetch every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  return { data, loading, error }
}
