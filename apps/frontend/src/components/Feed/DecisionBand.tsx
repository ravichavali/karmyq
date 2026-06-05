import { useState } from 'react'
import { requestService, dibsService } from '@/lib/api'
import { acceptOffer, declineOffer } from '@/lib/api/providerApi'
import RequestPayloadRenderer from './RequestPayloadRenderer'
import type { DecisionData, DecisionAction } from '@/types/unified-feed'

/**
 * The "needs your response" band (Sprint 85 / ADR-066) — the top of Dashboard Home. Surfaces the
 * decisions a member owes (server-ranked above browsable requests) and routes each action to the
 * SAME service call the Commitments tab uses, so there is one source of truth for the business
 * logic. Withdraw-Offer (responder) is wired to requestService.rejectMatch — the verify-locked
 * endpoint that allows both participants.
 */

const ACTION_LABELS: Record<DecisionAction, string> = {
  accept_offer: 'Accept',
  decline_offer: 'Decline',
  withdraw_offer: 'Withdraw',
  accept_dibs: 'Accept',
  decline_dibs: 'Decline',
  mark_done: 'Mark done',
}

// Primary (filled) vs secondary (text) action styling.
const PRIMARY_ACTIONS = new Set<DecisionAction>(['accept_offer', 'accept_dibs', 'mark_done'])

/**
 * Relationship label before the counterparty's name. A requester sees offers/dibs/matches coming
 * "From" a helper; a responder sees "Your offer to" the requester — except a dib is the requester's
 * first-ask TO the provider, so it reads "First ask from".
 */
function relationLabel(decision: DecisionData): string {
  if (decision.member_role === 'requester') return 'From'
  return decision.subject_kind === 'dibs' ? 'First ask from' : 'Your offer to'
}

/** Route a decision action to the canonical service call (shared with CommitmentsTab). */
function runDecisionAction(action: DecisionAction, subjectKind: DecisionData['subject_kind'], subjectId: string): Promise<unknown> {
  switch (action) {
    case 'accept_offer':
      return subjectKind === 'offer' ? acceptOffer(subjectId) : requestService.acceptMatch(subjectId)
    case 'decline_offer':
      return subjectKind === 'offer' ? declineOffer(subjectId) : requestService.rejectMatch(subjectId)
    case 'withdraw_offer':
      return requestService.rejectMatch(subjectId)
    case 'accept_dibs':
      return dibsService.acceptDibs(subjectId)
    case 'decline_dibs':
      return dibsService.declineDibs(subjectId)
    case 'mark_done':
      return requestService.completeMatch(subjectId)
  }
}

interface DecisionBandProps {
  decisions: DecisionData[]
  /** Called after an action resolves so the container can drop the row + refetch. */
  onResolved?: (subjectId: string) => void
}

export default function DecisionBand({ decisions, onResolved }: DecisionBandProps) {
  const [busy, setBusy] = useState<string | null>(null) // `${subject_id}:${action}`
  const [error, setError] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  const toggleExpanded = (subjectId: string) =>
    setExpanded((prev) => {
      const next = new Set(prev)
      next.has(subjectId) ? next.delete(subjectId) : next.add(subjectId)
      return next
    })

  // Empty band renders nothing — no "needs your response" chrome when there's nothing to respond to.
  if (decisions.length === 0) return null

  const handle = async (decision: DecisionData, action: DecisionAction) => {
    setBusy(`${decision.subject_id}:${action}`)
    setError(null)
    try {
      await runDecisionAction(action, decision.subject_kind, decision.subject_id)
      onResolved?.(decision.subject_id)
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'Action failed — try again')
    } finally {
      setBusy(null)
    }
  }

  return (
    <section aria-label="Needs your response" className="mb-4">
      <h2 className="text-sm font-semibold text-text mb-2">Needs your response</h2>
      <div className="space-y-2">
        {decisions.map((decision) => {
          const isExpanded = expanded.has(decision.subject_id)
          const canExpand = !!decision.description || !!(decision.payload_type && decision.payload)
          return (
            <div key={decision.subject_id} className="feed-card border-l-4 border-primary">
              <div className="flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => canExpand && toggleExpanded(decision.subject_id)}
                  aria-expanded={canExpand ? isExpanded : undefined}
                  className={`min-w-0 text-left flex-1 ${canExpand ? 'cursor-pointer' : 'cursor-default'}`}
                >
                  {/* spans (phrasing content) inside the <button> — block-level <p> would be invalid HTML */}
                  <span className="block text-sm font-medium text-text truncate flex items-center gap-1">
                    {canExpand && (
                      <span className={`text-text-subtle transition-transform ${isExpanded ? 'rotate-90' : ''}`} aria-hidden>›</span>
                    )}
                    {decision.title}
                  </span>
                  <span className="block text-xs text-text-muted truncate">
                    {relationLabel(decision)} {decision.counterparty_name}
                    {decision.community_name ? ` · ${decision.community_name}` : ''}
                  </span>
                </button>
                <div className="flex items-center gap-2 shrink-0">
                  {decision.actions.map((action) => (
                    <button
                      key={action}
                      onClick={() => handle(decision, action)}
                      disabled={busy !== null}
                      className={
                        PRIMARY_ACTIONS.has(action)
                          ? 'btn-primary text-sm py-1.5 px-3 disabled:opacity-50'
                          : 'text-sm py-1.5 px-3 text-text-muted hover:text-text disabled:opacity-50'
                      }
                    >
                      {busy === `${decision.subject_id}:${action}` ? '…' : ACTION_LABELS[action]}
                    </button>
                  ))}
                </div>
              </div>

              {isExpanded && canExpand && (
                <div className="mt-3 pt-3 border-t border-border">
                  {decision.description && (
                    <p className="text-sm text-text-muted mb-2">{decision.description}</p>
                  )}
                  {decision.payload_type && decision.payload && (
                    <RequestPayloadRenderer type={decision.payload_type} payload={decision.payload} />
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
      {error && <p className="text-xs text-red-600 mt-2">{error}</p>}
    </section>
  )
}
