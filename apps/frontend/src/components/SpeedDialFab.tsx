/**
 * SpeedDialFab — Tab-aware expandable FAB.
 *
 * - browse tab: expands to "Get Help" + "Get Service"
 * - commitments / my-requests: single "Get Help" action (no expansion)
 * - profile: hidden
 *
 * Z-index: actions z-40, backdrop z-39, wizard modal z-50
 */
import { useState } from 'react'
import type { TabId } from '@/components/TabBar'

type ActionId = 'get-help' | 'get-service'

function getVisibleActions(tab: TabId): ActionId[] {
  switch (tab) {
    case 'browse': return ['get-help', 'get-service']
    case 'commitments': return ['get-help']
    case 'my-requests': return ['get-help']
    case 'profile': return []
  }
}

interface SpeedDialFabProps {
  activeTab: TabId
  onGetHelp: () => void
  onGetService: () => void
  isProviderMode?: boolean
}

export default function SpeedDialFab({ activeTab, onGetHelp, onGetService, isProviderMode }: SpeedDialFabProps) {
  const [expanded, setExpanded] = useState(false)
  const actions = getVisibleActions(activeTab)

  if (isProviderMode) return null
  if (actions.length === 0) return null

  // Single action — plain FAB, no expansion needed
  if (actions.length === 1) {
    return (
      <button
        className="fab"
        onClick={onGetHelp}
        aria-label="Get Help"
      >
        +
      </button>
    )
  }

  // Two actions — expandable speed dial
  return (
    <div className="fixed bottom-24 right-6 z-40 flex flex-col items-end gap-3 md:bottom-8">
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
        className="fab focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
        onClick={() => setExpanded(!expanded)}
        aria-label={expanded ? 'Close actions' : 'Open actions'}
        aria-expanded={expanded}
      >
        {expanded ? '×' : '+'}
      </button>
    </div>
  )
}
