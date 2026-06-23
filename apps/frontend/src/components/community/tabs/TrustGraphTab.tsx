import { useState } from 'react'
import BelongingGraph from '@/components/BelongingGraph'
import ReWarmingNudge from '@/components/relationships/ReWarmingNudge'

interface TrustGraphTabProps {
  communityId: string
  currentUserId: string
}

type SubTab = 'community' | 'ego'

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
  const [subTab, setSubTab] = useState<SubTab>('community')

  const tabClass = (active: boolean) =>
    `px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
      active ? 'bg-indigo-600 text-white' : 'bg-surface text-text-muted hover:text-text'
    }`

  return (
    <div>
      <div className="mb-4">
        <h3 className="text-base font-semibold text-text">Trust Graph</h3>
        <p className="text-sm text-text-muted mt-1">
          {subTab === 'community'
            ? 'Every member, grouped by how closely they connect. Amber lines are your connections.'
            : 'Your first-degree network, clustered by how closely your connections connect to each other. Amber lines are yours.'}
        </p>
      </div>

      <div className="flex gap-2 mb-3">
        <button onClick={() => setSubTab('community')} className={tabClass(subTab === 'community')}>
          Community
        </button>
        <button onClick={() => setSubTab('ego')} className={tabClass(subTab === 'ego')}>
          My Network
        </button>
      </div>

      {/* Sprint 102 / ADR-070 — explain fading before the graph, then the gentle re-warm nudge. */}
      <MemoryLegend />

      {/* Sprint 90 / ADR-070 — re-warm bonds about to be swept. Self-suppresses when none. */}
      <ReWarmingNudge communityId={communityId} className="mb-4" />

      <div className="w-full min-h-[600px] h-[calc(100vh-320px)]">
        <BelongingGraph
          mode={subTab === 'community' ? 'community' : 'ego'}
          communityId={communityId}
          currentUserId={currentUserId}
          load="immediate"
          height={560}
        />
      </div>
    </div>
  )
}
