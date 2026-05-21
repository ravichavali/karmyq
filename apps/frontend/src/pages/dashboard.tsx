import { useEffect, useLayoutEffect, useState } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import Link from 'next/link'
import { requestService, communityService } from '@/lib/api'
import { feedApi } from '@/lib/api'
import Layout from '@/components/Layout'
import WelcomeModal from '@/components/WelcomeModal'
import TabBar, { TabId } from '@/components/TabBar'
import BrowseFeed from '@/components/BrowseFeed'
import CommitmentsTab from '@/components/CommitmentsTab'
import MyRequestsTab from '@/components/MyRequestsTab'
import type { BrowseMode } from '@/components/BrowseModeControl'
import SpeedDialFab from '@/components/SpeedDialFab'
import RequestWizard from '@/components/RequestWizard'
import { useProvider } from '@/contexts/ProviderContext'
// Onboarding: see src/lib/onboarding/workflows.ts → 'feed'
import { useOnboarding } from '@/hooks/useOnboarding'
import OnboardingOverlay from '@/components/OnboardingOverlay'
import { WORKFLOWS } from '@/lib/onboarding/workflows'


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
  requester_id?: string
  status: string
  created_at: string
  responder_name?: string
  requester_name?: string
  request_description?: string
  request_type?: string
  payload?: Record<string, any>
  scheduled_at?: string
  request_title?: string
  requester_done_at?: string | null
  responder_done_at?: string | null
}

interface Community {
  id: string
  name: string
  community_type?: 'mutual_aid' | 'group'
}


