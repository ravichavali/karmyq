import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import Link from 'next/link'
import { requestService } from '../../lib/api'
import Layout from '@/components/Layout'
import ConnectionBadge from '@/components/requests/ConnectionBadge'

interface HelpRequest {
  id: string
  community_id: string
  community_name: string
  requester_id: string
  requester_name: string
  title: string
  description: string
  category: string
  urgency: string
  status: string
  created_at: string
  updated_at: string
  // Day 7: Curated feed fields
  matchScore?: number
  matchReasons?: string[]
  matchBreakdown?: {
    locationScore?: number
    skillScore?: number
    availabilityScore?: number
    preferenceScore?: number
    urgencyBonus?: number
  }
}

export default function RequestsPage() {
  const router = useRouter()
  const [requests, setRequests] = useState<HelpRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState({
    status: 'open',
    category: '',
  })
  // Day 7: Curated feed state
  const [useCuratedFeed, setUseCuratedFeed] = useState(true)
  const [minMatchScore, setMinMatchScore] = useState(30)
  const [currentUser, setCurrentUser] = useState<any>(null)

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const userStr = localStorage.getItem('user')
      if (userStr) {
        setCurrentUser(JSON.parse(userStr))
      }
    }
  }, [])

  useEffect(() => {
    if (currentUser) {
      fetchRequests()
    }
  }, [filter, useCuratedFeed, minMatchScore, currentUser])

  const fetchRequests = async () => {
    try {
      setLoading(true)

      if (useCuratedFeed && currentUser) {
        // Day 7: Use curated feed endpoint with match scores
        const params: any = {
          minScore: minMatchScore,
          limit: 50,
        }

        if (filter.category) params.type = filter.category

        const response = await requestService.getCuratedRequests(params)
        setRequests(response.data.data.requests || [])
      } else {
        // Original endpoint
        const params: any = { limit: 50 }

        if (filter.status) params.status = filter.status
        if (filter.category) params.type = filter.category

        const response = await requestService.getRequests(params)
        setRequests(response.data.data.requests || response.data.data || [])
      }
    } catch (error) {
      console.error('Error fetching requests:', error)
    } finally {
      setLoading(false)
    }
  }

  const getUrgencyColor = (urgency: string) => {
    switch (urgency) {
      case 'high': return 'text-red-600 bg-red-100'
      case 'medium': return 'text-yellow-600 bg-yellow-100'
      case 'low': return 'text-green-600 bg-green-100'
      default: return 'text-gray-600 bg-gray-100'
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open': return 'text-blue-600 bg-blue-100'
      case 'matched': return 'text-purple-600 bg-purple-100'
      case 'completed': return 'text-green-600 bg-green-100'
      case 'cancelled': return 'text-gray-600 bg-gray-100'
      default: return 'text-gray-600 bg-gray-100'
    }
  }

  return (
    <>
      <Head>
        <title>Help Requests - Karmyq</title>
      </Head>
      <Layout title="Help Requests">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <p className="text-gray-600 mt-2">Browse and respond to community help requests</p>
          </div>
          <Link
            href="/requests/new"
            className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition"
          >
            Create Request
          </Link>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          {/* Day 7: Curated Feed Toggle */}
          {currentUser && (
            <div className="mb-6 pb-6 border-b">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <label className="flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={useCuratedFeed}
                        onChange={(e) => setUseCuratedFeed(e.target.checked)}
                        className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                      />
                      <span className="ml-3 text-sm font-medium text-gray-900">
                        Show Curated Feed (Best Matches)
                      </span>
                    </label>
                    {useCuratedFeed && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                        Smart Filtering
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-600 mt-1 ml-8">
                    {useCuratedFeed
                      ? 'Showing requests matched to your skills and preferences'
                      : 'Showing all requests from your communities'}
                  </p>
                </div>
              </div>

              {/* Match Score Slider */}
              {useCuratedFeed && (
                <div className="mt-4 ml-8">
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm font-medium text-gray-700">
                      Minimum Match Score: {minMatchScore}%
                    </label>
                    {/* Day 8: Link to Preferences */}
                    <Link
                      href="/settings/preferences"
                      className="text-xs text-blue-600 hover:text-blue-700 underline"
                    >
                      Manage Feed Preferences →
                    </Link>
                  </div>
                  <div className="flex items-center gap-4">
                    <input
                      type="range"
                      min="0"
                      max="100"
                      step="10"
                      value={minMatchScore}
                      onChange={(e) => setMinMatchScore(parseInt(e.target.value))}
                      className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                    />
                    <span className="text-sm text-gray-600 min-w-[60px]">
                      {minMatchScore === 0 && 'Show All'}
                      {minMatchScore > 0 && minMatchScore < 50 && 'Low Match'}
                      {minMatchScore >= 50 && minMatchScore < 70 && 'Good Match'}
                      {minMatchScore >= 70 && 'High Match'}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    Higher scores = better match to your skills
                  </p>
                </div>
              )}
            </div>
          )}

          <div className="flex flex-wrap gap-4">
            {!useCuratedFeed && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Status
                </label>
                <select
                  value={filter.status}
                  onChange={(e) => setFilter({ ...filter, status: e.target.value })}
                  className="border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">All</option>
                  <option value="open">Open</option>
                  <option value="matched">Matched</option>
                  <option value="completed">Completed</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Category
              </label>
              <select
                value={filter.category}
                onChange={(e) => setFilter({ ...filter, category: e.target.value })}
                className="border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">All Categories</option>
                <option value="physical_help">Physical Help</option>
                <option value="skills">Skills & Expertise</option>
                <option value="resources">Resources</option>
                <option value="emotional_support">Emotional Support</option>
                <option value="transportation">Transportation</option>
                <option value="other">Other</option>
              </select>
            </div>
          </div>
        </div>

        {/* Requests List */}
        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="text-gray-600 mt-4">Loading requests...</p>
          </div>
        ) : requests.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm p-12 text-center">
            <p className="text-gray-600 text-lg">No requests found</p>
            <p className="text-gray-500 mt-2">Try adjusting your filters or create a new request</p>
          </div>
        ) : (
          <div className="grid gap-6">
            {requests.map((request) => (
              <Link
                key={request.id}
                href={`/requests/${request.id}`}
                className="bg-white rounded-lg shadow-sm p-6 hover:shadow-md transition"
              >
                <div className="flex justify-between items-start mb-4">
                  <div className="flex-1">
                    <div className="flex items-start gap-3 mb-2">
                      <h3 className="text-xl font-semibold text-gray-900 flex-1">
                        {request.title}
                      </h3>
                      {/* Day 7: Match Score Badge */}
                      {request.matchScore !== undefined && (
                        <div className="flex flex-col items-end gap-1">
                          <div className={`px-3 py-1 rounded-full text-sm font-bold ${
                            request.matchScore >= 70 ? 'bg-green-100 text-green-800' :
                            request.matchScore >= 50 ? 'bg-blue-100 text-blue-800' :
                            request.matchScore >= 30 ? 'bg-yellow-100 text-yellow-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {request.matchScore}% Match
                          </div>
                          {request.matchReasons && request.matchReasons.length > 0 && (
                            <div className="group relative">
                              <button className="text-xs text-blue-600 hover:text-blue-700">
                                Why? ↓
                              </button>
                              <div className="hidden group-hover:block absolute right-0 mt-1 w-64 bg-white border border-gray-200 rounded-lg shadow-lg p-3 z-10">
                                <p className="text-xs font-semibold text-gray-700 mb-2">Match Reasons:</p>
                                <ul className="text-xs text-gray-600 space-y-1">
                                  {request.matchReasons.slice(0, 3).map((reason, idx) => (
                                    <li key={idx} className="flex items-start gap-1">
                                      <span>•</span>
                                      <span>{reason}</span>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                    <p className="text-gray-600 line-clamp-2">{request.description}</p>
                  </div>
                  <div className="flex gap-2 ml-4">
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getUrgencyColor(request.urgency)}`}>
                      {request.urgency}
                    </span>
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(request.status)}`}>
                      {request.status}
                    </span>
                  </div>
                </div>

                {/* Connection Badge */}
                <div className="mb-4">
                  <ConnectionBadge requesterId={request.requester_id} />
                </div>

                <div className="flex items-center gap-6 text-sm text-gray-500">
                  <div className="flex items-center gap-2">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                    <span>{request.community_name}</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                    <span>{request.requester_name}</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                    </svg>
                    <span className="capitalize">{request.category.replace(/_/g, ' ')}</span>
                  </div>

                  <div className="flex items-center gap-2 ml-auto">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span>{new Date(request.created_at).toLocaleDateString()}</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
        </div>
      </Layout>
    </>
  )
}
