import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import Link from 'next/link'
import { communityService, reputationService } from '@/lib/api'
import Layout from '@/components/Layout'
import EmptyState from '@/components/EmptyState'

interface Community {
  id: string
  name: string
  description: string
  location: string
  category: string
  current_members: number
  max_members: number
  access_type: 'public' | 'private'
  creator_name: string
  created_at: string
  inner_circle_count: number
  active_community_count: number
  extended_network_count: number
}

interface MembershipStatus {
  [communityId: string]: 'active' | 'pending' | null
}

interface TrustScores {
  [communityId: string]: number | null
}

const CATEGORIES = [
  'Neighborhood',
  'Professional',
  'Hobby',
  'Faith-based',
  'Educational',
  'Health & Wellness',
  'Environmental',
  'Social Justice',
  'Arts & Culture',
  'Other'
]

export default function CommunitiesPage() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [communities, setCommunities] = useState<Community[]>([])
  const [membershipStatus, setMembershipStatus] = useState<MembershipStatus>({})
  const [trustScores, setTrustScores] = useState<TrustScores>({})
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [error, setError] = useState('')
  const [joiningId, setJoiningId] = useState<string | null>(null)

  // Filter states
  const [searchQuery, setSearchQuery] = useState('')
  const [locationFilter, setLocationFilter] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [hasSpaceFilter, setHasSpaceFilter] = useState(false)
  const [sortBy, setSortBy] = useState('newest')

  const PAGE_SIZE = 12

  useEffect(() => {
    const token = localStorage.getItem('token')
    const userData = localStorage.getItem('user')

    if (!token) {
      router.push('/login')
      return
    }

    if (userData) {
      setUser(JSON.parse(userData))
    }

    fetchCommunities()
  }, [router, searchQuery, locationFilter, categoryFilter, hasSpaceFilter, sortBy])

  const fetchCommunities = async (loadMore = false) => {
    try {
      if (loadMore) {
        setLoadingMore(true)
      } else {
        setLoading(true)
      }

      const params: any = {
        status: 'active',
        limit: PAGE_SIZE,
        offset: loadMore ? communities.length : 0,
        sort: sortBy
      }

      if (searchQuery) params.search = searchQuery
      if (locationFilter) params.location = locationFilter
      if (categoryFilter) params.category = categoryFilter
      if (hasSpaceFilter) params.has_space = 'true'

      const response = await communityService.getCommunities(params)
      const newCommunities = response.data.communities

      if (loadMore) {
        setCommunities(prev => [...prev, ...newCommunities])
      } else {
        setCommunities(newCommunities)
      }

      setHasMore(newCommunities.length === PAGE_SIZE)

      // Get user's memberships from JWT token (no API call needed)
      const userData = localStorage.getItem('user')
      if (userData) {
        const user = JSON.parse(userData)
        const allCommunities = loadMore ? [...communities, ...newCommunities] : newCommunities
        buildMembershipStatusFromToken(user, allCommunities)
      }

      // Fetch trust scores for all loaded communities in parallel
      fetchTrustScores(newCommunities.map((c: Community) => c.id))
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load communities')
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }

  const buildMembershipStatusFromToken = (user: any, communities: Community[]) => {
    // Use JWT token data - no API call needed!
    const statusMap: MembershipStatus = {}

    // Build a map of user's memberships from JWT token
    const membershipMap = new Map(
      (user.communities || []).map((c: any) => [c.id, 'active'])
    )

    // Check each community against user's memberships
    for (const community of communities) {
      statusMap[community.id] = membershipMap.has(community.id) ? 'active' : null
    }

    setMembershipStatus(statusMap)
  }

  const fetchTrustScores = async (communityIds: string[]) => {
    const results = await Promise.allSettled(
      communityIds.map(id => reputationService.getCommunityTrust(id))
    )
    const scores: TrustScores = {}
    communityIds.forEach((id, i) => {
      const result = results[i]
      scores[id] = result.status === 'fulfilled' ? (result.value.data?.data?.score ?? null) : null
    })
    setTrustScores(prev => ({ ...prev, ...scores }))
  }

  const handleJoinCommunity = async (communityId: string, accessType: 'public' | 'private') => {
    if (!user) return

    try {
      setJoiningId(communityId)
      await communityService.joinCommunity(communityId, { user_id: user.id })

      // Update membership status
      setMembershipStatus(prev => ({
        ...prev,
        [communityId]: accessType === 'public' ? 'active' : 'pending'
      }))

      // Refresh communities to update member count
      fetchCommunities()
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to join community')
    } finally {
      setJoiningId(null)
    }
  }

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value)
  }

  const handleClearFilters = () => {
    setSearchQuery('')
    setLocationFilter('')
    setCategoryFilter('')
    setHasSpaceFilter(false)
    setSortBy('newest')
  }

  return (
    <>
      <Head>
        <title>Discover Communities - Karmyq</title>
      </Head>
      <Layout title="Discover Communities">
        <div className="container mx-auto px-4 py-8">
          {/* Header */}
          <div className="mb-6 flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold mb-2">Discover Communities</h1>
              <p className="text-text-muted">
                Find and join communities based on location, interests, or mission
              </p>
            </div>
            <Link
              href="/communities/new"
              className="px-4 py-2 bg-primary text-white rounded hover:bg-primary-dark"
            >
              Create Community
            </Link>
          </div>

          {/* Configuration Resources */}
          <div className="bg-gradient-to-r from-primary-light to-accent-light border border-primary-medium rounded-lg p-4 mb-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-2xl">⚙️</span>
                <div>
                  <h3 className="font-semibold text-text">Community Configuration</h3>
                  <p className="text-sm text-text-muted">
                    Explore how different communities set up their karma and trust mechanics
                  </p>
                </div>
              </div>
              <div className="flex gap-3">
                <Link
                  href="/communities/config-templates"
                  className="px-4 py-2 bg-surface-raised border border-primary-medium text-primary-dark rounded hover:bg-primary-light text-sm font-medium transition-colors"
                >
                  📋 Browse Templates
                </Link>
                <Link
                  href="/communities/configs/public"
                  className="px-4 py-2 bg-primary text-white rounded hover:bg-primary-dark text-sm font-medium transition-colors"
                >
                  ⭐ Thriving Communities
                </Link>
              </div>
            </div>
          </div>

          {/* Search and Filters */}
          <div className="bg-surface-raised rounded-lg shadow-md p-6 mb-6">
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
              {/* Search */}
              <div>
                <label className="block text-sm font-medium text-text-muted mb-1">
                  Search
                </label>
                <input
                  type="text"
                  placeholder="Search by name or description..."
                  value={searchQuery}
                  onChange={handleSearchChange}
                  className="w-full px-3 py-2 border border-border rounded focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              {/* Location Filter */}
              <div>
                <label className="block text-sm font-medium text-text-muted mb-1">
                  Location
                </label>
                <input
                  type="text"
                  placeholder="City, region, or area..."
                  value={locationFilter}
                  onChange={(e) => setLocationFilter(e.target.value)}
                  className="w-full px-3 py-2 border border-border rounded focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              {/* Category Filter */}
              <div>
                <label className="block text-sm font-medium text-text-muted mb-1">
                  Category
                </label>
                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className="w-full px-3 py-2 border border-border rounded focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="">All Categories</option>
                  {CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              {/* Sort */}
              <div>
                <label className="block text-sm font-medium text-text-muted mb-1">
                  Sort By
                </label>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="w-full px-3 py-2 border border-border rounded focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="newest">Newest First</option>
                  <option value="members">Most Members</option>
                  <option value="alphabetical">A-Z</option>
                </select>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={hasSpaceFilter}
                  onChange={(e) => setHasSpaceFilter(e.target.checked)}
                  className="mr-2"
                />
                <span className="text-sm text-text-muted">Only show communities with available spots</span>
              </label>

              <button
                onClick={handleClearFilters}
                className="text-sm text-primary hover:text-primary-dark"
              >
                Clear All Filters
              </button>
            </div>
          </div>

          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
              {error}
            </div>
          )}

          {/* Results */}
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-text-subtle">Loading communities...</div>
            </div>
          ) : communities.length === 0 ? (
            <EmptyState
              icon="🏘️"
              heading="No communities found"
              body="Try a different search, or start your own community."
              ctaLabel="Create a Community"
              ctaHref="/communities/new"
            />
          ) : (
            <>
              <div className="mb-4 text-sm text-text-muted">
                Found {communities.length} {communities.length === 1 ? 'community' : 'communities'}
              </div>
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {communities.map((community) => {
                  const memberStatus = membershipStatus[community.id]
                  const isFull = community.current_members >= community.max_members

                  return (
                    <div
                      key={community.id}
                      className="bg-surface-raised rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow"
                    >
                      <Link href={`/communities/${community.id}`}>
                        <div className="flex justify-between items-start mb-3">
                          <h3 className="text-xl font-semibold hover:text-primary transition-colors">
                            {community.name}
                          </h3>
                          <div className="flex gap-2">
                            {community.access_type === 'private' && (
                              <span className="text-xs bg-accent-light text-accent-dark px-2 py-1 rounded">
                                Private
                              </span>
                            )}
                            {isFull && (
                              <span className="text-xs bg-red-100 text-red-800 px-2 py-1 rounded">
                                Full
                              </span>
                            )}
                          </div>
                        </div>

                        {community.category && (
                          <div className="mb-2">
                            <span className="text-xs bg-primary-light text-primary-dark px-2 py-1 rounded">
                              {community.category}
                            </span>
                          </div>
                        )}

                        <p className="text-text-muted mb-3 line-clamp-2">{community.description}</p>

                        {community.location && (
                          <p className="text-sm text-text-subtle mb-3">
                            📍 {community.location}
                          </p>
                        )}

                        <div className="flex items-center justify-between text-sm text-text-subtle mb-3">
                          <span>
                            {community.current_members} / {community.max_members} members
                          </span>
                          <span>by {community.creator_name}</span>
                        </div>

                        <div className="w-full bg-gray-200 rounded-full h-2 mb-4">
                          <div
                            className="bg-primary h-2 rounded-full"
                            style={{
                              width: `${(community.current_members / community.max_members) * 100}%`,
                            }}
                          ></div>
                        </div>

                        {/* Activity layer distribution + trust score */}
                        {community.current_members > 0 && (
                          <div className="flex flex-wrap gap-2 mb-4 text-xs items-center">
                            {community.inner_circle_count > 0 && (
                              <span className="px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 font-medium">
                                {community.inner_circle_count} core
                              </span>
                            )}
                            {community.active_community_count > 0 && (
                              <span className="px-2 py-0.5 rounded-full bg-primary-light text-primary font-medium">
                                {community.active_community_count} active
                              </span>
                            )}
                            {community.extended_network_count > 0 && (
                              <span className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">
                                {community.extended_network_count} extended
                              </span>
                            )}
                            {trustScores[community.id] != null && (
                              <span className="ml-auto px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 font-medium">
                                ★ {trustScores[community.id]}% trust
                              </span>
                            )}
                          </div>
                        )}
                      </Link>

                      {/* Join Button */}
                      <div>
                        {memberStatus === 'active' ? (
                          <button
                            disabled
                            className="w-full px-4 py-2 bg-success-light text-green-800 rounded text-sm font-medium cursor-not-allowed"
                          >
                            ✓ Joined
                          </button>
                        ) : memberStatus === 'pending' ? (
                          <button
                            disabled
                            className="w-full px-4 py-2 bg-yellow-100 text-yellow-800 rounded text-sm font-medium cursor-not-allowed"
                          >
                            ⏳ Pending Approval
                          </button>
                        ) : isFull ? (
                          <button
                            disabled
                            className="w-full px-4 py-2 bg-border-light text-text-subtle rounded text-sm font-medium cursor-not-allowed"
                          >
                            Community Full
                          </button>
                        ) : (
                          <button
                            onClick={(e) => {
                              e.preventDefault()
                              handleJoinCommunity(community.id, community.access_type)
                            }}
                            disabled={joiningId === community.id}
                            className={`w-full px-4 py-2 rounded text-sm font-medium transition-colors ${
                              joiningId === community.id
                                ? 'bg-gray-300 text-text-muted cursor-wait'
                                : community.access_type === 'private'
                                ? 'bg-accent text-white hover:bg-accent-dark'
                                : 'bg-primary text-white hover:bg-primary-dark'
                            }`}
                          >
                            {joiningId === community.id
                              ? 'Joining...'
                              : community.access_type === 'private'
                              ? 'Request to Join'
                              : 'Join Community'}
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Load More Button */}
              {hasMore && (
                <div className="mt-8 text-center">
                  <button
                    onClick={() => fetchCommunities(true)}
                    disabled={loadingMore}
                    className="px-8 py-3 bg-surface-raised border border-border text-text-muted rounded-lg hover:bg-surface font-medium transition-colors disabled:opacity-50"
                  >
                    {loadingMore ? 'Loading...' : 'Load More Communities'}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </Layout>
    </>
  )
}
