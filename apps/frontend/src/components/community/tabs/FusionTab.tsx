import { useState, useEffect, useCallback } from 'react'
import { communityService } from '@/lib/api'
import type { Community } from '@/hooks/useCommunityData'
import FusionProposalModal from '@/components/FusionProposalModal'

interface Props {
  community: Community
  currentUserId: string
  isAdmin: boolean
  onRefresh: () => void
}

interface VoteTally {
  total_members: number
  voted_count: number
  quorum_pct: number
  approval_pct: number
  weighted_yes: number
  weighted_total: number
  approval_ratio: number
  quorum_ratio: number
}

interface ProposalDetail {
  proposal: {
    id: string
    status: string
    community_a_id: string
    community_b_id: string
    merged_community_name: string
    rationale: string
    voting_ends_at: string | null
    quorum_pct: number
    approval_pct: number
    merged_community_id: string | null
  }
  vote_tally_a: VoteTally
  vote_tally_b: VoteTally
  my_vote: string | null
  my_community: 'a' | 'b'
}

function TallyBar({ tally, label }: { tally: VoteTally; label: string }) {
  return (
    <div className="bg-gray-50 rounded-lg p-4 space-y-2">
      <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">{label}</div>
      <div className="flex justify-between text-sm">
        <span className="text-gray-600">Quorum ({tally.quorum_pct}% needed)</span>
        <span className="font-medium">{tally.quorum_ratio}%</span>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-1.5">
        <div
          className="bg-blue-500 h-1.5 rounded-full"
          style={{ width: `${Math.min(tally.quorum_ratio, 100)}%` }}
        />
      </div>
      <div className="flex justify-between text-sm mt-2">
        <span className="text-gray-600">Approval ({tally.approval_pct}% needed)</span>
        <span className="font-medium">{tally.approval_ratio}%</span>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-1.5">
        <div
          className="bg-green-500 h-1.5 rounded-full"
          style={{ width: `${Math.min(tally.approval_ratio, 100)}%` }}
        />
      </div>
    </div>
  )
}

