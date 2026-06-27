import Link from 'next/link'

/**
 * Sprint 113 PR B — the prominent Home entry point into My Network (the ego graph: you + your
 * first-degree connections, Scale 1 of the belonging fractal). Modeled on the other Home preview
 * bands (OfferedAwaitingPanel / SuggestedAsHelperPanel): a calm, non-actionable card that names the
 * surface and links to it. This is the PRIMARY prominence surface for My Network; the topbar nav
 * link is secondary (chrome budget — BUG-016/017). Home-only (`!isCommunity` at the call site).
 */
export default function MyNetworkPreview() {
  return (
    <section className="kq-card mb-3" aria-label="My Network">
      <Link
        href="/network"
        className="flex items-center justify-between gap-3 rounded transition-colors hover:bg-surface-raised"
      >
        <div>
          <p className="text-[14.5px] text-text font-medium">
            <span aria-hidden className="mr-2">🕸️</span>
            My Network
          </p>
          <p className="text-sm text-muted-foreground">
            See who you&apos;re connected to — you and your first-degree neighbours, the people you&apos;ve
            helped and who&apos;ve helped you.
          </p>
        </div>
        <span aria-hidden className="shrink-0 text-sm font-medium text-primary">Explore →</span>
      </Link>
    </section>
  )
}
