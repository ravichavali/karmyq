import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import { requestService, communityService } from '@/lib/api'
import Layout from '@/components/Layout'

interface HelpRequest {
  id: string
  title: string
  description: string
  status: string
  urgency: string
  category: string
  community_id: string
  community_name: string
  requester_id: string
  requester_name?: string
  created_at: string
}

interface Match {
  id: string
  request_id: string
  responder_id: string
  status: string
  created_at: string
  responder_name?: string
}

interface Community {
  id: string
  name: string
}

export default function Dashboard() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  // Quick create state
  const [description, setDescription] = useState('')
  const [postingMode, setPostingMode] = useState<'all' | 'specific'>('all')
  const [selectedCommunity, setSelectedCommunity] = useState<string>('')
  const [userCommunities, setUserCommunities] = useState<Community[]>([])
  const [creating, setCreating] = useState(false)

  // Request data
  const [myActiveRequests, setMyActiveRequests] = useState<HelpRequest[]>([])
  const [requestMatches, setRequestMatches] = useState<{ [key: string]: Match[] }>({})
  const [communityRequests, setCommunityRequests] = useState<HelpRequest[]>([])

  useEffect(() => {
    const token = localStorage.getItem('token')
    const userData = localStorage.getItem('user')

    if (!token) {
      router.push('/login')
      return
    }

    if (userData) {
      const parsedUser = JSON.parse(userData)
      setUser(parsedUser)
      fetchDashboardData(parsedUser.id)
    }
  }, [router])

  const fetchDashboardData = async (userId: string) => {
    try {
      setLoading(true)

      // Fetch all data in parallel
      const [myRequestsRes, allMatchesRes, suggestedRes, communitiesRes] = await Promise.all([
        requestService.getRequests({ limit: 50 }),
        requestService.getMatches({ limit: 100 }),
        requestService.getRequests({ status: 'open', limit: 50 }),
        communityService.getCommunities(),
      ])

      // Filter my active requests (open or matched status)
      const myReqs = myRequestsRes.data.data.filter(
        (r: HelpRequest) => r.requester_id === userId && (r.status === 'open' || r.status === 'matched')
      )
      setMyActiveRequests(myReqs)

      // Group matches by request_id
      const matchesByRequest: { [key: string]: Match[] } = {}
      allMatchesRes.data.data.forEach((match: Match) => {
        if (!matchesByRequest[match.request_id]) {
          matchesByRequest[match.request_id] = []
        }
        matchesByRequest[match.request_id].push(match)
      })
      setRequestMatches(matchesByRequest)

      // Get request IDs user has responded to
      const respondedRequestIds = new Set(
        allMatchesRes.data.data
          .filter((m: Match) => m.responder_id === userId)
          .map((m: Match) => m.request_id)
      )

      // Community feed (exclude my requests and responded requests)
      const suggested = suggestedRes.data.data.filter(
        (r: HelpRequest) => r.requester_id !== userId && !respondedRequestIds.has(r.id)
      )
      setCommunityRequests(suggested)

      // Set user communities
      setUserCommunities(communitiesRes.data.data)
    } catch (err) {
      console.error('Failed to load dashboard data:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleCreateRequest = async () => {
    if (!description.trim()) return

    try {
      setCreating(true)
      await requestService.createRequest({
        post_to_all_communities: postingMode === 'all',
        community_id: postingMode === 'specific' ? selectedCommunity : undefined,
        description: description.trim(),
        type: 'general',
        urgency: 'medium',
      })

      // Clear form and refresh
      setDescription('')
      setPostingMode('all')
      setSelectedCommunity('')
      if (user) {
        await fetchDashboardData(user.id)
      }
    } catch (error: any) {
      console.error('Error creating request:', error)
      alert(error.response?.data?.message || 'Failed to create request')
    } finally {
      setCreating(false)
    }
  }

  const handleOfferToHelp = async (requestId: string) => {
    if (!user) return

    try {
      await requestService.createMatch({
        request_id: requestId,
        responder_id: user.id,
      })

      // Refresh data
      await fetchDashboardData(user.id)
    } catch (error: any) {
      console.error('Error offering to help:', error)
      alert(error.response?.data?.message || 'Failed to offer help')
    }
  }

  const handleAcceptMatch = async (matchId: string) => {
    if (!user) return

    try {
      await requestService.acceptMatch(matchId, user.id)
      // Refresh data to show updated status
      await fetchDashboardData(user.id)
    } catch (error: any) {
      console.error('Error accepting match:', error)
      alert(error.response?.data?.message || 'Failed to accept offer')
    }
  }

  const handleRejectMatch = async (matchId: string) => {
    if (!user) return

    try {
      await requestService.rejectMatch(matchId, user.id)
      // Refresh data
      await fetchDashboardData(user.id)
    } catch (error: any) {
      console.error('Error rejecting match:', error)
      alert(error.response?.data?.message || 'Failed to reject offer')
    }
  }

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return 'just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays === 1) return 'yesterday'
    if (diffDays < 7) return `${diffDays}d ago`
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  if (!user || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="text-gray-600 mt-4">Loading your dashboard...</p>
        </div>
      </div>
    )
  }

  return (
    <>
      <Head>
        <title>Dashboard - Karmyq</title>
      </Head>
      <Layout>
        <div className="min-h-screen bg-gray-50">
          <div className="container mx-auto px-4 py-6 max-w-4xl">
            {/* Quick Create */}
            <div className="bg-white rounded-xl shadow-sm p-6 mb-6 border border-gray-200">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-semibold flex-shrink-0">
                  {user.name?.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1">
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="What do you need help with?"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                    rows={3}
                  />
                  <div className="flex items-center justify-between mt-3">
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => setPostingMode('all')}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                          postingMode === 'all'
                            ? 'bg-blue-100 text-blue-700'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                      >
                        All My Communities
                      </button>
                      <button
                        onClick={() => setPostingMode('specific')}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                          postingMode === 'specific'
                            ? 'bg-blue-100 text-blue-700'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                      >
                        Specific Community
                      </button>
                    </div>
                    <button
                      onClick={handleCreateRequest}
                      disabled={!description.trim() || creating}
                      className="px-6 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      {creating ? 'Posting...' : 'Post'}
                    </button>
                  </div>
                  {postingMode === 'specific' && (
                    <div className="mt-3">
                      <select
                        value={selectedCommunity}
                        onChange={(e) => setSelectedCommunity(e.target.value)}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      >
                        <option value="">Select a community...</option>
                        {userCommunities.map((community) => (
                          <option key={community.id} value={community.id}>
                            {community.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* My Active Requests */}
            {myActiveRequests.length > 0 && (
              <div className="mb-8">
                <h2 className="text-lg font-semibold text-gray-900 mb-4 px-1">My Active Requests</h2>
                <div className="space-y-4">
                  {myActiveRequests.map((request) => (
                    <div
                      key={request.id}
                      className="bg-amber-50 border-l-4 border-amber-400 rounded-lg shadow-sm overflow-hidden"
                    >
                      <div className="p-6">
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <span className="text-xs font-medium text-amber-700 bg-amber-100 px-2 py-1 rounded">
                                YOUR REQUEST
                              </span>
                              <span className="text-xs text-gray-500">{formatTime(request.created_at)}</span>
                            </div>
                            <p className="text-gray-900 text-base leading-relaxed">{request.description}</p>
                            <div className="flex items-center gap-4 mt-3 text-sm text-gray-600">
                              <span className="flex items-center gap-1">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                                  />
                                </svg>
                                {request.community_name}
                              </span>
                              {requestMatches[request.id] && (
                                <span className="text-amber-700 font-medium">
                                  {requestMatches[request.id].length} {requestMatches[request.id].length === 1 ? 'offer' : 'offers'}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Offers Section */}
                        {requestMatches[request.id] && requestMatches[request.id].length > 0 && (
                          <div className="mt-4 pt-4 border-t border-amber-200">
                            <h3 className="text-sm font-semibold text-gray-900 mb-3">
                              Offers to Help ({requestMatches[request.id].length})
                            </h3>
                            <div className="space-y-3">
                              {requestMatches[request.id].map((match) => (
                                <div key={match.id} className="bg-white rounded-lg p-4 border border-gray-200">
                                  <div className="flex items-start justify-between">
                                    <div className="flex items-center gap-3">
                                      <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white text-sm font-semibold">
                                        {match.responder_name?.charAt(0).toUpperCase() || '?'}
                                      </div>
                                      <div>
                                        <p className="font-medium text-gray-900">{match.responder_name || 'Unknown'}</p>
                                        <p className="text-xs text-gray-500">offered {formatTime(match.created_at)}</p>
                                      </div>
                                    </div>
                                    {match.status === 'proposed' && (
                                      <div className="flex gap-2">
                                        <button
                                          onClick={() => handleAcceptMatch(match.id)}
                                          className="px-4 py-1.5 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 transition-colors font-medium"
                                        >
                                          Accept
                                        </button>
                                        <button
                                          onClick={() => handleRejectMatch(match.id)}
                                          className="px-4 py-1.5 bg-gray-200 text-gray-700 text-sm rounded-lg hover:bg-gray-300 transition-colors font-medium"
                                        >
                                          Decline
                                        </button>
                                      </div>
                                    )}
                                    {match.status === 'matched' && (
                                      <span className="px-3 py-1.5 bg-green-100 text-green-700 text-sm rounded-lg font-medium">
                                        ✓ Accepted
                                      </span>
                                    )}
                                  </div>
                                  {/* TODO: Inline messages will go here */}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Community Requests Feed */}
            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-4 px-1">Community Requests</h2>
              {communityRequests.length === 0 ? (
                <div className="bg-white rounded-xl p-12 text-center border border-gray-200">
                  <div className="text-5xl mb-4">🤝</div>
                  <h3 className="text-xl font-semibold text-gray-700 mb-2">No requests available</h3>
                  <p className="text-gray-500">
                    Check back later to see if anyone in your communities needs help
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {communityRequests.map((request) => (
                      <div
                        key={request.id}
                        className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-shadow"
                      >
                        <div className="p-6">
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex items-center gap-3 flex-1">
                              <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-semibold flex-shrink-0">
                                {request.requester_name?.charAt(0).toUpperCase() || '?'}
                              </div>
                              <div className="flex-1">
                                <p className="font-medium text-gray-900">{request.requester_name || 'Unknown'}</p>
                                <p className="text-sm text-gray-500">{formatTime(request.created_at)}</p>
                              </div>
                            </div>
                          </div>
                          <p className="text-gray-900 mb-3 leading-relaxed">{request.description}</p>
                          <div className="flex items-center gap-4 text-sm text-gray-600 mb-4">
                            <span className="flex items-center gap-1">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                                />
                              </svg>
                              {request.community_name}
                            </span>
                          </div>
                          <button
                            onClick={() => handleOfferToHelp(request.id)}
                            className="w-full px-4 py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
                          >
                            Offer to Help
                          </button>
                        </div>
                      </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </Layout>
    </>
  )
}
