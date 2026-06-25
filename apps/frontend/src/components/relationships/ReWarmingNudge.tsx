import { useEffect, useState } from 'react'
import { socialGraphService } from '@/lib/api'

/** A bond that has decayed to the nearly-forgotten tier — about to be swept. */
export interface FadingRelationship {
  peerId: string
  peerName: string
  // Sprint 112 (ADR-082): exact edge weight removed; decayTier conveys the nearly-forgotten state.
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
 * Sprint 90 / ADR-070 — surfaces bonds that have gone quiet enough to be nearly forgotten, so the
 * member can see what is close to being let go. Renders NOTHING when there are none (no empty-state
 * placeholder).
 *
 * NOTE (2026-06-16): the per-peer "Reconnect" action was removed. It linked to `/messages?to=<peerId>`,
 * a route that never existed — Karmyq messaging is match-anchored (a conversation only exists via a
 * help exchange), so there is no peer-to-peer DM to land on. The card is informational until a real
 * reconnect destination exists; restore a CTA here once peer messaging (or a directed-ask flow) ships.
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
    <section className={`kq-card border-l-4 border-l-primary ${className}`} aria-label="Bonds close to being let go">
      <p className="kq-section-label !mt-0">Close to being let go</p>
      <ul className="grid gap-3">
        {fading.map((rel) => (
          <li key={rel.peerId} className="min-w-0">
            <p className="text-sm text-text">
              You and <span className="font-semibold">{rel.peerName}</span> have a bond that is close to
              fading from active memory. Helping each other again would keep it alive — or you can let
              it fade.
            </p>
            <p className="kq-quiet-meta">
              {rel.lastInteractionAt
                ? `Last connected ${new Date(rel.lastInteractionAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
                : 'It has been a while'}
            </p>
          </li>
        ))}
      </ul>
    </section>
  )
}