export default function Dashboard() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  const [userCommunities, setUserCommunities] = useState<Community[]>([])

  // Unified feed
  const [feedItems, setFeedItems] = useState<any[]>([])
  const [upcomingMatches, setUpcomingMatches] = useState<Match[]>([])
  const [milestones, setMilestones] = useState<any[]>([])
  const [expandedPosts, setExpandedPosts] = useState<Set<string>>(new Set())
  const [activeCommunityId, setActiveCommunityId] = useState<string>('')

  const [karmaRefreshKey, setKarmaRefreshKey] = useState(0)

  // Filter state
  const [showFilter, setShowFilter] = useState(false)
  const [filterTrustDistance, setFilterTrustDistance] = useState<string>('')
  const [filterRequestType, setFilterRequestType] = useState<string>('')

  // Tab shell state
  const [activeTab, setActiveTab] = useState<TabId>('browse')
  const [showWizard, setShowWizard] = useState(false)
  const [pendingDibsCount, setPendingDibsCount] = useState(0)

  const [browseMode, setBrowseMode] = useState<BrowseMode>(() => {
    if (typeof window === 'undefined') return 'provider'
    return (localStorage.getItem('karmyq_browse_mode') as BrowseMode) ?? 'provider'
  })
  const handleBrowseModeChange = (mode: BrowseMode) => {
    setBrowseMode(mode)
    localStorage.setItem('karmyq_browse_mode', mode)
  }

  const { hasProviderProfile, isAvailable, providerProfiles, providerServiceTypes } = useProvider()
  const { shouldShow: showFeedOnboarding, markSeen: markFeedSeen } = useOnboarding('feed')

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
      const parsedUser = JSON.parse(userData)
      setUser(parsedUser)
      fetchDashboardData(parsedUser.id)
    }

    setLoading(false)
  }, [router])

  // Honor ?tab= query param once router is ready (e.g. notification links → helping tab)
  useEffect(() => {
    if (!router.isReady) return
    const tabParam = router.query.tab as string | undefined
    if (tabParam === 'helping' || tabParam === 'asks') {
      setActiveTab(tabParam)
    }
  }, [router.isReady, router.query.tab])

  // Scroll to top on tab switch before the browser paints the new content
  useLayoutEffect(() => {
    window.scrollTo(0, 0)
  }, [activeTab])

  // Re-fetch when filters or active community change (skip on initial mount — handled above)
  const filtersInitialized = typeof window !== 'undefined'
  useEffect(() => {
    if (!filtersInitialized || !user) return
    fetchDashboardData(user.id, { trust_distance: filterTrustDistance, request_type: filterRequestType })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterTrustDistance, filterRequestType, activeCommunityId])

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
      console.error('Failed to fetch milestones', { error: err instanceof Error ? err.message : String(err) })
      setMilestones([])
    }
  }

  const fetchDashboardData = async (userId: string, filters?: { trust_distance?: string; request_type?: string }) => {
    try {
      setLoading(true)

      // Always use the curated endpoint (trust-scored, preference-aware).
      // community_id is optional — omitting it returns a composite feed across all user communities.
      const currentCommunityId = activeCommunityId || undefined
      const suggestedFetch = requestService.getCuratedRequests({
        community_id: currentCommunityId,
        trust_distance: filters?.trust_distance || undefined,
        request_type: filters?.request_type || undefined,
        limit: 50,
      })

      // Fetch all data in parallel
      const [myRequestsRes, allMatchesRes, suggestedRes, matchedRequestsRes, communitiesRes] = await Promise.all([
        requestService.getRequests({ requester_id: userId, limit: 50 }), // Get MY requests (all statuses)
        requestService.getMatches({ user_id: userId, limit: 200 }),
        suggestedFetch, // Community requests — curated when community selected, raw when viewing all
        requestService.getRequests({ status: 'matched', limit: 50 }), // Get matched requests (for offers I'm helping with)
        communityService.getMyCommunities(userId),
      ])

      // Fetch milestones for first community
      try {
        const communities = communitiesRes.data.communities || []
        if (communities.length > 0) {
          // TODO: Re-enable when milestone_events table is created (See ROADMAP.md Backlog #24)
          // const communityToUse = activeCommunityId || communities[0].id
          // const milestonesRes = await feedApi.get(`/feed/milestones?community_id=${communityToUse}&limit=5`)
          // setMilestones(milestonesRes.data || [])
          setMilestones([]) // Temporarily disabled
        }
      } catch (err) {
        console.error('Failed to fetch milestones', { error: err instanceof Error ? err.message : String(err) })
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

      // UPCOMING COMMITMENTS: Accepted matches (moved out of main feed)
      // Exclude matches where the current user has already marked done — they're waiting
      // for the other party, so there's nothing left for this user to act on.
      const userAlreadyDone = (m: Match) => {
        const isRequester = allRequests.some((r: HelpRequest) => r.id === m.request_id && r.requester_id === userId)
        return isRequester ? !!m.requester_done_at : !!m.responder_done_at
      }
      // Requester side: my requests that have been matched
      const upcomingAsRequester = allMatches.filter(
        (m: Match) => m.status === 'matched' &&
          allRequests.some((r: HelpRequest) => r.id === m.request_id && r.requester_id === userId) &&
          !userAlreadyDone(m)
      )
      // Helper side: offers I made that were accepted
      const upcomingAsHelper = allMatches.filter(
        (m: Match) => m.responder_id === userId && m.status === 'matched' && !userAlreadyDone(m)
      )
      // Deduplicate (same match can't appear in both) and augment with requester_id for feedback
      const upcomingMatchIds = new Set<string>()
      const upcoming: Match[] = []
      for (const m of [...upcomingAsRequester, ...upcomingAsHelper]) {
        if (!upcomingMatchIds.has(m.id)) {
          upcomingMatchIds.add(m.id)
          const req = allRequests.find((r: HelpRequest) => r.id === m.request_id)
          upcoming.push({ ...m, requester_id: req?.requester_id })
        }
      }
      setUpcomingMatches(upcoming)

      // Accepted request IDs to exclude from feed
      const acceptedMatchRequestIds = new Set(upcoming.map((m: Match) => m.request_id))

      // PRIORITY 3: My Requests with Pending Offers (Amber)
      // Only show own requests that have engagement — if nobody has responded yet, there's nothing to act on
      const myRequestsPending = allRequests.filter((r: HelpRequest) => {
        if (r.requester_id !== userId || r.status !== 'open') return false
        if (allMatches.some((m: Match) => m.request_id === r.id && m.status === 'matched')) return false
        const pendingOffers = allMatches.filter(
          (m: Match) => m.request_id === r.id && m.status !== 'rejected' && m.status !== 'cancelled' && m.responder_id !== r.requester_id
        )
        return pendingOffers.length > 0
      })

      myRequestsPending.forEach((request: HelpRequest) => {
        const matches = allMatches.filter((m: Match) =>
          m.request_id === request.id &&
          m.status !== 'rejected' &&
          m.status !== 'cancelled' &&
          m.responder_id !== request.requester_id // exclude self-matches
        )
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
      const pendingOfferRequests = allRequestsCombined.filter(
        (r: HelpRequest) => pendingOfferRequestIds.has(r.id) && !acceptedMatchRequestIds.has(r.id)
      )

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

      const communityReqs = suggestedRequests.filter((r: HelpRequest) => {
        if (r.requester_id === userId) return false
        if (respondedRequestIds.has(r.id)) return false
        // Client-side guard: curated endpoint already scopes by community, but
        // the raw fallback (all communities view) doesn't — no filter needed there.
        return true
      })

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
      console.error('Failed to load dashboard data', { error: err instanceof Error ? err.message : String(err) })
    } finally {
      setLoading(false)
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
      console.error('Error offering to help', { error: error instanceof Error ? error.message : String(error) })
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
      console.error('Error accepting match', { error: error instanceof Error ? error.message : String(error) })
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
      console.error('Error rejecting match', { error: error instanceof Error ? error.message : String(error) })
      alert(error.response?.data?.message || 'Failed to reject offer')
    }
  }

  const handleCompleteMatch = async (matchId: string) => {
    if (!user) return

    try {
      await requestService.completeMatch(matchId, user.id)
      // Refresh data to show completed status
      await fetchDashboardData(user.id)
      setKarmaRefreshKey((k) => k + 1)
    } catch (error: any) {
      console.error('Error completing match', { error: error instanceof Error ? error.message : String(error) })
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
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="text-text-muted mt-4">Loading your dashboard...</p>
        </div>
      </div>
    )
  }

  return (
    <>
      {showFeedOnboarding && (
        <OnboardingOverlay workflow={WORKFLOWS.feed} onDismiss={markFeedSeen} />
      )}
      <Head>
        <title>Dashboard - Karmyq</title>
      </Head>
      <Layout>
        <WelcomeModal user={user} />

        {/* Community selector row */}
        <div className="bg-surface-raised border-b border-border px-4 py-2 flex items-center gap-3">
          <label className="text-sm font-medium text-text-muted shrink-0">Community:</label>
          <select
            value={activeCommunityId}
            onChange={(e) => handleCommunityChange(e.target.value)}
            className="text-sm border border-border rounded-lg px-2 py-1.5 bg-surface text-text focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="">All communities</option>
            {userCommunities.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>

        {/* Zero-community state — shown when user hasn't joined any community yet */}
        {!loading && userCommunities.length === 0 ? (
          <div className="max-w-md mx-auto px-4 py-16 text-center">
            <div className="text-5xl mb-4">🏘️</div>
            <h2 className="text-xl font-semibold text-text mb-2">You haven't joined a community yet</h2>
            <p className="text-text-muted text-sm mb-8">
              Communities are where requests, activities, and mutual aid happen.
              Join one near you to see your feed.
            </p>
            <Link
              href="/communities"
              className="px-6 py-3 bg-primary text-white rounded-lg font-medium hover:bg-primary-dark transition-colors inline-flex"
            >
              Find Communities
            </Link>
          </div>
        ) : (
          <>
            {/* Desktop tab bar */}
            <TabBar
              activeTab={activeTab}
              onChange={(tab) => { window.scrollTo(0, 0); setActiveTab(tab) }}
              browseLabel={undefined}
              dibsCount={pendingDibsCount}
            />

            {/* Tab content */}
            <div className="pb-20 md:pb-0">
              {activeTab === 'browse' && (
                <div key="browse">
                  <BrowseFeed
                    communityId={activeCommunityId || undefined}
                    communityType={userCommunities.find(c => c.id === activeCommunityId)?.community_type}
                    isOnDuty={hasProviderProfile && isAvailable}
                    providerServiceTypes={providerServiceTypes ?? []}
                    noCommunities={userCommunities.length === 0}
                    browseMode={browseMode}
                    onBrowseModeChange={handleBrowseModeChange}
                  />
                </div>
              )}
              {activeTab === 'helping' && <div key="helping"><CommitmentsTab onDibsLoaded={setPendingDibsCount} isOnDuty={hasProviderProfile && isAvailable} browseMode={browseMode} onBrowseModeChange={handleBrowseModeChange} /></div>}
              {activeTab === 'asks' && <div key="asks"><MyRequestsTab onNewRequest={() => setShowWizard(true)} isOnDuty={hasProviderProfile && isAvailable} browseMode={browseMode} onBrowseModeChange={handleBrowseModeChange} /></div>}
            </div>
          </>
        )}

        <SpeedDialFab
          activeTab={activeTab}
          onGetHelp={() => setShowWizard(true)}
          onGetService={() => setShowWizard(true)}
        />
        {showWizard && (
          <RequestWizard
            onClose={() => setShowWizard(false)}
            onSuccess={() => { if (user) fetchDashboardData(user.id) }}
          />
        )}
      </Layout>
    </>
  )
}
