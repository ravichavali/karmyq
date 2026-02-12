import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import Link from 'next/link'
import { communityService } from '@/lib/api'
import Layout from '@/components/Layout'
import CommunityConfigEditor from '@/components/CommunityConfigEditor'
import { CommunityConfig } from '@/types/community-config'

interface Member {
  id: string
  user_id: string
  user_name: string
  user_email: string
  role: string
  status: string
  joined_at: string
  invited_by_name?: string
}

interface Norm {
  id: string
  description: string
  rationale: string
  status: string
  creator_name: string
  approval_count: number
  created_at: string
}

interface Community {
  id: string
  name: string
  description: string
  current_members: number
  max_members: number
  access_type: 'public' | 'private'
  creator_id: string
  creator_name: string
  status: string
  members: Member[]
}

export default function CommunityDetailPage() {
  const router = useRouter()
  const { id } = router.query
  const [community, setCommunity] = useState<Community | null>(null)
  const [norms, setNorms] = useState<Norm[]>([])
  const [config, setConfig] = useState<CommunityConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [activeTab, setActiveTab] = useState<'overview' | 'members' | 'norms' | 'config'>('overview')
  const [newNorm, setNewNorm] = useState({ description: '', rationale: '' })
  const [showNormForm, setShowNormForm] = useState(false)
  const [showInviteModal, setShowInviteModal] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [joiningCommunity, setJoiningCommunity] = useState(false)

  useEffect(() => {
    // Only run on client-side (not during SSR)
    if (typeof window === 'undefined') {
      return
    }

    const token = localStorage.getItem('token')
    const userData = localStorage.getItem('user')
    if (!token) {
      router.push('/login')
      return
    }
    if (userData) {
      setCurrentUser(JSON.parse(userData))
    }
  }, [router])

  useEffect(() => {
    if (id) {
      fetchCommunity()
      fetchNorms()
      fetchConfig()
    }
  }, [id])

  const fetchCommunity = async () => {
    try {
      setLoading(true)
      const response = await communityService.getCommunity(id as string)
      setCommunity(response.data)
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load community')
    } finally {
      setLoading(false)
    }
  }

  const fetchNorms = async () => {
    try {
      const response = await communityService.getNorms(id as string)
      setNorms(response.data.norms || response.data)
    } catch (err: any) {
      console.error('Failed to load norms:', err)
    }
  }

  const fetchConfig = async () => {
    try {
      const response = await communityService.getConfig(id as string)
      // Backend returns { data: { config: {...}, community_id, template_source } }
      // Response interceptor unwraps outer layer, so response.data.config contains the actual config
      setConfig(response.data.config)
    } catch (err: any) {
      console.error('Failed to load configuration:', err)
    }
  }

  const handleCreateNorm = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!currentUser || !newNorm.description) return

    try {
      await communityService.createNorm(id as string, {
        description: newNorm.description,
        rationale: newNorm.rationale,
        created_by: currentUser.id,
      })
      setNewNorm({ description: '', rationale: '' })
      setShowNormForm(false)
      fetchNorms()
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to create norm')
    }
  }

  const handleApproveNorm = async (normId: string) => {
    if (!currentUser) return
    try {
      await communityService.approveNorm(id as string, normId, currentUser.id)
      fetchNorms()
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to approve norm')
    }
  }

  const handleJoinCommunity = async () => {
    if (!currentUser || !id || !community) return

    setJoiningCommunity(true)
    try {
      await communityService.joinCommunity(id as string, {
        user_id: currentUser.id
      })
      // Refresh community data to show updated member list
      await fetchCommunity()

      if (community.access_type === 'public') {
        alert('Successfully joined the community!')
      } else {
        alert('Join request submitted! Waiting for admin approval.')
      }
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to join community')
    } finally {
      setJoiningCommunity(false)
    }
  }

  const handleInviteMember = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!currentUser || !id || !inviteEmail) return

    try {
      // In a real app, you'd look up the user by email first
      // For now, this is a placeholder - you'd need a user lookup endpoint
      alert(`Invitation feature coming soon! Would invite: ${inviteEmail}`)
      setShowInviteModal(false)
      setInviteEmail('')
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to send invitation')
    }
  }

  const membershipRecord = community?.members.find((m: Member) => m.user_id === currentUser?.id)
  const isMember = membershipRecord?.status === 'active'
  const isPending = membershipRecord?.status === 'pending'
  const isAdmin = membershipRecord?.role === 'admin' && membershipRecord?.status === 'active'

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-text-subtle">Loading...</div>
      </div>
    )
  }

  if (error || !community) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-red-500">{error || 'Community not found'}</div>
      </div>
    )
  }

  return (
    <>
      <Head>
        <title>{community.name} - Karmyq</title>
      </Head>
      <Layout title={community.name}>
        <div className="container mx-auto px-4 py-8">
          {/* Community Header */}
          <div className="bg-surface-raised rounded-lg shadow-md p-8 mb-6">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h1 className="text-3xl font-bold mb-2">{community.name}</h1>
                <p className="text-text-muted">{community.description}</p>
              </div>
              {!isMember && !isPending && (
                <button
                  onClick={handleJoinCommunity}
                  disabled={joiningCommunity || community.current_members >= community.max_members}
                  className={`px-6 py-2 rounded disabled:cursor-not-allowed ${
                    joiningCommunity || community.current_members >= community.max_members
                      ? 'bg-gray-400 text-white'
                      : community.access_type === 'private'
                      ? 'bg-accent text-white hover:bg-accent-dark'
                      : 'bg-primary text-white hover:bg-primary-dark'
                  }`}
                >
                  {joiningCommunity
                    ? 'Joining...'
                    : community.current_members >= community.max_members
                    ? 'Community Full'
                    : community.access_type === 'private'
                    ? 'Request to Join'
                    : 'Join Community'}
                </button>
              )}
              {isPending && (
                <div className="px-6 py-2 bg-yellow-100 text-yellow-800 rounded font-medium">
                  ⏳ Join Request Pending
                </div>
              )}
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-6 text-sm text-text-muted">
                <span>Created by {community.creator_name}</span>
                <span>•</span>
                <span>
                  {community.current_members} / {community.max_members} members
                </span>
              </div>
              {isAdmin && (
                <Link
                  href={`/communities/${id}/admin`}
                  className="px-4 py-2 bg-gray-800 text-white rounded hover:bg-gray-900 text-sm font-medium"
                >
                  Admin Settings
                </Link>
              )}
            </div>
            <div className="mt-4">
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-primary h-2 rounded-full"
                  style={{
                    width: `${(community.current_members / community.max_members) * 100}%`,
                  }}
                ></div>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="bg-surface-raised rounded-lg shadow-md mb-6">
            <div className="border-b border-border">
              <nav className="flex">
                <button
                  onClick={() => setActiveTab('overview')}
                  className={`px-6 py-4 font-medium ${
                    activeTab === 'overview'
                      ? 'border-b-2 border-primary text-primary'
                      : 'text-text-muted hover:text-text'
                  }`}
                >
                  Overview
                </button>
                <button
                  onClick={() => setActiveTab('members')}
                  className={`px-6 py-4 font-medium ${
                    activeTab === 'members'
                      ? 'border-b-2 border-primary text-primary'
                      : 'text-text-muted hover:text-text'
                  }`}
                >
                  Members ({community.members.length})
                </button>
                <button
                  onClick={() => setActiveTab('norms')}
                  className={`px-6 py-4 font-medium ${
                    activeTab === 'norms'
                      ? 'border-b-2 border-primary text-primary'
                      : 'text-text-muted hover:text-text'
                  }`}
                >
                  Norms ({norms.length})
                </button>
                <button
                  onClick={() => setActiveTab('config')}
                  className={`px-6 py-4 font-medium ${
                    activeTab === 'config'
                      ? 'border-b-2 border-primary text-primary'
                      : 'text-text-muted hover:text-text'
                  }`}
                >
                  Configuration
                </button>
              </nav>
            </div>

            <div className="p-6">
              {/* Overview Tab */}
              {activeTab === 'overview' && (
                <div>
                  <h3 className="text-xl font-semibold mb-4">About this Community</h3>
                  <p className="text-text-muted mb-6">
                    {community.description || 'No description provided.'}
                  </p>
                  <div className="grid md:grid-cols-3 gap-4 mb-8">
                    <div className="bg-primary-light rounded-lg p-4">
                      <div className="text-3xl font-bold text-primary">
                        {community.current_members}
                      </div>
                      <div className="text-sm text-text-muted">Active Members</div>
                    </div>
                    <div className="bg-success-light rounded-lg p-4">
                      <div className="text-3xl font-bold text-success">{norms.filter(n => n.status === 'active').length}</div>
                      <div className="text-sm text-text-muted">Active Norms</div>
                    </div>
                    <div className="bg-accent-light rounded-lg p-4">
                      <div className="text-3xl font-bold text-accent">0</div>
                      <div className="text-sm text-text-muted">Active Requests</div>
                    </div>
                  </div>

                  {/* Configuration Highlights */}
                  {config && (
                    <div className="mt-8">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-xl font-semibold">How This Community Works</h3>
                        <button
                          onClick={() => setActiveTab('config')}
                          className="text-sm text-primary hover:text-primary-dark font-medium"
                        >
                          View Full Configuration →
                        </button>
                      </div>

                      <div className="grid md:grid-cols-2 gap-6">
                        {/* Karma Mechanics */}
                        <div className="bg-gradient-to-br from-yellow-50 to-amber-50 border border-yellow-200 rounded-lg p-5">
                          <h4 className="font-semibold text-text mb-3 flex items-center gap-2">
                            <span className="text-xl">💎</span>
                            Karma Mechanics
                          </h4>
                          <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                              <span className="text-text-muted">Karma Split:</span>
                              <span className="font-medium text-text">
                                {config.karma_split_helper}% helper / {config.karma_split_requestor}% requestor
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-text-muted">Base Pool:</span>
                              <span className="font-medium text-text">{config.base_karma_pool_per_request} karma</span>
                            </div>
                            {config.karma_decay_half_life_days > 0 && (
                              <div className="flex justify-between">
                                <span className="text-text-muted">Karma Decay:</span>
                                <span className="font-medium text-text">{config.karma_decay_half_life_days} day half-life</span>
                              </div>
                            )}
                            {config.karma_decay_half_life_days === 0 && (
                              <div className="text-xs text-text-muted mt-1">
                                ✓ Karma is bankable (no decay)
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Trust Mechanics */}
                        <div className="bg-gradient-to-br from-primary-light to-accent-light border border-primary-medium rounded-lg p-5">
                          <h4 className="font-semibold text-text mb-3 flex items-center gap-2">
                            <span className="text-xl">🤝</span>
                            Trust Mechanics
                          </h4>
                          <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                              <span className="text-text-muted">Trust Model:</span>
                              <span className="font-medium text-text">
                                {config.trust_depth_weight > 0.6 ? 'Depth-focused' :
                                 config.trust_breadth_weight > 0.6 ? 'Breadth-focused' : 'Balanced'}
                              </span>
                            </div>
                            <div className="flex justify-between text-xs text-text-muted">
                              <span>{Math.round(config.trust_depth_weight * 100)}% depth</span>
                              <span>{Math.round(config.trust_breadth_weight * 100)}% breadth</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-text-muted">Trust Decay:</span>
                              <span className="font-medium text-text">{config.trust_decay_half_life_days} days</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-text-muted">Max Hops:</span>
                              <span className="font-medium text-text">{config.trust_path_max_hops} connections</span>
                            </div>
                          </div>
                        </div>

                        {/* Request Types */}
                        <div className="bg-gradient-to-br from-accent-light to-karmyq-brown-50 border border-accent rounded-lg p-5">
                          <h4 className="font-semibold text-text mb-3 flex items-center gap-2">
                            <span className="text-xl">📋</span>
                            Request Types
                          </h4>
                          <div className="flex flex-wrap gap-2">
                            {config.enabled_request_types.map((type) => (
                              <span
                                key={type.name}
                                className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium bg-surface-raised border border-accent text-text-muted"
                                title={type.description}
                              >
                                {type.name.replace(/_/g, ' ')}
                                {type.karma_multiplier !== 1.0 && (
                                  <span className="text-xs text-accent font-semibold">
                                    ×{type.karma_multiplier}
                                  </span>
                                )}
                              </span>
                            ))}
                          </div>
                          {config.enabled_request_types.length === 0 && (
                            <p className="text-sm text-text-subtle">No request types configured</p>
                          )}
                        </div>

                        {/* Community Rules */}
                        <div className="bg-gradient-to-br from-karmyq-green-50 to-karmyq-green-100 border border-success rounded-lg p-5">
                          <h4 className="font-semibold text-text mb-3 flex items-center gap-2">
                            <span className="text-xl">📜</span>
                            Community Rules
                          </h4>
                          <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                              <span className="text-text-muted">Size Limit:</span>
                              <span className="font-medium text-text">
                                {community.current_members} / {config.member_cap} members
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-text-muted">Visibility:</span>
                              <span className="font-medium text-text">
                                {config.visibility_mode === 'public' ? '👁️ Public' :
                                 config.visibility_mode === 'members_only' ? '🔒 Members Only' :
                                 '🔓 Hybrid'}
                              </span>
                            </div>
                            {config.join_approval_required && (
                              <div className="text-xs text-text-muted">✓ Join approval required</div>
                            )}
                            {config.request_approval_required && (
                              <div className="text-xs text-text-muted">✓ Request approval required</div>
                            )}
                            {config.new_member_karma_lockout_days > 0 && (
                              <div className="text-xs text-text-muted">
                                ⚠️ {config.new_member_karma_lockout_days} day karma lockout for new members
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      {config.template_source && (
                        <div className="mt-4 bg-primary-light border border-primary-medium rounded-lg p-4">
                          <p className="text-sm text-primary-dark">
                            <strong>Based on Template:</strong> {config.template_source}
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Members Tab */}
              {activeTab === 'members' && (
                <div>
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-xl font-semibold">Members</h3>
                    {isAdmin && (
                      <button
                        onClick={() => setShowInviteModal(true)}
                        className="px-4 py-2 bg-primary text-white rounded hover:bg-primary-dark"
                      >
                        Invite Member
                      </button>
                    )}
                  </div>
                  <div className="space-y-3">
                    {community.members.map((member) => (
                      <div
                        key={member.id}
                        className="flex items-center justify-between p-4 bg-surface rounded-lg"
                      >
                        <div>
                          <div className="font-semibold">{member.user_name}</div>
                          <div className="text-sm text-text-muted">{member.user_email}</div>
                          {member.invited_by_name && (
                            <div className="text-xs text-text-subtle">
                              Invited by {member.invited_by_name}
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-3">
                          <span
                            className={`px-3 py-1 rounded text-sm font-medium ${
                              member.role === 'admin'
                                ? 'bg-accent-light text-accent-dark'
                                : 'bg-gray-200 text-text-muted'
                            }`}
                          >
                            {member.role}
                          </span>
                          <span className="text-xs text-text-subtle">
                            {new Date(member.joined_at).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Norms Tab */}
              {activeTab === 'norms' && (
                <div>
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-xl font-semibold">Community Norms</h3>
                    {isMember && !showNormForm && (
                      <button
                        onClick={() => setShowNormForm(true)}
                        className="px-4 py-2 bg-primary text-white rounded hover:bg-primary-dark"
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
                        <button
                          type="submit"
                          className="px-4 py-2 bg-primary text-white rounded hover:bg-primary-dark"
                        >
                          Submit
                        </button>
                        <button
                          type="button"
                          onClick={() => setShowNormForm(false)}
                          className="px-4 py-2 bg-gray-200 text-text-muted rounded hover:bg-gray-300"
                        >
                          Cancel
                        </button>
                      </div>
                    </form>
                  )}

                  <div className="space-y-3">
                    {norms.length === 0 ? (
                      <p className="text-text-subtle">No norms yet. Members can propose norms to establish community guidelines.</p>
                    ) : (
                      norms.map((norm) => (
                        <div key={norm.id} className="p-4 bg-surface rounded-lg">
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex-1">
                              <p className="font-medium">{norm.description}</p>
                              {norm.rationale && (
                                <p className="text-sm text-text-muted mt-1">{norm.rationale}</p>
                              )}
                              <p className="text-xs text-text-subtle mt-2">
                                Proposed by {norm.creator_name}
                              </p>
                            </div>
                            <span
                              className={`px-3 py-1 rounded text-sm font-medium ${
                                norm.status === 'active'
                                  ? 'bg-success-light text-green-800'
                                  : 'bg-yellow-100 text-yellow-800'
                              }`}
                            >
                              {norm.status}
                            </span>
                          </div>
                          <div className="flex items-center justify-between mt-3">
                            <span className="text-sm text-text-muted">
                              {norm.approval_count} approval{norm.approval_count !== 1 ? 's' : ''}
                            </span>
                            {isMember && norm.status === 'proposed' && (
                              <button
                                onClick={() => handleApproveNorm(norm.id)}
                                className="px-3 py-1 bg-primary text-white text-sm rounded hover:bg-primary-dark"
                              >
                                Approve
                              </button>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

              {/* Configuration Tab */}
              {activeTab === 'config' && config && (
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-xl font-semibold">Community Configuration</h3>
                    {community.creator_id === currentUser?.id && (
                      <Link
                        href={`/communities/${id}/admin?tab=config`}
                        className="px-4 py-2 bg-primary text-white rounded hover:bg-primary-dark text-sm font-medium"
                      >
                        Edit Configuration
                      </Link>
                    )}
                  </div>
                  <p className="text-text-muted mb-6">
                    View the configuration that defines how trust, karma, and coordination work in this community.
                    {community.creator_id === currentUser?.id && ' Click "Edit Configuration" to make changes.'}
                  </p>

                  <CommunityConfigEditor
                    config={config}
                    onChange={() => {}} // No-op for read-only
                    readOnly={true}
                    errors={{}}
                  />

                  {config.template_source && (
                    <div className="mt-6 bg-primary-light border border-primary-medium rounded-lg p-4">
                      <p className="text-sm text-primary-dark">
                        <strong>Template:</strong> This community was created using the "{config.template_source}" template.
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Invite Member Modal */}
        {showInviteModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-surface-raised rounded-lg p-8 max-w-md w-full mx-4">
              <h3 className="text-2xl font-bold mb-4">Invite Member</h3>
              <form onSubmit={handleInviteMember}>
                <div className="mb-4">
                  <label htmlFor="inviteEmail" className="block text-sm font-medium text-text-muted mb-2">
                    User Email
                  </label>
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
                  <button
                    type="submit"
                    className="flex-1 px-4 py-2 bg-primary text-white rounded hover:bg-primary-dark"
                  >
                    Send Invitation
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowInviteModal(false)
                      setInviteEmail('')
                    }}
                    className="px-4 py-2 bg-gray-200 text-text-muted rounded hover:bg-gray-300"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </Layout>
    </>
  )
}
