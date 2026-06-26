import Link from 'next/link'
import BelongingGraph from '@/components/BelongingGraph'
import ReWarmingNudge from '@/components/relationships/ReWarmingNudge'

interface TrustGraphTabProps {
  communityId: string
  currentUserId: string
}

/**
 * Sprint 102 / ADR-070 — explain why some lines look softer, so fading is text-legible (not just
 * lower opacity) and "nearly forgotten" reads as a gentle, optional state rather than a warning.
 */
function MemoryLegend() {
  return (
    <section className="kq-action-band mb-4" aria-label="How memory fades">
      <p className="kq-section-label !mt-0">How memory fades</p>
      <div className="grid gap-2 text-sm text-text-muted md:grid-cols-3">
        <div>
          <span className="font-semibold text-text">Strong and warm bonds</span>
          <p>Recent or well-tended relationships stay vivid.</p>
        </div>
        <div>
          <span className="font-semibold text-text">Fading bonds</span>
          <p>Quiet relationships look softer so the graph reflects what is alive now.</p>
        </div>
        <div>
          <span className="font-semibold text-text">Nearly forgotten bonds</span>
          <p>Helping each other again keeps them alive, or you can let them fade from active memory.</p>
        </div>
      </div>
    </section>
  )
}

export default function TrustGraphTab({ communityId, currentUserId }: TrustGraphTabProps) {
  return (
    <div>
      <div className="mb-4">
        <h3 className="text-base font-semibold text-text">Trust Graph</h3>
        <p className="text-sm text-text-muted mt-1">
          Scale 2 · This Community — this community&apos;s member topology, every member grouped by how closely they connect.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-3">
        {/* The level-up: zoom out to Scale 3 (communities-as-nodes) so the three scales read as one
            continuum (people → this community → across communities). */}
        <Link
          href="/network?mode=communities"
          className="ml-auto text-sm text-primary hover:underline"
        >
          See how communities connect →
        </Link>
      </div>

      {/* Sprint 102 / ADR-070 — explain fading before the graph, then the gentle re-warm nudge. */}
      <MemoryLegend />

      {/* Sprint 90 / ADR-070 — re-warm bonds about to be swept. Self-suppresses when none. */}
      <ReWarmingNudge communityId={communityId} className="mb-4" />

      <div className="w-full min-h-[600px] h-[calc(100vh-320px)]">
        <BelongingGraph
          mode="community"
          communityId={communityId}
          currentUserId={currentUserId}
          load="immediate"
          height={560}
        />
      </div>
    </div>
  )
}
