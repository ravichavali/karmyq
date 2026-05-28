import { useState, useEffect, useCallback } from 'react'
import dynamic from 'next/dynamic'
import { communityService, socialGraphService } from '@/lib/api'
import type { Community } from '@/hooks/useCommunityData'
import FissionProposalModal from '@/components/FissionProposalModal'
import FissionAssignmentView from '@/components/FissionAssignmentView'

const TrustGraph = dynamic(() => import('@/components/TrustGraph'), { ssr: false })

interface Props {
  community: Community
  currentUserId: string
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

export default function FissionTab({ community, currentUserId, isAdmin, onRefresh }: Props) {
  const [showModal, setShowModal] = useState(false)
  const [proposalDetail, setProposalDetail] = useState<ProposalDetail | null>(null)
  const [loading, setLoading] = useState(false)
  const [voting, setVoting] = useState(false)
  const [executing, setExecuting] = useState(false)
  const [error, setError] = useState('')
  const [myVote, setMyVote] = useState<string | null>(null)
  const [childIds, setChildIds] = useState<{ a: string; b: string } | null>(null)
  const [graphData, setGraphData] = useState<{ nodes: any[]; links: any[] } | null>(null)
  const [tableExpanded, setTableExpanded] = useState(false)

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

  useEffect(() => {
    if (!proposal || !['discussion', 'voting', 'approved'].includes(proposal.status)) return
    socialGraphService.getTrustGraph(community.id)
      .then((res: any) => setGraphData(res.data))
      .catch(() => {})
  }, [community.id, proposal?.status])

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
    const groupMap: Record<string, 'group_a' | 'group_b'> = {}
    for (const a of proposalDetail.assignments) {
      if (a.assigned_to === 'group_a' || a.assigned_to === 'group_b') {
        groupMap[a.user_id] = a.assigned_to
      }
    }

    const connectedIds = new Set<string>()
    for (const l of (graphData?.links ?? [])) {
      connectedIds.add(typeof (l as any).source === 'object' ? (l as any).source.id : (l as any).source)
      connectedIds.add(typeof (l as any).target === 'object' ? (l as any).target.id : (l as any).target)
    }
    const existingNodeIds = new Set((graphData?.nodes ?? []).map((n: any) => n.id))
    const fissionGraphData = graphData ? {
      nodes: [
        ...graphData.nodes.map((n: any) => ({ ...n, isIsolated: !connectedIds.has(n.id) })),
        ...proposalDetail.assignments
          .filter(a => !existingNodeIds.has(a.user_id))
          .map(a => ({ id: a.user_id, name: a.user_name, trust_score: 0, karma: 0, isIsolated: true })),
      ],
      links: graphData.links,
    } : null

    const groupACount = proposalDetail.assignments.filter(a => a.assigned_to === 'group_a').length
    const groupBCount = proposalDetail.assignments.filter(a => a.assigned_to === 'group_b').length

    return (
      <div className="space-y-4">
        {fissionGraphData ? (
          <TrustGraph
            graphData={fissionGraphData}
            currentUserId={currentUserId}
            groupMap={groupMap}
            groupALabel={proposalDetail.proposal.group_a_name}
            groupBLabel={proposalDetail.proposal.group_b_name}
          />
        ) : (
          <div className="py-8 text-center text-gray-300 text-sm">Loading trust graph…</div>
        )}

        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <button
            onClick={() => setTableExpanded(v => !v)}
            className="w-full px-4 py-3 flex items-center justify-between bg-gray-50 hover:bg-gray-100 text-sm text-left"
          >
            <span className="text-gray-700">
              <span className="font-medium">Member assignments</span>
              {' — '}
              <span className="text-blue-600">{groupACount} in {proposalDetail.proposal.group_a_name}</span>
              {', '}
              <span className="text-orange-600">{groupBCount} in {proposalDetail.proposal.group_b_name}</span>
            </span>
            <span className="text-gray-400 text-xs shrink-0 ml-4">{tableExpanded ? 'collapse ↑' : 'expand ↓'}</span>
          </button>
          {tableExpanded && (
            <div className="p-4 border-t border-gray-200">
              <FissionAssignmentView
                communityId={community.id}
                splitId={proposal.id}
                proposal={proposalDetail.proposal}
                assignments={proposalDetail.assignments}
                onStartVote={() => { onRefresh(); fetchDetail() }}
                onRefresh={fetchDetail}
              />
            </div>
          )}
        </div>
      </div>
    )
  }

  // Voting phase — all members vote
  if (proposal.status === 'voting' && proposalDetail) {
    const { vote_tally: tally, proposal: detail, assignments } = proposalDetail
    const userAssignment = assignments.find(a => a.user_id === currentUserId)

    const voteGroupMap = Object.fromEntries(
      assignments
        .filter(a => a.assigned_to === 'group_a' || a.assigned_to === 'group_b')
        .map(a => [a.user_id, a.assigned_to as 'group_a' | 'group_b'])
    )
    const voteConnectedIds = new Set<string>()
    for (const l of (graphData?.links ?? [])) {
      voteConnectedIds.add(typeof (l as any).source === 'object' ? (l as any).source.id : (l as any).source)
      voteConnectedIds.add(typeof (l as any).target === 'object' ? (l as any).target.id : (l as any).target)
    }
    const voteExistingIds = new Set((graphData?.nodes ?? []).map((n: any) => n.id))
    const voteFissionGraphData = graphData ? {
      nodes: [
        ...graphData.nodes.map((n: any) => ({ ...n, isIsolated: !voteConnectedIds.has(n.id) })),
        ...assignments
          .filter(a => !voteExistingIds.has(a.user_id))
          .map(a => ({ id: a.user_id, name: a.user_name, trust_score: 0, karma: 0, isIsolated: true })),
      ],
      links: graphData.links,
    } : null

    return (
      <div className="space-y-5">
        {voteFissionGraphData ? (
          <TrustGraph
            graphData={voteFissionGraphData}
            currentUserId={currentUserId}
            groupMap={voteGroupMap}
            groupALabel={detail.group_a_name}
            groupBLabel={detail.group_b_name}
          />
        ) : (
          <div className="py-8 text-center text-gray-300 text-sm">Loading trust graph…</div>
        )}

        <div>
          <h3 className="text-base font-semibold mb-1">Community Vote — Proposed Split</h3>
          {detail.rationale && (
            <p className="text-sm text-gray-500 italic">"{detail.rationale}"</p>
          )}
          {userAssignment && (
            <p className="text-sm text-gray-500 mt-1">
              You are in: <strong className={userAssignment.assigned_to === 'group_a' ? 'text-blue-600' : 'text-orange-600'}>
                {userAssignment.assigned_to === 'group_a' ? detail.group_a_name : detail.group_b_name}
              </strong>
            </p>
          )}
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
