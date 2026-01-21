import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import Link from 'next/link'
import { communityService } from '@/lib/api'
import Layout from '@/components/Layout'

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
}

interface MembershipStatus {
  [communityId: string]: 'active' | 'pending' | null
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
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [joiningId, setJoiningId] = useState<string | null>(null)

  // Filter states
  const [searchQuery, setSearchQuery] = useState('')
  const [locationFilter, setLocationFilter] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [hasSpaceFilter, setHasSpaceFilter] = useState(false)
  const [sortBy, setSortBy] = useState('newest')

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

  const fetchCommunities = async () => {
    try {
      setLoading(true)
      const params: any = {
        status: 'active',
        limit: 100,
        sort: sortBy
      }

      if (searchQuery) params.search = searchQuery
      if (locationFilter) params.location = locationFilter
      if (categoryFilter) params.category = categoryFilter
      if (hasSpaceFilter) params.has_space = 'true'

      const response = await communityService.getCommunities(params)
      setCommunities(response.data.communities)

      // Fetch user's memberships to check status
      const userData = localStorage.getItem('user')
      if (userData) {
        const user = JSON.parse(userData)
        await fetchMembershipStatus(user.id, response.data.communities)
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load communities')
    } finally {
      setLoading(false)
    }
  }

  const fetchMembershipStatus = async (userId: string, communities: Community[]) => {
    try {
      // Efficient approach: Fetch user's communities once, build status map
      const response = await communityService.getMyCommunities(userId)
      const myCommunities = response.data?.communities || response.data

      const statusMap: MembershipStatus = {}

      // Build a map of user's memberships
      const membershipMap = new Map(
        myCommunities.map((c: any) => [c.id, c.role || 'active'])
      )

      // Check each community against user's memberships
      for (const community of communities) {
        statusMap[community.id] = membershipMap.has(community.id) ? 'active' : null
      }

      setMembershipStatus(statusMap)
    } catch (err) {
      console.error('Failed to fetch membership status:', err)
    }
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
              <p className="text-gray-600">
                Find and join communities based on location, interests, or mission
              </p>
            </div>
            <Link
              href="/communities/new"
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Create Community
            </Link>
          </div>

          {/* Search and Filters */}
          <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
              {/* Search */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Search
                </label>
                <input
                  type="text"
                  placeholder="Search by name or description..."
                  value={searchQuery}
                  onChange={handleSearchChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Location Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Location
                </label>
                <input
                  type="text"
                  placeholder="City, region, or area..."
                  value={locationFilter}
                  onChange={(e) => setLocationFilter(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Category Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Category
                </label>
                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">All Categories</option>
                  {CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              {/* Sort */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Sort By
                </label>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                <span className="text-sm text-gray-700">Only show communities with available spots</span>
              </label>

              <button
                onClick={handleClearFilters}
                className="text-sm text-blue-600 hover:text-blue-800"
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
              <div className="text-gray-500">Loading communities...</div>
            </div>
          ) : communities.length === 0 ? (
            <div className="bg-white rounded-lg shadow-md p-8 text-center">
              <p className="text-gray-600 mb-4">
                {searchQuery || locationFilter || categoryFilter
                  ? 'No communities match your search criteria. Try adjusting your filters.'
                  : 'No communities yet. Be the first to create one!'}
              </p>
              {!searchQuery && !locationFilter && !categoryFilter && (
                <Link
                  href="/communities/new"
                  className="inline-block px-6 py-3 bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  Create Community
                </Link>
              )}
            </div>
          ) : (
            <>
              <div className="mb-4 text-sm text-gray-600">
                Found {communities.length} {communities.length === 1 ? 'community' : 'communities'}
              </div>
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {communities.map((community) => {
                  const memberStatus = membershipStatus[community.id]
                  const isFull = community.current_members >= community.max_members

                  return (
                    <div
                      key={community.id}
                      className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow"
                    >
                      <Link href={`/communities/${community.id}`}>
                        <div className="flex justify-between items-start mb-3">
                          <h3 className="text-xl font-semibold hover:text-blue-600 transition-colors">
                            {community.name}
                          </h3>
                          <div className="flex gap-2">
                            {community.access_type === 'private' && (
                              <span className="text-xs bg-purple-100 text-purple-800 px-2 py-1 rounded">
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
                            <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                              {community.category}
                            </span>
                          </div>
                        )}

                        <p className="text-gray-600 mb-3 line-clamp-2">{community.description}</p>

                        {community.location && (
                          <p className="text-sm text-gray-500 mb-3">
                            📍 {community.location}
                          </p>
                        )}

                        <div className="flex items-center justify-between text-sm text-gray-500 mb-3">
                          <span>
                            {community.current_members} / {community.max_members} members
                          </span>
                          <span>by {community.creator_name}</span>
                        </div>

                        <div className="w-full bg-gray-200 rounded-full h-2 mb-4">
                          <div
                            className="bg-blue-600 h-2 rounded-full"
                            style={{
                              width: `${(community.current_members / community.max_members) * 100}%`,
                            }}
                          ></div>
                        </div>
                      </Link>

                      {/* Join Button */}
                      <div>
                        {memberStatus === 'active' ? (
                          <button
                            disabled
                            className="w-full px-4 py-2 bg-green-100 text-green-800 rounded text-sm font-medium cursor-not-allowed"
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
                            className="w-full px-4 py-2 bg-gray-100 text-gray-500 rounded text-sm font-medium cursor-not-allowed"
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
                                ? 'bg-gray-300 text-gray-600 cursor-wait'
                                : community.access_type === 'private'
                                ? 'bg-purple-600 text-white hover:bg-purple-700'
                                : 'bg-blue-600 text-white hover:bg-blue-700'
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
          )}
        </div>
      </Layout>
    </>
  )
}
