import { useEffect, useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import Link from 'next/link'
import { communityService, reputationService } from '@/lib/api'
import Layout from '@/components/Layout'
import EmptyState from '@/components/EmptyState'
import DiscoveryToggle, { type DiscoveryMode, readDiscoveryMode } from '@/components/DiscoveryToggle'
// Onboarding: see src/lib/onboarding/workflows.ts → 'communities'
import { useOnboarding } from '@/hooks/useOnboarding'
import OnboardingOverlay from '@/components/OnboardingOverlay'
import { WORKFLOWS } from '@/lib/onboarding/workflows'

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
  distance_km?: number
  tags?: string[]
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

const PAGE_SIZE = 12

function CommunityCardSkeleton() {
  return (
    <div className="bg-surface-raised rounded-xl border border-border p-6 animate-pulse">
      <div className="flex justify-between items-start mb-3">
        <div className="h-5 bg-border rounded w-1/2" />
        <div className="h-5 bg-border rounded w-16" />
      </div>
      <div className="h-3 bg-border rounded w-1/4 mb-3" />
      <div className="h-3 bg-border rounded w-full mb-2" />
      <div className="h-3 bg-border rounded w-3/4 mb-4" />
      <div className="h-2 bg-border rounded-full w-full mb-4" />
      <div className="h-8 bg-border rounded w-full" />
    </div>
  )
}

export default function CommunitiesPage() {
  const router = useRouter()

  // Derive before state declarations so useState(!isWelcomeFlow) reads the correct initial value
  const isWelcomeFlow = router.query.welcome === 'true'

  const [user, setUser] = useState<any>(null)
  const [communities, setCommunities] = useState<Community[]>([])
  const [membershipStatus, setMembershipStatus] = useState<MembershipStatus>({})
  const [trustScores, setTrustScores] = useState<TrustScores>({})
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [error, setError] = useState('')
  const [joiningId, setJoiningId] = useState<string | null>(null)

  // Discovery mode
  const [discoveryMode, setDiscoveryMode] = useState<DiscoveryMode>('geography')
  const [locationDenied, setLocationDenied] = useState(false)
  const [geoFallback, setGeoFallback] = useState(false)

  // Tags (interests mode)
  const [availableTags, setAvailableTags] = useState<string[]>([])
  const [selectedTags, setSelectedTags] = useState<string[]>([])

  // Filter states
  const [searchQuery, setSearchQuery] = useState('')
  const [locationFilter, setLocationFilter] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [hasSpaceFilter, setHasSpaceFilter] = useState(false)
  const [sortBy, setSortBy] = useState('activity')
  const [showFilters, setShowFilters] = useState(!isWelcomeFlow)
  const [initialized, setInitialized] = useState(false)

  // Refs for stable fetchCommunities callback
  const communitiesRef = useRef<Community[]>([])
  const coordsRef = useRef<{ lat: number; lng: number } | null>(null)

  const buildMembershipStatusFromToken = useCallback((userData: any, communityList: Community[]) => {
    const statusMap: MembershipStatus = {}
    const membershipMap = new Map(
      (userData.communities || []).map((c: any) => [c.id, 'active'])
    )
    for (const community of communityList) {
      statusMap[community.id] = membershipMap.has(community.id) ? 'active' : null
    }
    setMembershipStatus(statusMap)
  }, [])

  const fetchTrustScores = useCallback(async (communityIds: string[]) => {
    const results = await Promise.allSettled(
      communityIds.map(id => reputationService.getCommunityTrust(id))
    )
    const scores: TrustScores = {}
    communityIds.forEach((id, i) => {
      const result = results[i]
      scores[id] = result.status === 'fulfilled' ? (result.value.data?.data?.score ?? null) : null
    })
    setTrustScores(prev => ({ ...prev, ...scores }))
  }, [])

  const fetchCommunities = useCallback(async (opts: {
    loadMore?: boolean
    mode?: DiscoveryMode
    lat?: number
    lng?: number
    tags?: string[]
    currentList?: Community[]
  } = {}) => {
    const {
      loadMore = false,
      mode = discoveryMode,
      lat,
      lng,
      tags = selectedTags,
      currentList = communitiesRef.current,
    } = opts

    try {
      if (loadMore) {
        setLoadingMore(true)
      } else {
        setLoading(true)
      }

      const params: Record<string, any> = {
        status: 'active',
        limit: PAGE_SIZE,
        offset: loadMore ? currentList.length : 0,
        sort: sortBy,
      }

      if (mode === 'geography' && lat != null && lng != null) {
        params.mode = 'geography'
        params.lat = lat
        params.lng = lng
      } else if (mode === 'interests' && tags.length > 0) {
        params.mode = 'interests'
        params.tags = tags.join(',')
      }

      if (searchQuery) params.search = searchQuery
      if (locationFilter) params.location = locationFilter
      if (categoryFilter) params.category = categoryFilter
      if (hasSpaceFilter) params.has_space = 'true'

      const response = await communityService.getCommunities(params)
      const newCommunities: Community[] = response.data.communities
      setGeoFallback(response.data.fallback === true)

      if (loadMore) {
        setCommunities(prev => {
          const merged = [...prev, ...newCommunities]
          communitiesRef.current = merged
          const userData = localStorage.getItem('user')
          if (userData) buildMembershipStatusFromToken(JSON.parse(userData), merged)
          return merged
        })
      } else {
        communitiesRef.current = newCommunities
        setCommunities(newCommunities)
        const userData = localStorage.getItem('user')
        if (userData) buildMembershipStatusFromToken(JSON.parse(userData), newCommunities)
      }

      setHasMore(newCommunities.length === PAGE_SIZE)
      fetchTrustScores(newCommunities.map((c: Community) => c.id))
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load communities')
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }, [
    discoveryMode,
    selectedTags,
    sortBy,
    searchQuery,
    locationFilter,
    categoryFilter,
    hasSpaceFilter,
    buildMembershipStatusFromToken,
    fetchTrustScores,
  ])

  // Initial mount: auth check + read persisted mode + fetch tags
  useEffect(() => {
    const token = localStorage.getItem('token')
    const userData = localStorage.getItem('user')

    if (!token) {
      router.push('/login')
      return
    }

    if (userData) {
      try {
        const stored = JSON.parse(userData)
        // Heal user.communities from JWT — the token always has complete {id, name, role}.
        // Guards against a prior optimistic update that wrote {id, role} without name.
        const payload = token
          ? JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')))
          : null
        if (payload?.communities?.length) {
          const healed = { ...stored, communities: payload.communities }
          localStorage.setItem('user', JSON.stringify(healed))
          setUser(healed)
        } else {
          setUser(stored)
        }
      } catch {
        setUser(JSON.parse(userData))
      }
    }

    const persistedMode = readDiscoveryMode()
    setDiscoveryMode(persistedMode)

    // Fetch available tags for interests mode
    communityService.getCommunityTags().then((res) => {
      const tags: string[] = res.data?.tags ?? res.data ?? []
      setAvailableTags(tags)
    }).catch(() => {
      // tags are non-critical; silently ignore
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Re-fetch when filters or sort change (not on first render — handled by mode effect below)
  useEffect(() => {
    if (!initialized) return
    fetchCommunities({ mode: discoveryMode })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery, locationFilter, categoryFilter, hasSpaceFilter, sortBy])

  // React to discovery mode change (including on first init)
  useEffect(() => {
    if (discoveryMode === 'geography') {
      setLocationDenied(false)
      // Show skeleton immediately, then request geolocation
      setLoading(true)
      if (typeof window !== 'undefined' && navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            coordsRef.current = { lat: pos.coords.latitude, lng: pos.coords.longitude }
            setInitialized(true)
            fetchCommunities({
              mode: 'geography',
              lat: pos.coords.latitude,
              lng: pos.coords.longitude,
            })
          },
          () => {
            // Denied or unavailable — fall back to alphabetical
            setLocationDenied(true)
            setInitialized(true)
            fetchCommunities({ mode: 'geography' })
          },
          { timeout: 8000 }
        )
      } else {
        setInitialized(true)
        fetchCommunities({ mode: 'geography' })
      }
    } else {
      // interests mode
      setInitialized(true)
      fetchCommunities({ mode: 'interests', tags: selectedTags })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [discoveryMode])

  // Re-fetch when selected tags change (interests mode only)
  useEffect(() => {
    if (!initialized || discoveryMode !== 'interests') return
    fetchCommunities({ mode: 'interests', tags: selectedTags })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTags])

  const { shouldShow: showCommunitiesOnboarding, markSeen: markCommunitiesSeen } = useOnboarding('communities')

  const handleDiscoveryModeChange = (newMode: DiscoveryMode) => {
    setSelectedTags([])
    setDiscoveryMode(newMode)
  }

  const toggleTag = (tag: string) => {
    setSelectedTags(prev =>
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    )
  }

  const handleJoinCommunity = async (communityId: string, accessType: 'public' | 'private') => {
    if (!user) return

    const isFirstJoin = (user.communities ?? []).length === 0

    try {
      setJoiningId(communityId)
      const joinRes = await communityService.joinCommunity(communityId, { user_id: user.id })

      // Persist refreshed JWT so buildMembershipStatusFromToken uses up-to-date community list
      const newToken = joinRes?.data?.token
      if (newToken && accessType === 'public') {
        localStorage.setItem('token', newToken)
        try {
          // Decode the new JWT to get the complete community list (id + name + role)
          const payload = JSON.parse(atob(newToken.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')))
          if (payload?.communities) {
            const updatedUser = { ...user, communities: payload.communities }
            localStorage.setItem('user', JSON.stringify(updatedUser))
            setUser(updatedUser)
          }
        } catch {
          // Non-fatal: token decode failed, communities list stays stale until next login
        }
      }

      setMembershipStatus(prev => ({
        ...prev,
        [communityId]: accessType === 'public' ? 'active' : 'pending'
      }))

      if (isFirstJoin && accessType === 'public') {
        // Suppress WelcomeModal (they got their welcome experience here)
        localStorage.setItem('karmyq_onboarded', '1')
        router.push('/dashboard')
        return
      }

      fetchCommunities({ mode: discoveryMode })
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
    setSortBy('activity')
    setSelectedTags([])
  }

  return (
    <>
      {showCommunitiesOnboarding && (
        <OnboardingOverlay workflow={WORKFLOWS.communities} onDismiss={markCommunitiesSeen} />
      )}
      <Head>
        <title>Discover Communities - Karmyq</title>
      </Head>
      <Layout>
        <div className="container mx-auto px-4 py-8">
          {/* Header */}
          <div className="mb-6 flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-text mb-2">Discover Communities</h1>
              <p className="text-text-muted">
                Find and join communities based on location, interests, or mission
              </p>
            </div>
            <Link
              href="/communities/new"
              className="px-4 py-2 bg-primary text-white rounded hover:bg-primary-dark text-sm font-medium transition-colors"
            >
              Create Community
            </Link>
          </div>

          {/* Welcome banner for new users only */}
          {isWelcomeFlow && (
            <div className="bg-gradient-to-r from-primary-light to-accent-light border border-primary-medium rounded-lg p-4 mb-6">
              <div className="flex items-center gap-3">
                <span className="text-2xl">👋</span>
                <div>
                  <h3 className="font-semibold text-text">Welcome to Karmyq!</h3>
                  <p className="text-sm text-text-muted">
                    Join a community near you to get started — it's where requests, activities, and mutual aid happen.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Your Communities strip — zero API calls, reads JWT from user state */}
          {user && (user.communities ?? []).length > 0 && (
            <div className="mb-6">
              <h2 className="text-sm font-semibold text-text-muted uppercase tracking-wide mb-3">
                Your Communities
              </h2>
              <div className="flex flex-wrap gap-2">
                {(user.communities ?? []).map((c: { id: string; name: string; role: string }) => (
                  <Link
                    key={c.id}
                    href={`/communities/${c.id}`}
                    className="inline-flex items-center gap-2 px-3 py-2 bg-surface-raised border border-border rounded-lg text-sm font-medium text-text hover:border-primary hover:text-primary transition-colors"
                  >
                    {c.name}
                    <span className="text-xs text-text-subtle capitalize bg-surface px-1.5 py-0.5 rounded-full">
                      {c.role}
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Discovery Toggle */}
          <div className="mb-4">
            <DiscoveryToggle mode={discoveryMode} onChange={handleDiscoveryModeChange} />
            {locationDenied && (
              <p className="mt-2 text-sm text-text-muted">
                📍 Location access denied — showing all communities
              </p>
            )}
          </div>

          {/* Tag chips (interests mode) */}
          {discoveryMode === 'interests' && availableTags.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-4">
              {availableTags.map(tag => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => toggleTag(tag)}
                  className={`px-3 py-1 rounded-full text-sm font-medium border transition-colors ${
                    selectedTags.includes(tag)
                      ? 'bg-primary text-white border-primary'
                      : 'bg-surface border-border text-text-muted hover:border-primary hover:text-text'
                  }`}
                >
                  {tag}
                </button>
              ))}
            </div>
          )}

          {/* Filter toggle for welcome flow */}
          {isWelcomeFlow && (
            <button
              onClick={() => setShowFilters(f => !f)}
              className="text-sm text-text-muted hover:text-text mb-4 flex items-center gap-1"
            >
              {showFilters ? '▲ Hide filters' : '▼ Filter communities'}
            </button>
          )}

          {/* Search and Filters */}
          {showFilters && (
          <div className="bg-surface-raised rounded-xl border border-border p-6 mb-6">
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
                  className="w-full px-3 py-2 border border-border rounded-lg bg-surface text-text focus:outline-none focus:ring-2 focus:ring-primary"
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
                  className="w-full px-3 py-2 border border-border rounded-lg bg-surface text-text focus:outline-none focus:ring-2 focus:ring-primary"
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
                  className="w-full px-3 py-2 border border-border rounded-lg bg-surface text-text focus:outline-none focus:ring-2 focus:ring-primary"
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
                  className="w-full px-3 py-2 border border-border rounded-lg bg-surface text-text focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="activity">Most Active</option>
                  <option value="newest">Newest First</option>
                  <option value="members">Most Members</option>
                  <option value="alphabetical">A-Z</option>
                </select>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <label className="flex items-center cursor-pointer">
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
                className="text-sm text-primary hover:text-primary-dark transition-colors"
              >
                Clear All Filters
              </button>
            </div>
          </div>
          )}

          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg mb-4">
              {error}
            </div>
          )}

          {geoFallback && discoveryMode === 'geography' && (
            <p className="text-sm text-text-muted text-center py-2">
              Showing all communities — we couldn't narrow results by location.
            </p>
          )}

          {/* Results */}
          {loading ? (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {Array.from({ length: 6 }).map((_, i) => (
                <CommunityCardSkeleton key={i} />
              ))}
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
              {(() => {
                const joinedIds = new Set((user?.communities ?? []).map((c: any) => c.id))
                const discoverCommunities = communities.filter(c => !joinedIds.has(c.id))
                return (
                  <>
                    {discoverCommunities.length > 0 && (user?.communities ?? []).length > 0 && (
                      <h2 className="text-sm font-semibold text-text-muted uppercase tracking-wide mb-4">
                        Discover More
                      </h2>
                    )}
                    {discoverCommunities.length === 0 && communities.length > 0 ? (
                      <div className="mb-4 text-sm text-text-muted">
                        You've joined all available communities in this view.
                      </div>
                    ) : (
                      <div className="mb-4 text-sm text-text-muted">
                        Found {discoverCommunities.length} {discoverCommunities.length === 1 ? 'community' : 'communities'}
                      </div>
                    )}
                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {discoverCommunities.map((community) => {
                  const memberStatus = membershipStatus[community.id]
                  const isFull = community.current_members >= community.max_members

                  return (
                    <div
                      key={community.id}
                      className="bg-surface-raised rounded-xl border border-border p-6 hover:shadow-md transition-shadow"
                    >
                      <Link href={`/communities/${community.id}`}>
                        <div className="flex justify-between items-start mb-3">
                          <h3 className="text-lg font-semibold text-text hover:text-primary transition-colors leading-tight">
                            {community.name}
                          </h3>
                          <div className="flex gap-2 shrink-0 ml-2">
                            {community.access_type === 'private' && (
                              <span className="text-xs bg-accent-light text-accent-dark px-2 py-0.5 rounded-full">
                                Private
                              </span>
                            )}
                            {isFull && (
                              <span className="text-xs bg-red-100 text-red-800 px-2 py-0.5 rounded-full">
                                Full
                              </span>
                            )}
                          </div>
                        </div>

                        {community.category && (
                          <div className="mb-2">
                            <span className="text-xs bg-primary-light text-primary-dark px-2 py-0.5 rounded-full">
                              {community.category}
                            </span>
                          </div>
                        )}

                        <p className="text-sm text-text-muted mb-3 line-clamp-2">{community.description}</p>

                        {(community.location || community.distance_km != null) && (
                          <p className="text-sm text-text-subtle mb-3 flex items-center gap-1">
                            <span>📍</span>
                            <span>
                              {community.location}
                              {community.distance_km != null && (
                                <span className="ml-1 text-primary font-medium">
                                  ({community.distance_km < 1
                                    ? `${Math.round(community.distance_km * 1000)}m`
                                    : `${community.distance_km.toFixed(1)}km`} away)
                                </span>
                              )}
                            </span>
                          </p>
                        )}

                        {/* Tags */}
                        {community.tags && community.tags.length > 0 && (
                          <div className="flex flex-wrap gap-1 mb-3">
                            {community.tags.slice(0, 4).map(tag => (
                              <span
                                key={tag}
                                className="text-xs px-2 py-0.5 rounded-full bg-surface border border-border text-text-muted"
                              >
                                {tag}
                              </span>
                            ))}
                          </div>
                        )}

                        <div className="flex items-center justify-between text-sm text-text-subtle mb-3">
                          <span>
                            {community.current_members} / {community.max_members} members
                          </span>
                          <span>by {community.creator_name}</span>
                        </div>

                        <div className="w-full bg-border rounded-full h-1.5 mb-4">
                          <div
                            className="bg-primary h-1.5 rounded-full transition-all"
                            style={{
                              width: `${Math.min((community.current_members / community.max_members) * 100, 100)}%`,
                            }}
                          />
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
                              <span className="px-2 py-0.5 rounded-full bg-surface border border-border text-text-subtle">
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
                            className="w-full px-4 py-2 bg-success-light text-green-800 rounded-lg text-sm font-medium cursor-not-allowed"
                          >
                            ✓ Joined
                          </button>
                        ) : memberStatus === 'pending' ? (
                          <button
                            disabled
                            className="w-full px-4 py-2 bg-yellow-100 text-yellow-800 rounded-lg text-sm font-medium cursor-not-allowed"
                          >
                            ⏳ Pending Approval
                          </button>
                        ) : isFull ? (
                          <button
                            disabled
                            className="w-full px-4 py-2 bg-border text-text-subtle rounded-lg text-sm font-medium cursor-not-allowed"
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
                            className={`w-full px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                              joiningId === community.id
                                ? 'bg-border text-text-muted cursor-wait'
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
                  </>
                )
              })()}

              {/* Load More Button */}
              {hasMore && (
                <div className="mt-8 text-center">
                  <button
                    onClick={() => fetchCommunities({ loadMore: true })}
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
