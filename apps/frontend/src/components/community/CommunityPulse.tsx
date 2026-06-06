import type { CommunityPulse as Pulse } from '@/hooks/useCommunityPulse'

interface Props {
  pulse: Pulse | null
  loading: boolean
}

/**
 * Sprint 89 / ADR-068 — "This week in the neighbourhood".
 *
 * A warm weekly summary that replaces the old empty KPI tiles. Rows with no meaningful data are
 * suppressed (we never render "0 neighbours helped"); fed entirely by the server-side pulse
 * aggregation, so there is no client-side recomputation. Fail-soft: when the pulse is missing the
 * whole card simply doesn't render and the page carries on.
 */
export default function CommunityPulse({ pulse, loading }: Props) {
  if (loading) {
    return (
      <div className="kq-card animate-pulse" aria-hidden>
        <div className="h-4 w-2/3 rounded bg-border mb-3" />
        <div className="h-4 w-1/2 rounded bg-border" />
      </div>
    )
  }

  if (!pulse) return null

  const helpers = pulse.recentHelpers.slice(0, 3).map((h) => h.name)
  const rows: { key: string; icon: string; lead: string; sub?: string }[] = []

  if (pulse.helpedThisWeek > 0) {
    rows.push({
      key: 'helped',
      icon: '🤝',
      lead: `${pulse.helpedThisWeek} ${pulse.helpedThisWeek === 1 ? 'neighbour' : 'neighbours'} helped each other`,
      sub: helpers.length > 0 ? `thanks to ${helpers.join(', ')}` : undefined,
    })
  }

  if (pulse.openAsks > 0) {
    rows.push({
      key: 'open',
      icon: '🙋',
      lead: `${pulse.openAsks} open ${pulse.openAsks === 1 ? 'ask' : 'asks'} waiting for a hand`,
      sub: pulse.timeSensitive > 0 ? `${pulse.timeSensitive} time-sensitive` : undefined,
    })
  }

  if (pulse.recentJoins > 0) {
    rows.push({
      key: 'joins',
      icon: '🌱',
      lead: `${pulse.recentJoins} new ${pulse.recentJoins === 1 ? 'neighbour' : 'neighbours'} joined this week`,
    })
  }

  // No meaningful activity → suppress the whole card rather than show empty tiles.
  if (rows.length === 0) return null

  return (
    <section>
      <h3 className="kq-section-label">This week in the neighbourhood</h3>
      <div className="kq-card kq-pulse">
        {rows.map((row) => (
          <div key={row.key} className="kq-pulse-row">
            <span className="kq-pulse-ic" aria-hidden>{row.icon}</span>
            <div className="flex-1 text-[14.5px]">
              <span className="text-text font-semibold">{row.lead}</span>
              {row.sub && <div className="text-[13px] text-text-subtle">{row.sub}</div>}
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
