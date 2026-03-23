import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { requestService } from '@/lib/api'
import EmptyState from './EmptyState'
import { sortByActionPriority } from '../utils/commitmentSort'
import ExpandableConversation from './ExpandableConversation'

interface Match {
  id: string
  request_id: string
  responder_id: string
  requester_id?: string
  status: string
  updated_at: string
  request_title?: string
  requester_name?: string
  responder_name?: string
}

// ── Step indicator ────────────────────────────────────────────────────────────

const STEP_COLORS: Record<string, string> = {
  proposed: 'text-amber-500',
  matched: 'text-blue-500',
  completed: 'text-green-600',
}

function StepIndicator({ status }: { status: string }) {
  const colorCls = STEP_COLORS[status] ?? 'text-text-muted'
  const dots: Array<'filled' | 'empty'> = [
    status === 'proposed' ? 'filled' : 'empty',
    status === 'matched' ? 'filled' : 'empty',
    status === 'completed' ? 'filled' : 'empty',
  ]
  return (
    <span className={`text-xs tracking-widest ${colorCls}`} aria-label={`status: ${status}`}>
      {dots.map((d, i) => (
        <span key={i}>{d === 'filled' ? '●' : '○'}</span>
      ))}
    </span>
  )
}

// ── Collapsible section ───────────────────────────────────────────────────────

