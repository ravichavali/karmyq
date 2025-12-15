import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import { requestService, communityService } from '@/lib/api'
import { feedApi } from '@/lib/api'
import Layout from '@/components/Layout'
import InlineChat from '@/components/InlineChat'
import LeftSidebar from '@/components/LeftSidebar'
import RightSidebar from '@/components/RightSidebar'
import MilestonePost from '@/components/MilestonePost'

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
  requester_name?: string
  request_description?: string
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

  // Unified feed
  const [feedItems, setFeedItems] = useState<any[]>([])
  const [milestones, setMilestones] = useState<any[]>([])
  const [expandedPosts, setExpandedPosts] = useState<Set<string>>(new Set())
  const [activeCommunityId, setActiveCommunityId] = useState<string>('')

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

  const handleCommunityChange = (communityId: string) => {
    setActiveCommunityId(communityId)
    // Refresh milestones for the new community
    if (communityId) {
      fetchMilestonesForCommunity(communityId)
    }
  }

  const fetchMilestonesForCommunity = async (communityId: string) => {
    try {
      const milestonesRes = await feedApi.get(`/feed/milestones?community_id=${communityId}&limit=5`)
      setMilestones(milestonesRes.data || [])
    } catch (err) {
      console.error('Failed to fetch milestones:', err)
      setMilestones([])
    }
  }

  const fetchDashboardData = async (userId: string) => {
    try {
      setLoading(true)

      // Fetch all data in parallel
      const [myRequestsRes, allMatchesRes, suggestedRes, matchedRequestsRes, communitiesRes] = await Promise.all([
        requestService.getRequests({ requester_id: userId, limit: 50 }), // Get MY requests (all statuses)
        requestService.getMatches({ limit: 100 }),
        requestService.getRequests({ status: 'open', limit: 50 }), // Get community requests (open only)
        requestService.getRequests({ status: 'matched', limit: 50 }), // Get matched requests (for offers I'm helping with)
        communityService.getCommunities(),
      ])

      // Fetch milestones for first community
      try {
        const communities = communitiesRes.data.communities || []
        if (communities.length > 0) {
          // Set the first community as active if not already set
          if (!activeCommunityId) {
            setActiveCommunityId(communities[0].id)
          }
          const communityToUse = activeCommunityId || communities[0].id
          const milestonesRes = await feedApi.get(`/feed/milestones?community_id=${communityToUse}&limit=5`)
          setMilestones(milestonesRes.data || [])
        }
      } catch (err) {
        console.error('Failed to fetch milestones:', err)
        setMilestones([])
      }

      const allRequests = myRequestsRes.data.requests || []
      const allMatches = allMatchesRes.data.matches || []
      const suggestedRequests = suggestedRes.data.requests || []
      const matchedRequests = matchedRequestsRes.data.requests || []

      // Combine all requests (my requests + open requests + matched requests) for lookup
      const allRequestsCombined = [...allRequests, ...suggestedRequests, ...matchedRequests]

      // Build unified feed with post-and-comment structure
      // Priority order: matched requests → accepted offers → community requests → global posts
      const feed: any[] = []

      // No more deduplication needed! Backend now creates ONE request per logical post
      // (linked to multiple communities via junction table)

      // PRIORITY 1: My Requests with Matched/Accepted Offers (Amber - Highest Priority)
      const myRequestsMatched = allRequests.filter(
        (r: HelpRequest) =>
          r.requester_id === userId &&
          allMatches.some((m: Match) => m.request_id === r.id && m.status === 'matched')
      )

      myRequestsMatched.forEach((request: HelpRequest) => {
        const matches = allMatches.filter((m: Match) => m.request_id === request.id)
        feed.push({
          type: 'post',
          priority: 1,
          post: request,
          comments: matches, // All offers/matches are "comments"
          isMyPost: true,
          hasAcceptedOffer: matches.some((m: Match) => m.status === 'matched'),
          timestamp: request.created_at,
        })
      })

      // PRIORITY 2: My Accepted Offers (Blue - I'm helping, they accepted)
      const myAcceptedOffers = allMatches.filter(
        (m: Match) => m.responder_id === userId && m.status === 'matched'
      )

      // Get the unique requests for these offers
      const acceptedOfferRequestIds = new Set(myAcceptedOffers.map((m: Match) => m.request_id))
      const acceptedOfferRequests = allRequestsCombined.filter((r: HelpRequest) => acceptedOfferRequestIds.has(r.id))

      acceptedOfferRequests.forEach((request: HelpRequest) => {
        const myMatch = allMatches.find(
          (m: Match) => m.request_id === request.id && m.responder_id === userId && m.status === 'matched'
        )
        if (myMatch) {
          feed.push({
            type: 'post',
            priority: 2,
            post: request,
            comments: [myMatch], // Only show my thread with the poster
            isMyPost: false,
            isMyOffer: true,
            myMatch,
            timestamp: myMatch.created_at, // Sort by when I offered
          })
        }
      })

      // PRIORITY 3: My Requests with Pending Offers (Amber)
      const myRequestsPending = allRequests.filter(
        (r: HelpRequest) =>
          r.requester_id === userId &&
          r.status === 'open' &&
          !allMatches.some((m: Match) => m.request_id === r.id && m.status === 'matched')
      )

      myRequestsPending.forEach((request: HelpRequest) => {
        const matches = allMatches.filter((m: Match) => m.request_id === request.id)
        feed.push({
          type: 'post',
          priority: 3,
          post: request,
          comments: matches,
          isMyPost: true,
          hasAcceptedOffer: false,
          timestamp: request.created_at,
        })
      })

      // PRIORITY 4: My Pending Offers (Blue - waiting for response)
      const myPendingOffers = allMatches.filter(
        (m: Match) => m.responder_id === userId && m.status === 'proposed'
      )

      const pendingOfferRequestIds = new Set(myPendingOffers.map((m: Match) => m.request_id))
      const pendingOfferRequests = allRequestsCombined.filter((r: HelpRequest) => pendingOfferRequestIds.has(r.id))

      pendingOfferRequests.forEach((request: HelpRequest) => {
        const myMatch = allMatches.find(
          (m: Match) => m.request_id === request.id && m.responder_id === userId && m.status === 'proposed'
        )
        if (myMatch) {
          feed.push({
            type: 'post',
            priority: 4,
            post: request,
            comments: [myMatch], // Only my thread
            isMyPost: false,
            isMyOffer: true,
            myMatch,
            timestamp: myMatch.created_at,
          })
        }
      })

      // PRIORITY 5: Community Requests (White - from my communities, not responded)
      const respondedRequestIds = new Set(
        allMatches.filter((m: Match) => m.responder_id === userId).map((m: Match) => m.request_id)
      )

      const communityReqs = suggestedRequests.filter(
        (r: HelpRequest) => r.requester_id !== userId && !respondedRequestIds.has(r.id)
      )

      communityReqs.forEach((request: HelpRequest) => {
        feed.push({
          type: 'post',
          priority: 5,
          post: request,
          comments: [], // No comments visible (not my post, haven't offered)
          isMyPost: false,
          isMyOffer: false,
          timestamp: request.created_at,
        })
      })

      // Sort by priority first, then by timestamp within each priority
      feed.sort((a, b) => {
        if (a.priority !== b.priority) {
          return a.priority - b.priority // Lower priority number = higher importance
        }
        return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      })

      setFeedItems(feed)
      setUserCommunities(communitiesRes.data.communities || [])
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

      // Refresh data to show as "YOUR OFFER" - no popup needed
      await fetchDashboardData(user.id)
    } catch (error: any) {
      console.error('Error offering to help:', error)
      // Only show alert on error
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

  const handleCompleteMatch = async (matchId: string) => {
    if (!user) return

    try {
      await requestService.completeMatch(matchId, user.id)
      // Refresh data to show completed status
      await fetchDashboardData(user.id)
    } catch (error: any) {
      console.error('Error completing match:', error)
      alert(error.response?.data?.message || 'Failed to mark complete')
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
          {/* 3-Column Layout */}
          <div className="container mx-auto px-4 py-4 max-w-7xl">
            <div className="grid grid-cols-12 gap-4">
              {/* Left Sidebar - 25% */}
              <div className="col-span-12 lg:col-span-3 hidden lg:block">
                <div className="sticky top-4">
                  <LeftSidebar
                    user={user}
                    communities={userCommunities}
                    activeCommunityId={activeCommunityId || userCommunities[0]?.id}
                    onCommunityChange={handleCommunityChange}
                  />
                </div>
              </div>

              {/* Center Feed - 50% */}
              <div className="col-span-12 lg:col-span-6">
                {/* Quick Create - Compact */}
                <div className="bg-white rounded-xl shadow-sm p-4 mb-4 border border-gray-200">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-semibold flex-shrink-0">
                  {user.name?.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1">
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="What do you need help with?"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none text-sm"
                    rows={2}
                  />
                  <div className="flex items-center justify-between mt-2">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setPostingMode('all')}
                        className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                          postingMode === 'all'
                            ? 'bg-blue-100 text-blue-700'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                      >
                        All Communities
                      </button>
                      <button
                        onClick={() => setPostingMode('specific')}
                        className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                          postingMode === 'specific'
                            ? 'bg-blue-100 text-blue-700'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                      >
                        Specific
                      </button>
                    </div>
                    <button
                      onClick={handleCreateRequest}
                      disabled={!description.trim() || creating}
                      className="px-4 py-1.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      {creating ? 'Posting...' : 'Post'}
                    </button>
                  </div>
                  {postingMode === 'specific' && (
                    <div className="mt-2">
                      <select
                        value={selectedCommunity}
                        onChange={(e) => setSelectedCommunity(e.target.value)}
                        className="w-full px-3 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
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

                {/* Feed Header */}
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-lg font-bold text-gray-900">Your Feed</h2>
                  <button className="text-xs text-gray-500 hover:text-gray-700">
                    Filter
                  </button>
                </div>

                {/* Milestone Posts - Compact */}
                {milestones.length > 0 && (
                  <div className="space-y-3 mb-4">
                    {milestones.map((milestone: any) => (
                      <MilestonePost
                        key={milestone.id}
                        {...milestone}
                      />
                    ))}
                  </div>
                )}

                {feedItems.length === 0 ? (
                  <div className="bg-white rounded-xl p-8 text-center border border-gray-200">
                    <div className="text-4xl mb-3">🤝</div>
                    <h3 className="text-lg font-semibold text-gray-700 mb-2">No activity yet</h3>
                    <p className="text-sm text-gray-500">
                      Create a request above or check back later
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                  {feedItems.map((item, index) => {
                    const { post, comments, isMyPost, isMyOffer, hasAcceptedOffer, myMatch, priority } = item

                    // Determine post styling based on type
                    let bgColor = 'bg-white'
                    let borderColor = 'border-gray-200'
                    let badgeColor = 'bg-gray-100 text-gray-700'
                    let badgeText = ''

                    if (isMyPost && hasAcceptedOffer) {
                      bgColor = 'bg-amber-50'
                      borderColor = 'border-l-4 border-amber-400'
                      badgeColor = 'bg-amber-100 text-amber-700'
                      badgeText = '✓ YOUR REQUEST - MATCHED'
                    } else if (isMyPost) {
                      bgColor = 'bg-amber-50'
                      borderColor = 'border-l-4 border-amber-400'
                      badgeColor = 'bg-amber-100 text-amber-700'
                      badgeText = 'YOUR REQUEST'
                    } else if (isMyOffer && myMatch?.status === 'matched') {
                      bgColor = 'bg-blue-50'
                      borderColor = 'border-l-4 border-blue-400'
                      badgeColor = 'bg-blue-100 text-blue-700'
                      badgeText = '✓ YOU\'RE HELPING'
                    } else if (isMyOffer && myMatch?.status === 'proposed') {
                      bgColor = 'bg-blue-50'
                      borderColor = 'border-l-4 border-blue-400'
                      badgeColor = 'bg-blue-100 text-blue-700'
                      badgeText = 'YOUR OFFER'
                    }

                    return (
                      <div
                        key={`post-${post.id}-${index}`}
                        className={`${bgColor} ${borderColor} rounded-lg shadow-sm overflow-hidden hover:shadow-md transition-shadow`}
                      >
                        <div className="p-4">
                          {/* Post Header */}
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex items-center gap-2 flex-1">
                              <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white text-xs font-semibold flex-shrink-0">
                                {post.requester_name?.charAt(0).toUpperCase() || '?'}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="font-medium text-sm text-gray-900 truncate">{post.requester_name || 'Unknown'}</p>
                                <p className="text-xs text-gray-500">{formatTime(post.created_at)}</p>
                              </div>
                            </div>
                            {badgeText && (
                              <span className={`text-xs font-medium px-2 py-0.5 rounded ${badgeColor} whitespace-nowrap`}>{badgeText}</span>
                            )}
                          </div>

                          {/* Post Content */}
                          <p className="text-gray-900 text-sm leading-relaxed mb-2">{post.description}</p>

                          {/* Post Meta */}
                          <div className="flex items-center gap-3 text-xs text-gray-600 mb-2">
                            <span className="flex items-center gap-1">
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                                />
                              </svg>
                              {post.community_name}
                            </span>
                            {comments.length > 0 && isMyPost && (
                              <span className="text-gray-700 font-medium">
                                💬 {comments.length} {comments.length === 1 ? 'offer' : 'offers'}
                              </span>
                            )}
                          </div>

                          {/* Action Button - Only for community requests */}
                          {!isMyPost && !isMyOffer && (
                            <button
                              onClick={() => handleOfferToHelp(post.id)}
                              className="w-full px-3 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
                            >
                              💬 Offer to Help
                            </button>
                          )}

                          {/* Comments Section - Offers/Responses */}
                          {comments.length > 0 && (() => {
                            // Sort comments: accepted first, then by created_at
                            const sortedComments = [...comments].sort((a, b) => {
                              // Accepted (matched) come first
                              if (a.status === 'matched' && b.status !== 'matched') return -1
                              if (a.status !== 'matched' && b.status === 'matched') return 1
                              // Otherwise sort by creation time (newest first)
                              return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
                            })

                            // Show top 3 comments by default, or all if expanded
                            const isExpanded = expandedPosts.has(post.id)
                            const visibleComments = isExpanded ? sortedComments : sortedComments.slice(0, 3)
                            const hasMore = sortedComments.length > 3

                            return (
                            <div className="mt-4 pt-4 border-t border-gray-200">
                              <h3 className="text-sm font-semibold text-gray-900 mb-3">
                                {isMyPost ? `Responses (${comments.length})` : 'Your Conversation'}
                              </h3>
                              <div className="space-y-3">
                                {visibleComments.map((comment: Match) => (
                                  <div key={comment.id} className="bg-white rounded-lg p-4 border border-gray-200">
                                    <div className="flex items-start justify-between mb-3">
                                      <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 bg-gradient-to-br from-green-500 to-teal-600 rounded-full flex items-center justify-center text-white text-sm font-semibold">
                                          {comment.responder_name?.charAt(0).toUpperCase() || '?'}
                                        </div>
                                        <div>
                                          <p className="font-medium text-gray-900">{comment.responder_name || 'Unknown'}</p>
                                          <p className="text-xs text-gray-500">offered {formatTime(comment.created_at)}</p>
                                        </div>
                                      </div>
                                      {/* Action buttons for poster */}
                                      {isMyPost && comment.status === 'proposed' && (
                                        <div className="flex gap-2">
                                          <button
                                            onClick={() => handleAcceptMatch(comment.id)}
                                            className="px-3 py-1 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 transition-colors font-medium"
                                          >
                                            Accept
                                          </button>
                                          <button
                                            onClick={() => handleRejectMatch(comment.id)}
                                            className="px-3 py-1 bg-gray-200 text-gray-700 text-sm rounded-lg hover:bg-gray-300 transition-colors font-medium"
                                          >
                                            Decline
                                          </button>
                                        </div>
                                      )}
                                      {/* Status badges */}
                                      {comment.status === 'matched' && (
                                        <div className="flex items-center gap-2">
                                          <span className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded-lg font-medium">
                                            ✓ Accepted
                                          </span>
                                          <button
                                            onClick={() => handleCompleteMatch(comment.id)}
                                            className="px-3 py-1 bg-blue-600 text-white text-xs rounded-lg hover:bg-blue-700 transition-colors font-medium"
                                          >
                                            Mark Complete
                                          </button>
                                        </div>
                                      )}
                                      {comment.status === 'completed' && (
                                        <span className="px-2 py-1 bg-purple-100 text-purple-700 text-xs rounded-lg font-medium">
                                          ✓ Completed
                                        </span>
                                      )}
                                    </div>

                                    {/* Inline Chat */}
                                    {(comment.status === 'proposed' || comment.status === 'matched') && (
                                      <InlineChat
                                        matchId={comment.id}
                                        currentUserId={user.id}
                                        isRequester={isMyPost}
                                        matchStatus={comment.status}
                                        otherParticipantName={comment.responder_name || 'Unknown'}
                                      />
                                    )}
                                  </div>
                                ))}

                                {/* Show More/Less Button */}
                                {hasMore && (
                                  <button
                                    onClick={() => {
                                      const newExpanded = new Set(expandedPosts)
                                      if (isExpanded) {
                                        newExpanded.delete(post.id)
                                      } else {
                                        newExpanded.add(post.id)
                                      }
                                      setExpandedPosts(newExpanded)
                                    }}
                                    className="w-full py-2 text-sm text-blue-600 hover:text-blue-700 font-medium transition-colors"
                                  >
                                    {isExpanded
                                      ? `Show Less ↑`
                                      : `Show ${sortedComments.length - 3} More Responses ↓`
                                    }
                                  </button>
                                )}
                              </div>
                            </div>
                            )
                          })()}
                        </div>
                      </div>
                    )
                  })}
                  </div>
                )}
              </div>

              {/* Right Sidebar - 25% */}
              <div className="col-span-12 lg:col-span-3 hidden lg:block">
                <div className="sticky top-4">
                  <RightSidebar communityId={activeCommunityId || userCommunities[0]?.id} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </Layout>
    </>
  )
}
