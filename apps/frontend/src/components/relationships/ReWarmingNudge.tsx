import { useEffect, useState } from 'react'
import Link from 'next/link'
import { socialGraphService } from '@/lib/api'

/** A bond that has decayed to the nearly-forgotten tier — about to be swept. */
export interface FadingRelationship {
  peerId: string
  peerName: string
  currentWeight: number
  decayTier: 'nearly_forgotten'
  lastInteractionAt: string | null
  matchCompletedCount: number
}

interface ReWarmingNudgeProps {
  communityId: string
  /** Optional pre-fetched list (e.g. from the profile Memory section) to avoid a second request. */
  relationships?: FadingRelationship[]
  className?: string
}

/**
 * Sprint 90 / ADR-070 — the re-warming nudge. When a once-strong bond has gone quiet enough to be
 * nearly forgotten, gently invite the member to reconnect before it fades. Renders NOTHING when there
 * are no nearly-forgotten bonds (no empty-state placeholder).
 */
export default function ReWarmingNudge({ communityId, relationships, className = '' }: ReWarmingNudgeProps) {
  const [fading, setFading] = useState<FadingRelationship[] | null>(relationships ?? null)

  useEffect(() => {
    if (relationships) {
      setFading(relationships)
      return
    }
    let active = true
    socialGraphService
      .getFadingRelationships(communityId)
      .then((res: any) => {
        if (active) setFading(res.data ?? [])
      })
      .catch(() => {
        if (active) setFading([])
      })
    return () => {
      active = false
    }
  }, [communityId, relationships])

  // Suppress entirely when there is nothing fading — no broken-looking empty card.
  if (!fading || fading.length === 0) return null

  return (
    <section className={`kq-card border-l-4 border-l-primary ${className}`} aria-label="Relationships to re-warm">
      <p className="kq-section-label !mt-0">Before it fades</p>
      <ul className="grid gap-3">
        {fading.map((rel) => (
          <li key={rel.peerId} className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm text-text">
                You and <span className="font-semibold">{rel.peerName}</span> used to help each other
                {rel.matchCompletedCount > 1 ? ' often' : ''} — reconnect before it fades.
              </p>
              <p className="kq-quiet-meta">
                {rel.lastInteractionAt
                  ? `Last connected ${new Date(rel.lastInteractionAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
                  : 'It has been a while'}
              </p>
            </div>
            <Link
              href={`/messages?to=${encodeURIComponent(rel.peerId)}`}
              className="kq-pill flex-none border-primary-medium bg-primary-light text-primary-dark hover:opacity-90"
            >
              Reconnect
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}
