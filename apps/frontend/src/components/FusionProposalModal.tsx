import { useState } from 'react'
import { communityService } from '@/lib/api'

function cleanMergedCommunityName(name: string): string {
  return name
    .replace(/\s+[—-]\s+Group [AB](?:\s+[—-]\s+Group [AB])*/gi, '')
    .replace(/\s+/g, ' ')
    .trim()
}

interface Props {
  communityId: string
  onSuccess: () => void
  onCancel: () => void
}

export default function FusionProposalModal({ communityId, onSuccess, onCancel }: Props) {
  const [targetCommunityId, setTargetCommunityId] = useState('')
  const [mergedCommunityName, setMergedCommunityName] = useState('')
  const [rationale, setRationale] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!targetCommunityId.trim() || !mergedCommunityName.trim()) {
      setError('Target Community ID and merged community name are required')
      return
    }
    setSubmitting(true)
    setError('')
    try {
      await communityService.createFusionProposal(communityId, {
        target_community_id: targetCommunityId.trim(),
        merged_community_name: cleanMergedCommunityName(mergedCommunityName),
        rationale: rationale.trim() || undefined,
      })
      onSuccess()
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to create fusion proposal')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md">
        <h2 className="text-xl font-semibold mb-1">Propose Community Fusion</h2>
        <p className="text-sm text-gray-500 mb-4">
          Propose merging this community with another. The target community's admin must accept before members vote.
        </p>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded text-sm">{error}</div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Target Community ID</label>
            <input
              type="text"
              value={targetCommunityId}
              onChange={(e) => setTargetCommunityId(e.target.value)}
              placeholder="UUID of the community to merge with"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Merged Community Name</label>
            <input
              type="text"
              value={mergedCommunityName}
              onChange={(e) => setMergedCommunityName(e.target.value)}
              placeholder="e.g. Unified Mutual Aid Collective"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Rationale <span className="text-gray-400">(optional)</span></label>
            <textarea
              value={rationale}
              onChange={(e) => setRationale(e.target.value)}
              placeholder="Why would this merger benefit both communities?"
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
