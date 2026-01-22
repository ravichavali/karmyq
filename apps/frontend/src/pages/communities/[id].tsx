import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import Link from 'next/link'
import { communityService } from '@/lib/api'
import Layout from '@/components/Layout'

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
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [activeTab, setActiveTab] = useState<'overview' | 'members' | 'norms'>('overview')
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
        <div className="text-gray-500">Loading...</div>
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
          <div className="bg-white rounded-lg shadow-md p-8 mb-6">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h1 className="text-3xl font-bold mb-2">{community.name}</h1>
                <p className="text-gray-600">{community.description}</p>
              </div>
              {!isMember && !isPending && (
                <button
                  onClick={handleJoinCommunity}
                  disabled={joiningCommunity || community.current_members >= community.max_members}
                  className={`px-6 py-2 rounded disabled:cursor-not-allowed ${
                    joiningCommunity || community.current_members >= community.max_members
                      ? 'bg-gray-400 text-white'
                      : community.access_type === 'private'
                      ? 'bg-purple-600 text-white hover:bg-purple-700'
                      : 'bg-blue-600 text-white hover:bg-blue-700'
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
              <div className="flex items-center gap-6 text-sm text-gray-600">
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
                  className="bg-blue-600 h-2 rounded-full"
                  style={{
                    width: `${(community.current_members / community.max_members) * 100}%`,
                  }}
                ></div>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="bg-white rounded-lg shadow-md mb-6">
            <div className="border-b border-gray-200">
              <nav className="flex">
                <button
                  onClick={() => setActiveTab('overview')}
                  className={`px-6 py-4 font-medium ${
                    activeTab === 'overview'
                      ? 'border-b-2 border-blue-600 text-blue-600'
                      : 'text-gray-600 hover:text-gray-800'
                  }`}
                >
                  Overview
                </button>
                <button
                  onClick={() => setActiveTab('members')}
                  className={`px-6 py-4 font-medium ${
                    activeTab === 'members'
                      ? 'border-b-2 border-blue-600 text-blue-600'
                      : 'text-gray-600 hover:text-gray-800'
                  }`}
                >
                  Members ({community.members.length})
                </button>
                <button
                  onClick={() => setActiveTab('norms')}
                  className={`px-6 py-4 font-medium ${
                    activeTab === 'norms'
                      ? 'border-b-2 border-blue-600 text-blue-600'
                      : 'text-gray-600 hover:text-gray-800'
                  }`}
                >
                  Norms ({norms.length})
                </button>
              </nav>
            </div>

            <div className="p-6">
              {/* Overview Tab */}
              {activeTab === 'overview' && (
                <div>
                  <h3 className="text-xl font-semibold mb-4">About this Community</h3>
                  <p className="text-gray-600 mb-6">
                    {community.description || 'No description provided.'}
                  </p>
                  <div className="grid md:grid-cols-3 gap-4">
                    <div className="bg-blue-50 rounded-lg p-4">
                      <div className="text-3xl font-bold text-blue-600">
                        {community.current_members}
                      </div>
                      <div className="text-sm text-gray-600">Active Members</div>
                    </div>
                    <div className="bg-green-50 rounded-lg p-4">
                      <div className="text-3xl font-bold text-green-600">{norms.filter(n => n.status === 'active').length}</div>
                      <div className="text-sm text-gray-600">Active Norms</div>
                    </div>
                    <div className="bg-purple-50 rounded-lg p-4">
                      <div className="text-3xl font-bold text-purple-600">0</div>
                      <div className="text-sm text-gray-600">Active Requests</div>
                    </div>
                  </div>
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
                        className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                      >
                        Invite Member
                      </button>
                    )}
                  </div>
                  <div className="space-y-3">
                    {community.members.map((member) => (
                      <div
                        key={member.id}
                        className="flex items-center justify-between p-4 bg-gray-50 rounded-lg"
                      >
                        <div>
                          <div className="font-semibold">{member.user_name}</div>
                          <div className="text-sm text-gray-600">{member.user_email}</div>
                          {member.invited_by_name && (
                            <div className="text-xs text-gray-500">
                              Invited by {member.invited_by_name}
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-3">
                          <span
                            className={`px-3 py-1 rounded text-sm font-medium ${
                              member.role === 'admin'
                                ? 'bg-purple-100 text-purple-800'
                                : 'bg-gray-200 text-gray-700'
                            }`}
                          >
                            {member.role}
                          </span>
                          <span className="text-xs text-gray-500">
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
                        className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                      >
                        Propose Norm
                      </button>
                    )}
                  </div>

                  {showNormForm && (
                    <form onSubmit={handleCreateNorm} className="bg-blue-50 p-4 rounded-lg mb-4">
                      <h4 className="font-semibold mb-3">Propose New Norm</h4>
                      <input
                        type="text"
                        placeholder="Norm description"
                        value={newNorm.description}
                        onChange={(e) => setNewNorm({ ...newNorm, description: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 rounded mb-2"
                        required
                      />
                      <textarea
                        placeholder="Rationale (optional)"
                        value={newNorm.rationale}
                        onChange={(e) => setNewNorm({ ...newNorm, rationale: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 rounded mb-2"
                        rows={2}
                      />
                      <div className="flex gap-2">
                        <button
                          type="submit"
                          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                        >
                          Submit
                        </button>
                        <button
                          type="button"
                          onClick={() => setShowNormForm(false)}
                          className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
                        >
                          Cancel
                        </button>
                      </div>
                    </form>
                  )}

                  <div className="space-y-3">
                    {norms.length === 0 ? (
                      <p className="text-gray-500">No norms yet. Members can propose norms to establish community guidelines.</p>
                    ) : (
                      norms.map((norm) => (
                        <div key={norm.id} className="p-4 bg-gray-50 rounded-lg">
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex-1">
                              <p className="font-medium">{norm.description}</p>
                              {norm.rationale && (
                                <p className="text-sm text-gray-600 mt-1">{norm.rationale}</p>
                              )}
                              <p className="text-xs text-gray-500 mt-2">
                                Proposed by {norm.creator_name}
                              </p>
                            </div>
                            <span
                              className={`px-3 py-1 rounded text-sm font-medium ${
                                norm.status === 'active'
                                  ? 'bg-green-100 text-green-800'
                                  : 'bg-yellow-100 text-yellow-800'
                              }`}
                            >
                              {norm.status}
                            </span>
                          </div>
                          <div className="flex items-center justify-between mt-3">
                            <span className="text-sm text-gray-600">
                              {norm.approval_count} approval{norm.approval_count !== 1 ? 's' : ''}
                            </span>
                            {isMember && norm.status === 'proposed' && (
                              <button
                                onClick={() => handleApproveNorm(norm.id)}
                                className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
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
            </div>
          </div>
        </div>

        {/* Invite Member Modal */}
        {showInviteModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-8 max-w-md w-full mx-4">
              <h3 className="text-2xl font-bold mb-4">Invite Member</h3>
              <form onSubmit={handleInviteMember}>
                <div className="mb-4">
                  <label htmlFor="inviteEmail" className="block text-sm font-medium text-gray-700 mb-2">
                    User Email
                  </label>
                  <input
                    type="email"
                    id="inviteEmail"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="user@example.com"
                    required
                  />
                  <p className="mt-2 text-sm text-gray-500">
                    Enter the email address of the person you want to invite. They must have an account.
                  </p>
                </div>
                <div className="flex gap-3">
                  <button
                    type="submit"
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                  >
                    Send Invitation
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowInviteModal(false)
                      setInviteEmail('')
                    }}
                    className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
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
