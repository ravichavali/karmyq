import { useEffect, useState } from 'react'
import { socialGraphService } from '@/lib/api'
import { decayPresentation } from '@/components/TrustPathBadge'
import ReWarmingNudge, { FadingRelationship } from '@/components/relationships/ReWarmingNudge'

type DecayTier = 'strong' | 'warm' | 'fading' | 'nearly_forgotten' | 'swept'

interface Relationship {
  peerId: string
  peerName: string
  currentWeight: number
  decayTier: DecayTier
  lastInteractionAt: string | null
  matchCompletedCount: number
}

interface MemoryData {
  activeCount: number
  fading: Relationship[]
  nearlyForgotten: Relationship[]
}

interface MemorySectionProps {
  communityId: string
  /** Optional karma trend label from the profile's karma data ('growing' | 'stable' | 'declining'). */
  karmaTrend?: string | null
}

/** Plain text label per tier, so fading never depends on opacity/hover alone (ADR-070). */
const DECAY_COPY: Record<DecayTier, string> = {
  strong: 'Active',
  warm: 'Warm',
  fading: 'Fading',
  nearly_forgotten: 'Nearly forgotten',
  swept: 'Let go',
}

/** Render a bond as a named chip, faded by its decayTier (same fade tokens as the trust faces). */
function RelationshipFace({ rel }: { rel: Relationship }) {
  const decay = decayPresentation(rel.decayTier)
  return (
    <span className={`kq-path-badge${decay.className}`} title={decay.title}>
      <span className="kq-path-avatar" aria-hidden="true">
        {rel.peerName.charAt(0).toUpperCase()}
      </span>
      <span>{rel.peerName}</span>
      <span className="text-[11px] font-medium text-text-muted">{DECAY_COPY[rel.decayTier]}</span>
    </span>
  )
}

const TREND_LABEL: Record<string, string> = {
  growing: '📈 Growing',
  stable: '➡️ Steady',
  declining: '📉 Easing',
}

/**
 * Sprint 90 / ADR-070 — the profile Memory section: what the platform holds for you and what is
 * quietly fading. Active relationships, the bonds going quiet, an optional karma trend, and a plain
 * line about what gets let go. Rows with no data are suppressed entirely — no empty placeholder tiles.
 */
export default function MemorySection({ communityId, karmaTrend }: MemorySectionProps) {
  const [data, setData] = useState<MemoryData | null>(null)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    if (!communityId) return
    let active = true
    socialGraphService
      .getRelationshipMemory(communityId)
      .then((res: any) => {
        if (active) setData(res.data ?? null)
      })
      .catch(() => {
        if (active) setData(null)
      })
      .finally(() => {
        if (active) setLoaded(true)
      })
    return () => {
      active = false
    }
  }, [communityId])

  if (!loaded || !data) return null

  const hasActive = data.activeCount > 0
  const hasFading = data.fading.length > 0
  const hasNearly = data.nearlyForgotten.length > 0
  const trend = karmaTrend ? TREND_LABEL[karmaTrend] : null

  // If there's truly nothing to remember yet, don't render a hollow section.
  if (!hasActive && !hasFading && !hasNearly && !trend) return null

  return (
    <section className="kq-card mb-6" aria-label="Your memory">
      <h2 className="kq-section-label !mt-0">What we hold, and what we let go</h2>

      <div className="grid gap-4">
        {hasActive && (
          <div>
            <p className="text-sm text-text">
              <span className="font-semibold text-text">{data.activeCount}</span> active{' '}
              {data.activeCount === 1 ? 'relationship' : 'relationships'} you&apos;re tending.
            </p>
          </div>
        )}

        {trend && (
          <div>
            <p className="kq-quiet-meta">Karma trend: <span className="text-text">{trend}</span></p>
          </div>
        )}

        {hasFading && (
          <div>
            <p className="kq-quiet-meta mb-2">Going quiet</p>
            <p className="text-sm text-text-muted mb-2">
              These bonds are still here, but they have been quieter lately.
            </p>
            <div className="flex flex-wrap gap-2">
              {data.fading.map((rel) => (
                <RelationshipFace key={rel.peerId} rel={rel} />
              ))}
            </div>
          </div>
        )}

        {hasNearly && (
          <ReWarmingNudge
            communityId={communityId}
            relationships={data.nearlyForgotten as FadingRelationship[]}
          />
        )}

        <p className="kq-quiet-meta border-t border-border-light pt-3">
          We keep the fact that care happened — active bonds, completed exchanges, karma, and trust —
          while private request and message details are let go on a schedule.{' '}
          <a href="/about/memory" className="underline">What we keep →</a>
        </p>
      </div>
    </section>
  )
}
