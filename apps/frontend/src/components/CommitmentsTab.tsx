import { useEffect, useState } from 'react'
import { requestService } from '@/lib/api'
import EmptyState from './EmptyState'

interface Match {
  id: string
  request_id: string
  responder_id: string
  requester_id?: string
  status: string
  request_title?: string
  requester_name?: string
  responder_name?: string
}

const STATUS_LABELS: Record<string, string> = {
  proposed: 'Pending',
  matched: 'Accepted',
  completed: 'Done',
  rejected: 'Declined',
  cancelled: 'Cancelled',
}

function StatusBadge({ status }: { status: string }) {
  const cls = `status-badge status-badge--${status.replace(/_/g, '-')}`
  return <span className={cls}>{STATUS_LABELS[status] ?? status}</span>
}

export default function CommitmentsTab() {
  const [helping, setHelping] = useState<Match[]>([])
  const [requested, setRequested] = useState<Match[]>([])
  const [loading, setLoading] = useState(true)
  const [markingDone, setMarkingDone] = useState<string | null>(null)

  useEffect(() => {
    const userData = typeof window !== 'undefined' ? localStorage.getItem('user') : null
    const currentUser = userData ? JSON.parse(userData) : null
    if (!currentUser) return

    requestService.getMatches({ user_id: currentUser.id, limit: 200 }).then((res) => {
      const allMatches: Match[] = res.data?.matches ?? []
      // Fetch my requests to know which matches are on requests I own
      return requestService.getRequests({ requester_id: currentUser.id, limit: 100 }).then((reqRes) => {
        const myRequestIds = new Set((reqRes.data?.requests ?? []).map((r: any) => r.id))

        // I'm helping: I'm the responder (not the requester)
        const helpingMatches = allMatches.filter(
          (m) => m.responder_id === currentUser.id && !myRequestIds.has(m.request_id)
        )
        // I asked for help: match is on a request I own
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
    const currentUser = userData ? JSON.parse(userData) : null
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
    const currentUser = userData ? JSON.parse(userData) : null
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
          helping.map((m) => (
            <div key={m.id} className="card p-4 mb-3 flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <p className="font-medium text-text truncate">{m.request_title ?? 'Request'}</p>
                <p className="text-sm text-text-muted mt-0.5">For {m.requester_name ?? 'community member'}</p>
              </div>
              <div className="flex flex-col items-end gap-2 shrink-0">
                <StatusBadge status={m.status} />
                {m.status === 'matched' && (
                  <button
                    className="btn-primary text-sm py-1 px-3 disabled:opacity-50"
                    disabled={markingDone === m.id}
                    onClick={() => handleMarkDone(m.id)}
                  >
                    {markingDone === m.id ? 'Saving…' : 'Mark Done'}
                  </button>
                )}
              </div>
            </div>
          ))
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
          requested.map((m) => (
            <div key={m.id} className="card p-4 mb-3 flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <p className="font-medium text-text truncate">{m.request_title ?? 'Request'}</p>
                <p className="text-sm text-text-muted mt-0.5">
                  {m.responder_name ? `Helper: ${m.responder_name}` : 'Waiting for helper'}
                </p>
              </div>
              <div className="flex flex-col items-end gap-2 shrink-0">
                <StatusBadge status={m.status} />
                {m.status === 'pending-confirmation' && (
                  <button
                    className="btn-primary text-sm py-1 px-3 disabled:opacity-50"
                    disabled={markingDone === m.id}
                    onClick={() => handleConfirmDone(m.id)}
                  >
                    {markingDone === m.id ? 'Saving…' : 'Confirm Done'}
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </section>
    </div>
  )
}
