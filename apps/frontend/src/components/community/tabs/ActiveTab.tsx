import React, { useState } from 'react'
import { communityService } from '@/lib/api'
import type { Community } from '@/hooks/useCommunityData'

interface Norm {
  id: string
  description: string
  rationale: string
  status: string
  creator_name: string
  approval_count: number
  created_at: string
}

interface Props {
  community: Community
  norms: Norm[]
  memberTrustScores: Record<string, number | null>
  currentUser: any
  isAdmin: boolean
  isAdminOrMod: boolean
  isMember: boolean
  communityId: string
  refetchCommunity: () => Promise<void>
  refetchNorms: () => Promise<void>
}

export default function ActiveTab({
  community, norms, memberTrustScores, currentUser,
  isAdmin, isAdminOrMod, isMember, communityId,
  refetchCommunity, refetchNorms,
}: Props) {
  const [normAccordionOpen, setNormAccordionOpen] = useState<Record<string, boolean>>({})
  const [normsOpen, setNormsOpen] = useState(false)
  const [showNormForm, setShowNormForm] = useState(false)
  const [newNorm, setNewNorm] = useState({ description: '', rationale: '' })
  const [showInviteModal, setShowInviteModal] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')

  const pendingCount = isAdminOrMod
    ? (community?.members ?? []).filter((m: any) => m.status === 'pending').length
    : 0

  const handleUpdateMemberRole = async (userId: string, newRole: string) => {
    if (!currentUser) return
    try {
      await communityService.updateMember(communityId, userId, { role: newRole, admin_user_id: currentUser.id })
      refetchCommunity()
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to update member role')
    }
  }

  const handleApproveMember = async (userId: string) => {
    if (!currentUser) return
    try {
      await communityService.updateMember(communityId, userId, { status: 'active', admin_user_id: currentUser.id })
      refetchCommunity()
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to approve member')
    }
  }

  const handleRejectMember = async (userId: string) => {
    if (!currentUser) return
    try {
      await communityService.removeMember(communityId, userId)
      refetchCommunity()
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to reject member')
    }
  }

  const handleRemoveMember = async (userId: string, userName: string) => {
    if (!currentUser) return
    if (!confirm(`Are you sure you want to remove ${userName} from the community?`)) return
    try {
      await communityService.removeMember(communityId, userId)
      refetchCommunity()
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to remove member')
    }
  }

  const handleCreateNorm = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!currentUser || !newNorm.description) return
    try {
      await communityService.createNorm(communityId, {
        description: newNorm.description,
        rationale: newNorm.rationale,
        created_by: currentUser.id,
      })
      setNewNorm({ description: '', rationale: '' })
      setShowNormForm(false)
      refetchNorms()
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to create norm')
    }
  }

  const handleApproveNorm = async (normId: string) => {
    if (!currentUser) return
    try {
      await communityService.approveNorm(communityId, normId, currentUser.id)
      refetchNorms()
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to approve norm')
    }
  }

  const handleInviteMember = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!inviteEmail) return
    alert(`Invitation feature coming soon! Would invite: ${inviteEmail}`)
    setShowInviteModal(false)
    setInviteEmail('')
  }

  return (
    <div>
      {/* Pending requests — admin/mod only, shown when there are pending members */}
      {isAdminOrMod && pendingCount > 0 && (
        <div className="mb-6">
          <h3 className="text-sm font-semibold text-text-muted uppercase tracking-wider mb-3">
            Pending Requests ({pendingCount})
          </h3>
          <div className="space-y-2">
            {(community.members ?? [])
              .filter((m: any) => m.status === 'pending')
              .map((member) => (
                <div key={member.user_id} className="flex items-center justify-between p-3 bg-amber-50 border border-amber-200 rounded-lg">
                  <div>
                    <div className="font-medium text-sm">{member.user_name}</div>
                    <div className="text-xs text-text-muted">{member.user_email}</div>
                    {member.join_request_message && (
                      <div className="mt-1 text-xs text-text-muted bg-surface-raised p-1.5 rounded border border-amber-200">
                        {member.join_request_message}
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2 ml-4 flex-shrink-0">
                    <button
                      onClick={() => handleApproveMember(member.user_id)}
                      className="px-3 py-1 bg-primary text-white rounded text-sm hover:bg-primary-dark"
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => handleRejectMember(member.user_id)}
                      className="px-3 py-1 bg-surface border border-border rounded text-sm text-text-muted hover:bg-surface-raised"
                    >
                      Reject
                    </button>
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Active members */}
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-xl font-semibold">
          Members ({(community.members ?? []).filter((m: any) => m.status === 'active').length})
        </h3>
        {isAdminOrMod && (
          <button
            onClick={() => setShowInviteModal(true)}
            className="px-4 py-2 bg-primary text-white rounded hover:bg-primary-dark text-sm"
          >
            Invite Member
          </button>
        )}
      </div>

      {/* Non-admin: card view */}
      {!isAdminOrMod && !community?.members ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="p-4 bg-surface rounded-lg animate-pulse">
              <div className="h-4 bg-border rounded w-1/3 mb-2" />
              <div className="h-3 bg-border rounded w-1/4" />
            </div>
          ))}
        </div>
      ) : !isAdminOrMod ? (
        <div className="space-y-3">
          {community.members.map((member) => (
            <div key={member.id} className="flex items-center justify-between p-4 bg-surface rounded-lg">
              <div>
                <div className="font-semibold">{member.user_name}</div>
                <div className="text-sm text-text-muted">{member.user_email}</div>
                {member.invited_by_name && (
                  <div className="text-xs text-text-subtle">Invited by {member.invited_by_name}</div>
                )}
              </div>
              <div className="flex items-center gap-3">
                <span className={`px-3 py-1 rounded text-sm font-medium ${
                  member.role === 'admin' ? 'bg-accent-light text-accent-dark' : 'bg-surface-raised text-text-muted'
                }`}>{member.role}</span>
                {(() => {
                  const score = memberTrustScores[member.user_id]
                  const colorClass = score === null || score === undefined
                    ? 'bg-surface-raised text-text-subtle'
                    : score >= 75 ? 'bg-green-100 text-green-700'
                    : score >= 50 ? 'bg-amber-100 text-amber-700'
                    : 'bg-surface-raised text-text-subtle'
                  return (
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${colorClass}`}>
                      {score !== null && score !== undefined ? `★ ${score}` : '—'}
                    </span>
                  )
                })()}
                <span className="text-xs text-text-subtle">
                  {new Date(member.joined_at).toLocaleDateString()}
                </span>
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {/* Admin/Mod: active members table */}
      {isAdminOrMod && (
        <div className="overflow-x-auto mb-6">
          <table className="min-w-full divide-y divide-border">
            <thead className="bg-surface">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-text-muted uppercase tracking-wider">Name</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-text-muted uppercase tracking-wider">Email</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-text-muted uppercase tracking-wider">Joined</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-text-muted uppercase tracking-wider">Role</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="bg-surface-raised divide-y divide-border">
              {(community.members ?? [])
                .filter((m: any) => m.status === 'active')
                .map((member) => {
                  const isSelf = member.user_id === currentUser?.id
                  const isCreator = member.user_id === community?.creator_id
                  const disabled = isSelf || isCreator
                  return (
                    <tr key={member.user_id}>
                      <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-text">{member.user_name}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-text-muted">{member.user_email}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-text-muted">{new Date(member.joined_at).toLocaleDateString()}</td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {isAdmin ? (
                          <select
                            value={member.role}
                            onChange={(e) => handleUpdateMemberRole(member.user_id, e.target.value)}
                            disabled={disabled}
                            className="px-3 py-1 border border-border rounded text-sm disabled:bg-border-light"
                          >
                            <option value="member">Member</option>
                            <option value="moderator">Moderator</option>
                            <option value="admin">Admin</option>
                          </select>
                        ) : (
                          <span className="px-3 py-1 text-sm text-text-muted">{member.role}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-right">
                        {isAdmin && !isSelf && !isCreator ? (
                          <button
                            onClick={() => handleRemoveMember(member.user_id, member.user_name)}
                            className="px-3 py-1 bg-red-100 text-red-700 rounded text-sm hover:bg-red-200"
                          >
                            Remove
                          </button>
                        ) : isCreator ? (
                          <span className="px-3 py-1 bg-accent-light text-accent-dark rounded text-sm">Creator</span>
                        ) : null}
                      </td>
                    </tr>
                  )
                })}
            </tbody>
          </table>
        </div>
      )}

      {/* Norms — collapsible */}
      <div className="border-t border-border mt-6 pt-4">
        <button
          onClick={() => setNormsOpen(o => !o)}
          className="flex items-center justify-between w-full text-left text-sm font-medium text-text-muted hover:text-text py-1"
        >
          <span>Community Norms ({norms.length})</span>
          <span>{normsOpen ? '▲' : '▼'}</span>
        </button>
        {normsOpen && (
          <div className="mt-3">
            <div className="flex justify-between items-center mb-3">
              <span className="text-base font-semibold text-text">Norms</span>
              {isMember && !showNormForm && (
                <button
                  onClick={() => setShowNormForm(true)}
                  className="px-3 py-1.5 bg-primary text-white rounded text-sm hover:bg-primary-dark"
                >
                  Propose Norm
                </button>
              )}
            </div>

            {showNormForm && (
              <form onSubmit={handleCreateNorm} className="bg-primary-light p-4 rounded-lg mb-4">
                <h4 className="font-semibold mb-3">Propose New Norm</h4>
                <input
                  type="text"
                  placeholder="Norm description"
                  value={newNorm.description}
                  onChange={(e) => setNewNorm({ ...newNorm, description: e.target.value })}
                  className="w-full px-4 py-2 border border-border rounded mb-2"
                  required
                />
                <textarea
                  placeholder="Rationale (optional)"
                  value={newNorm.rationale}
                  onChange={(e) => setNewNorm({ ...newNorm, rationale: e.target.value })}
                  className="w-full px-4 py-2 border border-border rounded mb-2"
                  rows={2}
                />
                <div className="flex gap-2">
                  <button type="submit" className="px-4 py-2 bg-primary text-white rounded hover:bg-primary-dark">Submit</button>
                  <button type="button" onClick={() => setShowNormForm(false)} className="px-4 py-2 bg-surface-raised text-text-muted rounded hover:bg-border-light">Cancel</button>
                </div>
              </form>
            )}

            <div className="space-y-2">
              {norms.length === 0 ? (
                <p className="text-text-subtle text-sm">No norms yet. Members can propose norms to establish community guidelines.</p>
              ) : (
                norms.map((norm) => (
                  <div key={norm.id} className="bg-surface rounded-lg border border-border overflow-hidden">
                    <button
                      onClick={() => setNormAccordionOpen(prev => ({ ...prev, [norm.id]: !prev[norm.id] }))}
                      className="w-full flex items-center justify-between p-4 text-left hover:bg-surface-raised transition"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="text-sm font-medium text-text truncate">{norm.description}</span>
                        <span className={`flex-shrink-0 px-2 py-0.5 rounded text-xs font-medium ${
                          norm.status === 'active' ? 'bg-success-light text-green-800' : 'bg-yellow-100 text-yellow-800'
                        }`}>{norm.status}</span>
                      </div>
                      <span className="text-text-muted ml-2 flex-shrink-0">{normAccordionOpen[norm.id] ? '▾' : '▸'}</span>
                    </button>
                    {normAccordionOpen[norm.id] && (
                      <div className="px-4 pb-4 border-t border-border pt-3">
                        {norm.rationale && <p className="text-sm text-text-muted mb-2">{norm.rationale}</p>}
                        <p className="text-xs text-text-subtle">
                          Proposed by {norm.creator_name} &middot; {norm.approval_count} approval{norm.approval_count !== 1 ? 's' : ''}
                        </p>
                        {isMember && norm.status === 'proposed' && (
                          <button
                            onClick={() => handleApproveNorm(norm.id)}
                            className="mt-2 px-3 py-1 bg-primary text-white text-sm rounded hover:bg-primary-dark"
                          >
                            Approve
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {/* Invite Member Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-surface-raised rounded-lg p-8 max-w-md w-full mx-4">
            <h3 className="text-2xl font-bold mb-4">Invite Member</h3>
            <form onSubmit={handleInviteMember}>
              <div className="mb-4">
                <label htmlFor="inviteEmail" className="block text-sm font-medium text-text-muted mb-2">User Email</label>
                <input
                  type="email"
                  id="inviteEmail"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  className="w-full px-4 py-2 border border-border rounded focus:ring-2 focus:ring-primary focus:border-transparent"
                  placeholder="user@example.com"
                  required
                />
                <p className="mt-2 text-sm text-text-subtle">
                  Enter the email address of the person you want to invite. They must have an account.
                </p>
              </div>
              <div className="flex gap-3">
                <button type="submit" className="flex-1 px-4 py-2 bg-primary text-white rounded hover:bg-primary-dark">
                  Send Invitation
                </button>
                <button
                  type="button"
                  onClick={() => { setShowInviteModal(false); setInviteEmail('') }}
                  className="px-4 py-2 bg-gray-200 text-text-muted rounded hover:bg-gray-300"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
