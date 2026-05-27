import { useState, useEffect, useCallback } from 'react'
import { communityService } from '@/lib/api'
import type { Community } from '@/hooks/useCommunityData'
import FissionProposalModal from '@/components/FissionProposalModal'
import FissionAssignmentView from '@/components/FissionAssignmentView'

interface Props {
  community: Community
  isAdmin: boolean
  onRefresh: () => void
}

interface ProposalDetail {
  proposal: {
    id: string
    status: string
    group_a_name: string
    group_b_name: string
    rationale: string
    voting_ends_at: string | null
    quorum_pct: number
    approval_pct: number
  }
  assignments: Array<{
    user_id: string
    user_name: string
    assigned_to: string
    cluster_suggestion: string | null
    admin_overridden: boolean
  }>
  vote_tally: {
    total_members: number
    voted_count: number
    quorum_pct: number
    approval_pct: number
    weighted_yes: number
    weighted_total: number
    approval_ratio: number
    quorum_ratio: number
  }
}

export default function FissionTab({ community, isAdmin, onRefresh }: Props) {
  const [showModal, setShowModal] = useState(false)
  const [proposalDetail, setProposalDetail] = useState<ProposalDetail | null>(null)
  const [loading, setLoading] = useState(false)
  const [voting, setVoting] = useState(false)
  const [executing, setExecuting] = useState(false)
  const [error, setError] = useState('')
  const [myVote, setMyVote] = useState<string | null>(null)
  const [childIds, setChildIds] = useState<{ a: string; b: string } | null>(null)

  const proposal = community.active_split_proposal

  const fetchDetail = useCallback(async () => {
    if (!proposal) return
    setLoading(true)
    try {
      const res = await communityService.getSplitProposal(community.id, proposal.id)
      setProposalDetail(res.data)
    } catch {
      setError('Failed to load proposal details')
    } finally {
      setLoading(false)
    }
  }, [community.id, proposal])

  useEffect(() => {
    fetchDetail()
  }, [fetchDetail])

  const handleProposalCreated = () => {
    setShowModal(false)
    onRefresh()
  }

  const handleVote = async (vote: 'yes' | 'no' | 'abstain') => {
    if (!proposal) return
    setVoting(true)
    setError('')
    try {
      await communityService.castSplitVote(community.id, proposal.id, vote)
      setMyVote(vote)
      await fetchDetail()
      onRefresh()
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to cast vote')
    } finally {
      setVoting(false)
    }
  }

  const handleExecute = async () => {
    if (!proposal) return
    setExecuting(true)
    setError('')
    try {
      const res = await communityService.executeSplit(community.id, proposal.id)
      setChildIds({ a: res.data.child_community_a_id, b: res.data.child_community_b_id })
      onRefresh()
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to execute split')
    } finally {
      setExecuting(false)
    }
  }

  // Executed state — show completion view
  if (proposal?.status === 'executed' || childIds) {
    const detail = proposalDetail?.proposal
    return (
      <div className="space-y-4">
        <div className="bg-green-50 border border-green-200 rounded-xl p-6 text-center">
          <div className="text-4xl mb-3">✓</div>
          <h3 className="text-xl font-semibold text-green-800 mb-1">Split Complete</h3>
          <p className="text-green-700 text-sm">
            This community has split into{' '}
            <strong>{detail?.group_a_name ?? proposal?.group_a_name}</strong> and{' '}
            <strong>{detail?.group_b_name ?? proposal?.group_b_name}</strong>.
            Both communities are now active. This community's history and karma records remain here.
          </p>
        </div>
      </div>
    )
  }

  // No proposal yet — admin can create one
  if (!proposal) {
    if (!isAdmin) {
      return (
        <div className="text-center py-12 text-gray-500 text-sm">
          No split proposal is currently active for this community.
        </div>
      )
    }
    return (
      <>
        <div className="text-center py-8">
          <h3 className="text-lg font-semibold mb-2">Propose a Community Split</h3>
          <p className="text-sm text-gray-500 mb-6 max-w-md mx-auto">
            When a community grows beyond its optimal size, splitting into two smaller communities can help maintain trust and cohesion.
            The trust graph will automatically suggest initial groupings.
          </p>
          <button
            onClick={() => setShowModal(true)}
            className="px-6 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
          >
            Create Split Proposal
          </button>
        </div>
        {showModal && (
          <FissionProposalModal
            communityId={community.id}
            onSuccess={handleProposalCreated}
            onCancel={() => setShowModal(false)}
          />
        )}
      </>
    )
  }

  if (loading) {
    return <div className="py-8 text-center text-gray-400 text-sm">Loading proposal…</div>
  }

  if (error) {
    return <div className="py-4 px-4 bg-red-50 border border-red-200 text-red-700 rounded text-sm">{error}</div>
  }

  // Discussion phase — admin reviews assignments
  if (proposal.status === 'discussion' && proposalDetail) {
    return (
      <FissionAssignmentView
        communityId={community.id}
        splitId={proposal.id}
        proposal={proposalDetail.proposal}
        assignments={proposalDetail.assignments}
        onStartVote={() => { onRefresh(); fetchDetail() }}
        onRefresh={fetchDetail}
      />
    )
  }

  // Voting phase — all members vote
  if (proposal.status === 'voting' && proposalDetail) {
    const { vote_tally: tally, proposal: detail, assignments } = proposalDetail
    const userAssignment = assignments.find((a) => typeof window !== 'undefined' && a.user_id)
    const groupAMembers = assignments.filter((a) => a.assigned_to === 'group_a').map((a) => a.user_name)
    const groupBMembers = assignments.filter((a) => a.assigned_to === 'group_b').map((a) => a.user_name)

    return (
      <div className="space-y-5">
        <div>
          <h3 className="text-lg font-semibold mb-1">Community Vote — Proposed Split</h3>
          {detail.rationale && (
            <p className="text-sm text-gray-500 italic">"{detail.rationale}"</p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="border border-blue-200 bg-blue-50 rounded-lg p-4">
            <div className="text-sm font-semibold text-blue-800 mb-2">{detail.group_a_name}</div>
            <ul className="text-xs text-blue-700 space-y-0.5">
              {groupAMembers.slice(0, 8).map((n) => <li key={n}>{n}</li>)}
              {groupAMembers.length > 8 && <li className="text-blue-500">+{groupAMembers.length - 8} more</li>}
            </ul>
          </div>
          <div className="border border-green-200 bg-green-50 rounded-lg p-4">
            <div className="text-sm font-semibold text-green-800 mb-2">{detail.group_b_name}</div>
            <ul className="text-xs text-green-700 space-y-0.5">
              {groupBMembers.slice(0, 8).map((n) => <li key={n}>{n}</li>)}
              {groupBMembers.length > 8 && <li className="text-green-500">+{groupBMembers.length - 8} more</li>}
            </ul>
          </div>
        </div>

        <div className="bg-gray-50 rounded-lg p-4 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Quorum ({tally.quorum_pct}% needed)</span>
            <span className="font-medium">{tally.quorum_ratio}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-1.5">
            <div className="bg-blue-500 h-1.5 rounded-full" style={{ width: `${Math.min(tally.quorum_ratio, 100)}%` }} />
          </div>
          <div className="flex justify-between text-sm mt-2">
            <span className="text-gray-600">Approval ({tally.approval_pct}% needed)</span>
            <span className="font-medium">{tally.approval_ratio}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-1.5">
            <div className="bg-green-500 h-1.5 rounded-full" style={{ width: `${Math.min(tally.approval_ratio, 100)}%` }} />
          </div>
        </div>

        {userAssignment && (
          <p className="text-sm text-gray-600">
            You are assigned to: <strong>{userAssignment.assigned_to === 'group_a' ? detail.group_a_name : detail.group_b_name}</strong>
          </p>
        )}

        {!myVote ? (
          <div className="flex gap-3">
            <button onClick={() => handleVote('yes')} disabled={voting}
              className="flex-1 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50">
              {voting ? '…' : 'Yes — Split'}
            </button>
            <button onClick={() => handleVote('no')} disabled={voting}
              className="flex-1 py-2 bg-red-500 text-white rounded-lg text-sm font-medium hover:bg-red-600 disabled:opacity-50">
              {voting ? '…' : 'No — Stay Together'}
            </button>
            <button onClick={() => handleVote('abstain')} disabled={voting}
              className="flex-1 py-2 border border-gray-300 text-gray-600 rounded-lg text-sm font-medium hover:bg-gray-50 disabled:opacity-50">
              {voting ? '…' : 'Abstain'}
            </button>
          </div>
        ) : (
          <div className="text-sm text-gray-500 text-center">
            You voted <strong>{myVote}</strong>. Thank you.
          </div>
        )}

        {detail.voting_ends_at && (
          <p className="text-xs text-gray-400 text-center">
            Voting closes {new Date(detail.voting_ends_at).toLocaleDateString()}
          </p>
        )}
      </div>
    )
  }

  // Approved — admin can execute
  if (proposal.status === 'approved' && proposalDetail) {
    return (
      <div className="space-y-4">
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="font-semibold text-green-800 mb-1">Vote Passed ✓</div>
          <p className="text-sm text-green-700">
            The community has approved the split into{' '}
            <strong>{proposalDetail.proposal.group_a_name}</strong> and{' '}
            <strong>{proposalDetail.proposal.group_b_name}</strong>.
            {isAdmin && ' Ready to execute when you are.'}
          </p>
        </div>
        {isAdmin && (
          <div className="flex justify-end">
            <button
              onClick={handleExecute}
              disabled={executing}
              className="px-6 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 disabled:opacity-50"
            >
              {executing ? 'Executing Split…' : 'Execute Split'}
            </button>
          </div>
        )}
      </div>
    )
  }

  // Rejected
  if (proposal.status === 'rejected') {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700">
        The split proposal was rejected by the community vote.
      </div>
    )
  }

  return null
}