export default function FusionTab({ community, currentUserId: _currentUserId, isAdmin, onRefresh }: Props) {
  const [showModal, setShowModal] = useState(false)
  const [proposalDetail, setProposalDetail] = useState<ProposalDetail | null>(null)
  const [loading, setLoading] = useState(false)
  const [voting, setVoting] = useState(false)
  const [executing, setExecuting] = useState(false)
  const [accepting, setAccepting] = useState(false)
  const [rejecting, setRejecting] = useState(false)
  const [startingVote, setStartingVote] = useState(false)
  const [error, setError] = useState('')
  const [myVote, setMyVote] = useState<string | null>(null)

  const proposal = community.active_fusion_proposal

  const fetchDetail = useCallback(async () => {
    if (!proposal) return
    setLoading(true)
    try {
      const res = await communityService.getFusionProposal(community.id, proposal.id)
      setProposalDetail(res.data)
      if (res.data.my_vote) setMyVote(res.data.my_vote)
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

  const handleAccept = async () => {
    if (!proposal) return
    setAccepting(true)
    setError('')
    try {
      await communityService.acceptFusionProposal(community.id, proposal.id)
      onRefresh()
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to accept proposal')
    } finally {
      setAccepting(false)
    }
  }

  const handleReject = async () => {
    if (!proposal) return
    setRejecting(true)
    setError('')
    try {
      await communityService.rejectFusionProposal(community.id, proposal.id)
      onRefresh()
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to reject proposal')
    } finally {
      setRejecting(false)
    }
  }

  const handleStartVote = async () => {
    if (!proposal) return
    setStartingVote(true)
    setError('')
    try {
      await communityService.startFusionVote(community.id, proposal.id)
      onRefresh()
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to start vote')
    } finally {
      setStartingVote(false)
    }
  }

  const handleVote = async (vote: 'yes' | 'no' | 'abstain') => {
    if (!proposal) return
    setVoting(true)
    setError('')
    try {
      await communityService.castFusionVote(community.id, proposal.id, vote)
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
      await communityService.executeFusion(community.id, proposal.id)
      onRefresh()
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to execute fusion')
    } finally {
      setExecuting(false)
    }
  }

  if (error) {
    return <div className="py-4 px-4 bg-red-50 border border-red-200 text-red-700 rounded text-sm">{error}</div>
  }

  // No active proposal
  if (!proposal) {
    if (!isAdmin) {
      return (
        <div className="text-center py-12 text-gray-500 text-sm">
          No fusion proposal is currently active for this community.
        </div>
      )
    }
    return (
      <>
        <div className="text-center py-8">
          <h3 className="text-lg font-semibold mb-2">Propose a Community Fusion</h3>
          <p className="text-sm text-gray-500 mb-6 max-w-md mx-auto">
            When two communities share values and trust, merging into one can strengthen mutual aid capacity. Both communities vote independently — both must approve.
          </p>
          <button
            onClick={() => setShowModal(true)}
            className="px-6 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
          >
            Propose Fusion
          </button>
        </div>
        {showModal && (
          <FusionProposalModal
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

  const detail = proposalDetail?.proposal ?? proposal
  const myCommunity = proposalDetail?.my_community
  const isPartyB = community.id === detail.community_b_id

  // Executed state
  if (proposal.status === 'executed') {
    return (
      <div className="space-y-4">
        <div className="bg-green-50 border border-green-200 rounded-xl p-6 text-center">
          <div className="text-4xl mb-3">✓</div>
          <h3 className="text-xl font-semibold text-green-800 mb-1">Fusion Complete</h3>
          <p className="text-green-700 text-sm mb-4">
            The communities have merged into <strong>{detail.merged_community_name}</strong>.
          </p>
          {detail.merged_community_id && (
            <a
              href={`/communities/${detail.merged_community_id}`}
              className="inline-block px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700"
            >
              View Merged Community →
            </a>
          )}
        </div>
      </div>
    )
  }

  // Pending acceptance — waiting for Admin B
  if (proposal.status === 'pending_acceptance') {
    // Admin B sees accept/reject
    if (isPartyB && isAdmin) {
      return (
        <div className="space-y-4">
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
            <h3 className="font-semibold text-amber-800 mb-1">Fusion Proposal Received</h3>
            <p className="text-sm text-amber-700">
              Another community admin has proposed merging into <strong>{detail.merged_community_name}</strong>.
            </p>
            {detail.rationale && (
              <p className="text-sm text-amber-600 italic mt-2">"{detail.rationale}"</p>
            )}
          </div>
          <div className="flex gap-3">
            <button
              onClick={handleAccept}
              disabled={accepting || rejecting}
              className="flex-1 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50"
            >
              {accepting ? 'Accepting…' : 'Accept Proposal'}
            </button>
            <button
              onClick={handleReject}
              disabled={accepting || rejecting}
              className="flex-1 py-2 bg-red-500 text-white rounded-lg text-sm font-medium hover:bg-red-600 disabled:opacity-50"
            >
              {rejecting ? 'Rejecting…' : 'Reject Proposal'}
            </button>
          </div>
        </div>
      )
    }
    // Admin A (or member) sees waiting state
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-sm text-gray-600 text-center">
        <p>Fusion proposal sent. Waiting for the target community's admin to accept or reject.</p>
        <p className="mt-1 text-gray-400">Proposed merger name: <strong className="text-gray-600">{detail.merged_community_name}</strong></p>
      </div>
    )
  }

  // Discussion phase
  if (proposal.status === 'discussion') {
    return (
      <div className="space-y-4">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="font-semibold text-blue-800 mb-1">Proposal Accepted — Discussion Phase</h3>
          <p className="text-sm text-blue-700">
            Both communities are considering merging into <strong>{detail.merged_community_name}</strong>.
          </p>
          {detail.rationale && (
            <p className="text-sm text-blue-600 italic mt-2">"{detail.rationale}"</p>
          )}
        </div>
        {isAdmin && (
          <div className="flex justify-end">
            <button
              onClick={handleStartVote}
              disabled={startingVote}
              className="px-6 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 disabled:opacity-50"
            >
              {startingVote ? 'Opening Vote…' : 'Start Community Vote'}
            </button>
          </div>
        )}
      </div>
    )
  }

  // Voting phase
  if (proposal.status === 'voting' && proposalDetail) {
    const myTally = myCommunity === 'a' ? proposalDetail.vote_tally_a : proposalDetail.vote_tally_b
    const otherTally = myCommunity === 'a' ? proposalDetail.vote_tally_b : proposalDetail.vote_tally_a

    return (
      <div className="space-y-5">
        <div>
          <h3 className="text-base font-semibold mb-1">Community Vote — Proposed Fusion</h3>
          <p className="text-sm text-gray-500">
            Merging into <strong>{detail.merged_community_name}</strong>. Both communities must reach quorum and approval.
          </p>
        </div>

        <TallyBar tally={myTally} label="Your Community" />
        <TallyBar tally={otherTally} label="Partner Community" />

        {!myVote ? (
          <div className="flex gap-3">
            <button onClick={() => handleVote('yes')} disabled={voting}
              className="flex-1 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50">
              {voting ? '…' : 'Yes — Merge'}
            </button>
            <button onClick={() => handleVote('no')} disabled={voting}
              className="flex-1 py-2 bg-red-500 text-white rounded-lg text-sm font-medium hover:bg-red-600 disabled:opacity-50">
              {voting ? '…' : 'No — Stay Separate'}
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
  if (proposal.status === 'approved') {
    return (
      <div className="space-y-4">
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="font-semibold text-green-800 mb-1">Both Communities Approved ✓</div>
          <p className="text-sm text-green-700">
            Ready to merge into <strong>{detail.merged_community_name}</strong>.
            {isAdmin && ' Execute the merger when you are ready.'}
          </p>
        </div>
        {isAdmin && (
          <div className="flex justify-end">
            <button
              onClick={handleExecute}
              disabled={executing}
              className="px-6 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 disabled:opacity-50"
            >
              {executing ? 'Executing Fusion…' : 'Execute Fusion'}
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
        The fusion proposal was rejected.
      </div>
    )
  }

  return null
}
