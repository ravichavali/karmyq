import { useState, useEffect } from 'react'
import FulfillmentPanel from '@/components/FulfillmentPanel'
import { reputationService } from '@/lib/api'

interface Match {
  id: string
  request_id: string
  responder_id: string
  requester_id?: string
  status: string
  created_at: string
  responder_name?: string
  requester_name?: string
  request_description?: string
  request_type?: string
  payload?: Record<string, any>
  scheduled_at?: string
  request_title?: string
  requester_done_at?: string | null
  responder_done_at?: string | null
}

interface UpcomingPanelProps {
  matches: Match[]
  currentUserId: string
  activeCommunityId?: string
  onComplete: (matchId: string) => void
}

const STORAGE_KEY = 'upcomingPanel_collapsed'

export default function UpcomingPanel({ matches, currentUserId, activeCommunityId, onComplete }: UpcomingPanelProps) {
  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window === 'undefined') return false
    return localStorage.getItem(STORAGE_KEY) === 'true'
  })
  const [completingId, setCompletingId] = useState<string | null>(null)
  const [pendingRatingId, setPendingRatingId] = useState<string | null>(null)
  const [ratedIds, setRatedIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, String(collapsed))
  }, [collapsed])

  if (matches.length === 0) return null

  const toggle = () => setCollapsed((c) => !c)

  const handleDone = (matchId: string) => {
    setCompletingId(matchId)
    setTimeout(() => {
      // Show rating prompt first — onComplete (which removes the match) is called
      // only after the user rates or skips. This keeps the match visible long enough
      // to collect feedback from both parties independently.
      setCompletingId(null)
      setPendingRatingId(matchId)
    }, 1200)
  }

  const handleRating = async (match: Match, rating: number) => {
    const isHelper = match.responder_id === currentUserId
    const toUserId = isHelper ? match.requester_id : match.responder_id

    if (toUserId && activeCommunityId) {
      try {
        await reputationService.submitFeedback({
          match_id: match.id,
          to_user_id: toUserId,
          community_id: activeCommunityId,
          rating,
        })
      } catch {
        // Silently ignore — feedback is best-effort
      }
    }

    setRatedIds((prev) => new Set(prev).add(match.id))
    setPendingRatingId(null)
    onComplete(match.id)
  }

  const handleSkipRating = (matchId: string) => {
    setRatedIds((prev) => new Set(prev).add(matchId))
    setPendingRatingId(null)
    onComplete(matchId)
  }

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
            const isCompleting = completingId === match.id
            const awaitingRating = pendingRatingId === match.id && !ratedIds.has(match.id)

            return (
              <div key={match.id} className="px-4 py-3">
                <div className="flex items-start justify-between gap-2 mb-1">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-text truncate">{title}</p>
                    {isCompleting ? (
                      <p className="text-xs text-green-600 mt-0.5" data-testid="karma-confirmation">
                        Karma awarded!
                      </p>
                    ) : awaitingRating ? (
                      <div className="mt-1.5" data-testid="rating-prompt">
                        <p className="text-xs text-text-subtle mb-1">
                          Rate your experience with{' '}
                          <span className="font-medium text-text-muted">{otherPartyName || 'them'}</span>
                          <span className="ml-1 text-text-subtle opacity-60">(private)</span>
                        </p>
                        <div className="flex items-center gap-1">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <button
                              key={star}
                              onClick={() => handleRating(match, star)}
                              className="text-xl hover:scale-110 transition-transform"
                              data-testid={`star-${star}`}
                              aria-label={`Rate ${star} star${star > 1 ? 's' : ''}`}
                            >
                              ☆
                            </button>
                          ))}
                          <button
                            onClick={() => handleSkipRating(match.id)}
                            className="ml-2 text-xs text-text-subtle hover:text-text-muted"
                            data-testid="skip-rating"
                          >
                            Skip
                          </button>
                        </div>
                      </div>
                    ) : (
                      <p className="text-xs text-text-subtle mt-0.5">
                        {isHelper ? 'You are helping' : 'Being helped by'}{' '}
                        <span className="font-medium text-text-muted">{otherPartyName || 'them'}</span>
                      </p>
                    )}
                  </div>
                  {!isCompleting && !awaitingRating && (
                    <button
                      onClick={() => handleDone(match.id)}
                      className="flex-shrink-0 px-2.5 py-1 text-xs font-medium text-green-700 bg-green-50 border border-green-200 rounded-lg hover:bg-green-100 transition-colors"
                    >
                      ✓ Done
                    </button>
                  )}
                </div>

                {match.request_type && match.payload && !awaitingRating && (
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
