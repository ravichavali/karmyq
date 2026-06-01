/**
 * DibsPrompt — Modal shown after creating a scheduled request when a trusted
 * provider candidate is available. Lets the requester send a private dibs
 * invitation or skip and post publicly.
 */

import React, { useState } from 'react'
import TrustPathBadge, { TrustPath } from '../TrustPathBadge'

export interface DibsCandidate {
  providerUserId: string
  displayName: string
  score: number
  trustScore: number
  priorInteractions: number
  trustGraphConnection: 'direct' | 'indirect' | 'none'
  trustPath: TrustPath | null
}

interface DibsPromptProps {
  candidate: DibsCandidate
  requestId: string
  scheduledFor: string
  expiresAt: string
  onSend: () => Promise<void>
  onSkip: () => void
}

/**
 * Format a dibs window duration from now to expiresAt.
 * Returns a string like "~2h 30m" or "~45m".
 */
function formatWindow(expiresAt: string): string {
  const ms = new Date(expiresAt).getTime() - Date.now()
  if (ms <= 0) return 'expired'
  const totalMinutes = Math.round(ms / 60_000)
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  if (hours > 0 && minutes > 0) return `~${hours}h ${minutes}m`
  if (hours > 0) return `~${hours}h`
  return `~${minutes}m`
}

function trustContextSummary(
  priorInteractions: number,
  trustGraphConnection: 'direct' | 'indirect' | 'none'
): string {
  const parts: string[] = []
  if (priorInteractions > 0) {
    parts.push(`${priorInteractions} prior exchange${priorInteractions === 1 ? '' : 's'}`)
  }
  if (trustGraphConnection === 'direct') {
    parts.push('direct connection')
  } else if (trustGraphConnection === 'indirect') {
    parts.push('indirect connection')
  }
  if (parts.length === 0) return 'New connection'
  return parts.join(' · ')
}

export default function DibsPrompt({
  candidate,
  requestId: _requestId,
  scheduledFor,
  expiresAt,
  onSend,
  onSkip,
}: DibsPromptProps) {
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSend = async () => {
    if (sending || sent) return
    try {
      setSending(true)
      setError(null)
      await onSend()
      setSent(true)
    } catch (err) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setError((err as any)?.response?.data?.message ?? 'Failed to send dibs. Try again.')
    } finally {
      setSending(false)
    }
  }

  const scheduledLabel = new Date(scheduledFor).toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })

  const windowLabel = formatWindow(expiresAt)

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/50 z-[59]" onClick={onSkip} />

      {/* Modal */}
      <div className="fixed inset-0 z-[60] flex items-end md:items-center justify-center p-0 md:p-4">
        <div className="bg-surface w-full md:max-w-md md:rounded-2xl rounded-t-2xl shadow-xl flex flex-col">

          {/* Header */}
          <div className="px-5 py-4 border-b border-border">
            <h2 className="text-lg font-semibold text-text">Offer First Dibs?</h2>
            <p className="text-sm text-text-muted mt-0.5">
              A trusted provider can get an exclusive window to accept your request before it goes public.
            </p>
          </div>

          {/* Candidate details */}
          <div className="px-5 py-4 space-y-3">
            <div className="bg-primary-light border border-primary-medium rounded-lg p-4 space-y-2">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-full bg-primary flex items-center justify-center text-white font-semibold text-sm">
                  {candidate.displayName ? candidate.displayName.charAt(0).toUpperCase() : 'P'}
                </div>
                <div>
                  <p className="font-medium text-text">{candidate.displayName || 'A trusted provider'}</p>
                  {candidate.trustPath ? (
                    <TrustPathBadge trustPath={candidate.trustPath} className="mt-2" />
                  ) : (
                    <p className="text-xs text-text-muted">
                      {trustContextSummary(candidate.priorInteractions, candidate.trustGraphConnection)}
                    </p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="bg-surface rounded-lg px-3 py-2">
                  <p className="text-text-subtle text-xs mb-0.5">Trust score</p>
                  <p className="font-semibold text-text">{Math.round(candidate.trustScore)}</p>
                </div>
                <div className="bg-surface rounded-lg px-3 py-2">
                  <p className="text-text-subtle text-xs mb-0.5">Past interactions</p>
                  <p className="font-semibold text-text">{candidate.priorInteractions}</p>
                </div>
              </div>
            </div>

            <div className="text-sm text-text-muted space-y-1">
              <p>
                <span className="font-medium text-text">Scheduled:</span> {scheduledLabel}
              </p>
              <p>
                <span className="font-medium text-text">Dibs window:</span> {windowLabel}
              </p>
            </div>

            {error && (
              <p className="text-sm text-error bg-error/10 rounded-lg px-3 py-2">{error}</p>
            )}

            {sent && (
              <p className="text-sm text-success bg-success-light rounded-lg px-3 py-2">
                Dibs sent! The provider has been notified.
              </p>
            )}
          </div>

          {/* Actions */}
          <div className="px-5 py-4 border-t border-border flex flex-col gap-2">
            {!sent ? (
              <>
                <button
                  className="btn-primary w-full"
                  onClick={handleSend}
                  disabled={sending}
                >
                  {sending ? 'Sending…' : 'Send Dibs'}
                </button>
                <button
                  className="btn-ghost w-full"
                  onClick={onSkip}
                >
                  Post Publicly
                </button>
              </>
            ) : (
              <button
                className="btn-primary w-full"
                onClick={onSkip}
              >
                View My Asks
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
