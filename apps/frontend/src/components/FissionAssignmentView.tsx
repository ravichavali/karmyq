import { useState } from 'react'
import { communityService } from '@/lib/api'

interface Assignment {
  user_id: string
  user_name: string
  assigned_to: string
  cluster_suggestion: string | null
  admin_overridden: boolean
}

interface Props {
  communityId: string
  splitId: string
  proposal: { group_a_name: string; group_b_name: string }
  assignments: Assignment[]
  onStartVote: () => void
  onRefresh: () => void
}

export default function FissionAssignmentView({
  communityId, splitId, proposal, assignments, onStartVote, onRefresh: _onRefresh
}: Props) {
  const [localAssignments, setLocalAssignments] = useState<Assignment[]>(assignments)
  const [saving, setSaving] = useState(false)
  const [startingVote, setStartingVote] = useState(false)
  const [error, setError] = useState('')

  const groupA = localAssignments.filter((a) => a.assigned_to === 'group_a')
  const groupB = localAssignments.filter((a) => a.assigned_to === 'group_b')
  const unassigned = localAssignments.filter((a) => a.assigned_to === 'unassigned')
  const hasUnassigned = unassigned.length > 0

  const toggle = async (userId: string) => {
    const updated = localAssignments.map((a) => {
      if (a.user_id !== userId) return a
      const next = a.assigned_to === 'group_a' ? 'group_b' : 'group_a'
      return { ...a, assigned_to: next, admin_overridden: next !== a.cluster_suggestion }
    })
    setLocalAssignments(updated)
    setSaving(true)
    setError('')
    try {
      const change = updated.find((a) => a.user_id === userId)!
      await communityService.updateSplitAssignments(communityId, splitId, [
        { userId, assignedTo: change.assigned_to },
      ])
    } catch {
      setError('Failed to save assignment')
      setLocalAssignments(assignments)
    } finally {
      setSaving(false)
    }
  }

  const handleStartVote = async () => {
    setStartingVote(true)
    setError('')
    try {
      await communityService.startSplitVote(communityId, splitId)
      onStartVote()
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to open voting')
    } finally {
      setStartingVote(false)
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold mb-1">Review Member Assignments</h3>
        <p className="text-sm text-gray-500">
          The algorithm suggested these groupings based on the trust graph. Toggle any member to move them between groups.
          Highlighted rows are where your assignment differs from the algorithm's suggestion.
        </p>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded text-sm">{error}</div>
      )}

      <div className="flex gap-4 text-sm font-medium text-gray-600 bg-gray-50 rounded-lg px-4 py-2">
        <span>{proposal.group_a_name}: <strong>{groupA.length}</strong></span>
        <span>·</span>
        <span>{proposal.group_b_name}: <strong>{groupB.length}</strong></span>
        {hasUnassigned && <span className="text-amber-600">· Unassigned: <strong>{unassigned.length}</strong></span>}
      </div>

      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-gray-500">Member</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500">Suggested</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500">Assigned to</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            {localAssignments.map((a) => {
              const isOverridden = a.assigned_to !== a.cluster_suggestion && a.cluster_suggestion != null
              return (
                <tr key={a.user_id} className={isOverridden ? 'bg-amber-50' : ''}>
                  <td className="px-4 py-2 font-medium">{a.user_name}</td>
                  <td className="px-4 py-2 text-gray-500">
                    {a.cluster_suggestion === 'group_a' ? proposal.group_a_name
                      : a.cluster_suggestion === 'group_b' ? proposal.group_b_name
                      : '—'}
                  </td>
                  <td className="px-4 py-2">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                      a.assigned_to === 'group_a' ? 'bg-blue-100 text-blue-700'
                        : a.assigned_to === 'group_b' ? 'bg-green-100 text-green-700'
                        : 'bg-gray-100 text-gray-500'
                    }`}>
                      {a.assigned_to === 'group_a' ? proposal.group_a_name
                        : a.assigned_to === 'group_b' ? proposal.group_b_name
                        : 'Unassigned'}
                    </span>
                  </td>
                  <td className="px-4 py-2">
                    {a.assigned_to !== 'unassigned' && (
                      <button
                        onClick={() => toggle(a.user_id)}
                        disabled={saving}
                        className="text-xs text-blue-600 hover:underline disabled:opacity-50"
                      >
                        Move to {a.assigned_to === 'group_a' ? proposal.group_b_name : proposal.group_a_name}
                      </button>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <div className="flex justify-end">
        <button
          onClick={handleStartVote}
          disabled={startingVote || hasUnassigned}
          title={hasUnassigned ? 'All members must be assigned before voting' : undefined}
          className="px-5 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {startingVote ? 'Opening vote…' : 'Open Voting'}
        </button>
      </div>
    </div>
  )
}
