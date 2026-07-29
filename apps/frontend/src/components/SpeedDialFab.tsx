/**
 * SpeedDialFab — the create-help action, placed so it never covers feed content.
 *
 * Sprint 120 PR C (R-5): a right-corner floating FAB cannot avoid overlapping a 375px feed column —
 * cards carry right-aligned actions ("Explore →", "Offer to Help") that reach x≈323, and any
 * bottom-right button reaches x≥303, so they intersect at rest (measured on the live build). The fix
 * is a NON-OVERLAY mobile placement: on < md the action is a docked, opaque, full-width bar directly
 * above the bottom nav — bottom chrome that content scrolls behind, like the nav itself. On md+ there
 * is no bottom nav and the wide viewport has room, so the labelled corner FAB stays.
 *
 * - browse tab: expands to "Get Help" + "Get Service"
 * - helping / asks: single "Get Help" action (no expansion)
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

  const single = actions.length === 1
  const ariaLabel = single ? 'Get Help' : expanded ? 'Close actions' : 'Ask for help or a service'
  const onTrigger = single ? onGetHelp : () => setExpanded(v => !v)

  // The two Get Help / Get Service options, shared by both layouts when the browse-tab dial is open.
  const expandedActions = !single && expanded && (
    <div className="flex flex-col items-stretch gap-2">
      <button
        className="speed-dial-action justify-center focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
        onClick={() => { onGetService(); setExpanded(false) }}
      >
        <span className="text-base">🔧</span>
        Get Service
      </button>
      <button
        className="speed-dial-action justify-center focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
        onClick={() => { onGetHelp(); setExpanded(false) }}
      >
        <span className="text-base">🤝</span>
        Get Help
      </button>
    </div>
  )

  return (
    <>
      {/* Backdrop click-catcher for the open dial (both layouts). */}
      {!single && expanded && (
        <div className="fixed inset-0 z-30" onClick={() => setExpanded(false)} aria-hidden="true" />
      )}

      {/* Mobile (< md): docked action bar above the bottom nav. */}
      <div className="kq-create-bar md:hidden" data-testid="create-bar-mobile">
        {expandedActions && <div className="relative z-40 mb-2">{expandedActions}</div>}
        <button
          className="btn-primary w-full justify-center gap-2 relative z-40"
          onClick={onTrigger}
          aria-label={ariaLabel}
          aria-expanded={single ? undefined : expanded}
        >
          <span aria-hidden="true">{!single && expanded ? '×' : '+'}</span>
          <span>{single ? 'Ask for help' : expanded ? 'Close' : 'Ask for help'}</span>
        </button>
      </div>

      {/* Desktop (md+): floating labelled corner FAB / speed dial. */}
      <div
        className="hidden md:flex fixed bottom-8 right-6 z-40 flex-col items-end gap-3"
        data-testid="create-fab-desktop"
      >
        {expandedActions && <div className="relative z-40 flex flex-col items-end gap-3">{expandedActions}</div>}
        <button
          className="fab-trigger whitespace-nowrap focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
          onClick={onTrigger}
          aria-label={ariaLabel}
          aria-expanded={single ? undefined : expanded}
        >
          <span aria-hidden="true">{!single && expanded ? '×' : '+'}</span>
          <span>{single ? 'Get Help' : expanded ? 'Close' : 'Ask'}</span>
        </button>
      </div>
    </>
  )
}