function SectionBlock({
  label,
  items,
  renderItem,
}: {
  label: string
  items: Match[]
  renderItem: (m: Match) => ReactNode
}) {
  const [open, setOpen] = useState(true)
  if (items.length === 0) return null
  return (
    <div className="mb-4">
      <button
        className="flex items-center gap-2 mb-2 w-full text-left focus:outline-none"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <span className="text-sm font-semibold text-text-muted uppercase tracking-wide">
          {label}
        </span>
        <span className="text-xs text-text-muted ml-auto">{open ? '▲' : '▼'}</span>
      </button>
      <div className={open ? 'block' : 'hidden'}>
        {items.map((m) => renderItem(m))}
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function CommitmentsTab() {
  const [helping, setHelping] = useState<Match[]>([])
  const [requested, setRequested] = useState<Match[]>([])
  const [loading, setLoading] = useState(true)
  const [markingDone, setMarkingDone] = useState<string | null>(null)
  const [actioning, setActioning] = useState<string | null>(null)
  const [currentUserId, setCurrentUserId] = useState<string>('')

  useEffect(() => {
    const userData = typeof window !== 'undefined' ? localStorage.getItem('user') : null
    let currentUser = null
    try { currentUser = userData ? JSON.parse(userData) : null } catch { currentUser = null }
    if (!currentUser) return
    setCurrentUserId(currentUser.id ?? '')

    requestService.getMatches({ user_id: currentUser.id, limit: 200 }).then((res) => {
      const allMatches: Match[] = res.data?.matches ?? []
      return requestService.getRequests({ requester_id: currentUser.id, limit: 100 }).then((reqRes) => {
        const myRequestIds = new Set((reqRes.data?.requests ?? []).map((r: any) => r.id))

        const helpingMatches = allMatches.filter(
          (m) => m.responder_id === currentUser.id && !myRequestIds.has(m.request_id)
        )
        const requestedMatches = allMatches.filter((m) => myRequestIds.has(m.request_id))

        setHelping(helpingMatches)
        setRequested(requestedMatches)
      })
    }).catch((err) => {
      console.error('Failed to load commitments:', err)
    }).finally(() => {
      setLoading(false)
    })
  }, [])

  const handleMarkDone = async (matchId: string) => {
    const userData = typeof window !== 'undefined' ? localStorage.getItem('user') : null
    let currentUser = null
    try { currentUser = userData ? JSON.parse(userData) : null } catch { currentUser = null }
    if (!currentUser) return

    setMarkingDone(matchId)
    try {
      await requestService.completeMatch(matchId, currentUser.id)
      setHelping((prev) => prev.map((m) => m.id === matchId ? { ...m, status: 'completed' } : m))
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to mark done')
    } finally {
      setMarkingDone(null)
    }
  }

  const handleConfirmDone = async (matchId: string) => {
    const userData = typeof window !== 'undefined' ? localStorage.getItem('user') : null
    let currentUser = null
    try { currentUser = userData ? JSON.parse(userData) : null } catch { currentUser = null }
    if (!currentUser) return

    setMarkingDone(matchId)
    try {
      await requestService.completeMatch(matchId, currentUser.id)
      setRequested((prev) => prev.map((m) => m.id === matchId ? { ...m, status: 'completed' } : m))
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to confirm done')
    } finally {
      setMarkingDone(null)
    }
  }

  const handleAccept = async (matchId: string, side: 'helping' | 'requested') => {
    // TODO: wire to accept/match API when available
    setActioning(matchId)
    try {
      // Optimistically move to matched on the relevant side only
      if (side === 'helping') {
        setHelping((prev) =>
          prev.map((m) => m.id === matchId ? { ...m, status: 'matched' } : m)
        )
      } else {
        setRequested((prev) =>
          prev.map((m) => m.id === matchId ? { ...m, status: 'matched' } : m)
        )
      }
    } finally {
      setActioning(null)
    }
  }

  const handleDecline = async (matchId: string, side: 'helping' | 'requested') => {
    // TODO: wire to decline/reject API when available
    setActioning(matchId)
    try {
      // Remove the match from the relevant side only (no rejected bucket exists)
      if (side === 'helping') {
        setHelping((prev) => prev.filter((m) => m.id !== matchId))
      } else {
        setRequested((prev) => prev.filter((m) => m.id !== matchId))
      }
    } finally {
      setActioning(null)
    }
  }

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-4 space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="card p-4 animate-pulse">
            <div className="h-4 bg-border rounded w-3/4 mb-2" />
            <div className="h-3 bg-border rounded w-1/2" />
          </div>
        ))}
      </div>
    )
  }

  function renderHelpingCard(m: Match) {
    const showConversation = m.status === 'proposed' || m.status === 'matched'
    return (
      <div key={m.id} className="card p-4 mb-3">
        {/* Top row: title + step indicator */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <p className="font-medium text-text truncate">{m.request_title ?? 'Request'}</p>
            <p className="text-sm text-text-muted mt-0.5">For {m.requester_name ?? 'community member'}</p>
          </div>
          <StepIndicator status={m.status} />
        </div>
        {/* Conversation widget: below status indicator, above footer actions */}
        {showConversation && currentUserId && (
          <ExpandableConversation
            matchId={m.id}
            otherUserName={m.requester_name ?? 'Requester'}
            currentUserId={currentUserId}
          />
        )}
        {/* Footer actions: right-aligned */}
        {m.status === 'proposed' && (
          <div className="flex justify-end gap-2 mt-3">
            <button
              className="text-xs py-1 px-2 rounded bg-green-100 text-green-700 hover:bg-green-200 disabled:opacity-50"
              disabled={actioning === m.id}
              onClick={() => handleAccept(m.id, 'helping')}
            >
              Accept
            </button>
            <button
              className="text-xs py-1 px-2 rounded bg-red-100 text-red-700 hover:bg-red-200 disabled:opacity-50"
              disabled={actioning === m.id}
              onClick={() => handleDecline(m.id, 'helping')}
            >
              Decline
            </button>
          </div>
        )}
        {m.status === 'matched' && (
          <div className="flex justify-end mt-3">
            <button
              className="btn-primary text-sm py-1 px-3 disabled:opacity-50"
              disabled={markingDone === m.id}
              onClick={() => handleMarkDone(m.id)}
            >
              {markingDone === m.id ? 'Saving…' : 'Mark Done'}
            </button>
          </div>
        )}
      </div>
    )
  }

  function renderRequestedCard(m: Match) {
    const showConversation = m.status === 'proposed' || m.status === 'matched'
    return (
      <div key={m.id} className="card p-4 mb-3">
        {/* Top row: title + step indicator */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <p className="font-medium text-text truncate">{m.request_title ?? 'Request'}</p>
            <p className="text-sm text-text-muted mt-0.5">
              {m.responder_name ? `Helper: ${m.responder_name}` : 'Waiting for helper'}
            </p>
          </div>
          <StepIndicator status={m.status} />
        </div>
        {/* Conversation widget: below status indicator, above footer actions */}
        {showConversation && currentUserId && (
          <ExpandableConversation
            matchId={m.id}
            otherUserName={m.responder_name ?? 'Helper'}
            currentUserId={currentUserId}
          />
        )}
        {/* Footer actions: right-aligned */}
        {m.status === 'proposed' && (
          <div className="flex justify-end gap-2 mt-3">
            <button
              className="text-xs py-1 px-2 rounded bg-green-100 text-green-700 hover:bg-green-200 disabled:opacity-50"
              disabled={actioning === m.id}
              onClick={() => handleAccept(m.id, 'requested')}
            >
              Accept
            </button>
            <button
              className="text-xs py-1 px-2 rounded bg-red-100 text-red-700 hover:bg-red-200 disabled:opacity-50"
              disabled={actioning === m.id}
              onClick={() => handleDecline(m.id, 'requested')}
            >
              Decline
            </button>
          </div>
        )}
        {m.status === 'pending-confirmation' && (
          <div className="flex justify-end mt-3">
            <button
              className="btn-primary text-sm py-1 px-3 disabled:opacity-50"
              disabled={markingDone === m.id}
              onClick={() => handleConfirmDone(m.id)}
            >
              {markingDone === m.id ? 'Saving…' : 'Confirm Done'}
            </button>
          </div>
        )}
      </div>
    )
  }

  function groupAndSort(matches: Match[]) {
    const sorted = sortByActionPriority(matches)
    return {
      proposed: sorted.filter((m) => m.status === 'proposed'),
      matched: sorted.filter((m) => m.status === 'matched'),
      completed: sorted.filter((m) => m.status === 'completed'),
    }
  }

  const helpingGroups = groupAndSort(helping)
  const requestedGroups = groupAndSort(requested)

  return (
    <div className="max-w-2xl mx-auto px-4 py-4 space-y-8">
      {/* I'm Helping */}
      <section>
        <h2 className="section-heading mb-3">I&apos;m Helping</h2>
        {helping.length === 0 ? (
          <EmptyState
            heading="No active commitments"
            body="Browse requests to find someone to help."
          />
        ) : (
          <>
            <SectionBlock
              label="Needs Your Response"
              items={helpingGroups.proposed}
              renderItem={renderHelpingCard}
            />
            <SectionBlock
              label="In Progress"
              items={helpingGroups.matched}
              renderItem={renderHelpingCard}
            />
            <SectionBlock
              label="Completed"
              items={helpingGroups.completed}
              renderItem={renderHelpingCard}
            />
          </>
        )}
      </section>

      {/* I Asked For Help */}
      <section>
        <h2 className="section-heading mb-3">I Asked For Help</h2>
        {requested.length === 0 ? (
          <EmptyState
            heading="No matched requests"
            body="Post a request and accept an offer to see it here."
          />
        ) : (
          <>
            <SectionBlock
              label="Needs Your Response"
              items={requestedGroups.proposed}
              renderItem={renderRequestedCard}
            />
            <SectionBlock
              label="In Progress"
              items={requestedGroups.matched}
              renderItem={renderRequestedCard}
            />
            <SectionBlock
              label="Completed"
              items={requestedGroups.completed}
              renderItem={renderRequestedCard}
            />
          </>
        )}
      </section>
    </div>
  )
}
