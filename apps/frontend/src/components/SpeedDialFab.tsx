/**
 * SpeedDialFab — Tab-aware expandable FAB.
 *
 * - browse tab: expands to "Get Help" + "Get Service"
 * - helping / asks: single "Get Help" action (no expansion)
 *
 * Z-index: actions z-40, backdrop z-39, wizard modal z-50
 */
import { useState } from 'react'
import type { TabId } from '@/components/TabBar'

type ActionId = 'get-help' | 'get-service'

function getVisibleActions(tab: TabId): ActionId[] {
  switch (tab) {
    case 'browse': return ['get-help', 'get-service']
    case 'helping': return ['get-help']
    case 'asks': return ['get-help']
  }
}

interface SpeedDialFabProps {
  activeTab: TabId
  onGetHelp: () => void
  onGetService: () => void
}

export default function SpeedDialFab({ activeTab, onGetHelp, onGetService }: SpeedDialFabProps) {
  const [expanded, setExpanded] = useState(false)
  const actions = getVisibleActions(activeTab)

  if (actions.length === 0) return null

  // Single action — plain FAB, no expansion needed.
  // Sprint 120 PR C (R-5): the label is VISIBLE, not just an aria-label. A bare "+" circle was the
  // only affordance for the product's primary action, and screenshots of the fold read as decoration.
  if (actions.length === 1) {
    return (
      <button
        className="fab whitespace-nowrap"
        onClick={onGetHelp}
      >
        <span aria-hidden="true">+</span>
        <span>Get Help</span>
      </button>
    )
  }

  // Two actions — expandable speed dial
  return (
    <div className="fixed bottom-28 right-6 z-40 flex flex-col items-end gap-3 md:bottom-8">
      {expanded && (
        <>
          {/* Backdrop click-catcher */}
          <div
            className="fixed inset-0"
            style={{ zIndex: 39 }}
            onClick={() => setExpanded(false)}
          />

          {/* Action buttons (rendered above backdrop) */}
          <div className="relative z-40 flex flex-col items-end gap-3">
            <button
              className="speed-dial-action focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
              onClick={() => { onGetService(); setExpanded(false) }}
            >
              <span className="text-base">🔧</span>
              Get Service
            </button>
            <button
              className="speed-dial-action focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
              onClick={() => { onGetHelp(); setExpanded(false) }}
            >
              <span className="text-base">🤝</span>
              Get Help
            </button>
          </div>
        </>
      )}

      <button
        className="fab-trigger whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
        onClick={() => setExpanded(!expanded)}
        aria-expanded={expanded}
      >
        <span aria-hidden="true">{expanded ? '×' : '+'}</span>
        <span>{expanded ? 'Close' : 'Ask'}</span>
      </button>
    </div>
  )
}
