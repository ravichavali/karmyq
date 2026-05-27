import { useState } from 'react'
import { communityService } from '@/lib/api'

interface Props {
  communityId: string
  onSuccess: () => void
  onCancel: () => void
}

export default function FissionProposalModal({ communityId, onSuccess, onCancel }: Props) {
  const [groupAName, setGroupAName] = useState('')
  const [groupBName, setGroupBName] = useState('')
  const [rationale, setRationale] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!groupAName.trim() || !groupBName.trim()) {
      setError('Both group names are required')
      return
    }
    setSubmitting(true)
    setError('')
    try {
      await communityService.createSplitProposal(communityId, {
        group_a_name: groupAName.trim(),
        group_b_name: groupBName.trim(),
        rationale: rationale.trim(),
      })
      onSuccess()
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to create proposal')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md">
        <h2 className="text-xl font-semibold mb-1">Propose Community Split</h2>
        <p className="text-sm text-gray-500 mb-4">
          The system will use the trust graph to suggest initial member groupings. You can adjust assignments before opening the vote.
        </p>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded text-sm">{error}</div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name for Group A</label>
            <input
              type="text"
              value={groupAName}
              onChange={(e) => setGroupAName(e.target.value)}
              placeholder="e.g. Eastside Collective"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name for Group B</label>
            <input
              type="text"
              value={groupBName}
              onChange={(e) => setGroupBName(e.target.value)}
              placeholder="e.g. Westside Mutual Aid"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Rationale <span className="text-gray-400">(optional)</span></label>
            <textarea
              value={rationale}
              onChange={(e) => setRationale(e.target.value)}
              placeholder="Why is a split beneficial for this community now?"
              rows={3}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 bg-blue-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
            >
              {submitting ? 'Creating…' : 'Create Proposal'}
            </button>
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 border border-gray-300 text-gray-700 py-2 rounded-lg text-sm font-medium hover:bg-gray-50"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
