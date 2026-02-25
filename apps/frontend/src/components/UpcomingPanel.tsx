import { useState, useEffect } from 'react'
import FulfillmentPanel from '@/components/FulfillmentPanel'

interface Match {
  id: string
  request_id: string
  responder_id: string
  status: string
  created_at: string
  responder_name?: string
  requester_name?: string
  request_description?: string
  request_type?: string
  payload?: Record<string, any>
  scheduled_at?: string
  request_title?: string
}

interface UpcomingPanelProps {
  matches: Match[]
  currentUserId: string
  onComplete: (matchId: string) => void
}

const STORAGE_KEY = 'upcomingPanel_collapsed'

export default function UpcomingPanel({ matches, currentUserId, onComplete }: UpcomingPanelProps) {
  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window === 'undefined') return false
    return localStorage.getItem(STORAGE_KEY) === 'true'
  })

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, String(collapsed))
  }, [collapsed])

  if (matches.length === 0) return null

  const toggle = () => setCollapsed((c) => !c)

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-xl shadow-sm mb-4 overflow-hidden" data-testid="upcoming-panel">
      {/* Header */}
      <button
        onClick={toggle}
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-amber-100 transition-colors"
        aria-expanded={!collapsed}
        data-testid="upcoming-panel-toggle"
      >
        <div className="flex items-center gap-2">
          <span className="text-amber-600 font-semibold text-sm">
            📅 Upcoming Commitments
          </span>
          <span className="bg-amber-200 text-amber-800 text-xs font-medium px-2 py-0.5 rounded-full">
            {matches.length}
          </span>
        </div>
        <span className="text-amber-500 text-sm">{collapsed ? '▼' : '▲'}</span>
      </button>

      {/* Items */}
      {!collapsed && (
        <div className="divide-y divide-amber-100" data-testid="upcoming-panel-items">
          {matches.map((match) => {
            const isHelper = match.responder_id === currentUserId
            const otherPartyName = isHelper ? match.requester_name : match.responder_name
            const title = match.request_title || match.request_description || 'Help request'

            return (
              <div key={match.id} className="px-4 py-3">
                <div className="flex items-start justify-between gap-2 mb-1">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-text truncate">{title}</p>
                    <p className="text-xs text-text-subtle mt-0.5">
                      {isHelper ? 'You are helping' : 'Being helped by'}{' '}
                      <span className="font-medium text-text-muted">{otherPartyName || 'them'}</span>
                    </p>
                  </div>
                  <button
                    onClick={() => onComplete(match.id)}
                    className="flex-shrink-0 px-2.5 py-1 text-xs font-medium text-green-700 bg-green-50 border border-green-200 rounded-lg hover:bg-green-100 transition-colors"
                  >
                    ✓ Done
                  </button>
                </div>

                {match.request_type && match.payload && (
                  <FulfillmentPanel
                    requestType={match.request_type}
                    payload={match.payload}
                    scheduledAt={match.scheduled_at}
                    requestTitle={title}
                  />
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
