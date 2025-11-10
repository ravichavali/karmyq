import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import Link from 'next/link'
import { requestService } from '@/lib/api'
import Layout from '@/components/Layout'
import FloatingChat from '@/components/FloatingChat'
import Feed from '@/components/Feed/Feed'

interface HelpRequest {
  id: string
  title: string
  status: string
  urgency: string
  community_name: string
  requester_id: string
  created_at: string
}

export default function Dashboard() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [matchedRequests, setMatchedRequests] = useState<HelpRequest[]>([])
  const [myActiveRequests, setMyActiveRequests] = useState<HelpRequest[]>([])
  const [loadingMatched, setLoadingMatched] = useState(true)
  const [loadingMy, setLoadingMy] = useState(true)

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

    fetchMatchedRequests()
    fetchMyRequests()
  }, [router])

  const fetchMatchedRequests = async () => {
    try {
      const userData = localStorage.getItem('user')
      if (userData) {
        const user = JSON.parse(userData)
        const response = await requestService.getMatchedRequests(user.id, 10)
        setMatchedRequests(response.data.data)
      }
    } catch (err) {
      console.error('Failed to load matched requests:', err)
    } finally {
      setLoadingMatched(false)
    }
  }

  const fetchMyRequests = async () => {
    try {
      const userData = localStorage.getItem('user')
      if (userData) {
        const user = JSON.parse(userData)
        const response = await requestService.getRequests({ status: 'open', limit: 10 })
        // Filter for current user's requests
        const myReqs = response.data.data.filter((r: HelpRequest) => r.requester_id === user.id)
        setMyActiveRequests(myReqs)
      }
    } catch (err) {
      console.error('Failed to load my requests:', err)
    } finally {
      setLoadingMy(false)
    }
  }

  if (!user) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>
  }

  return (
    <>
      <Head>
        <title>Dashboard - Karmyq</title>
      </Head>
      <Layout>
        <div className="container mx-auto px-4 py-6 max-w-7xl">
          {/* Header with Primary Action */}
          <div className="flex justify-between items-center mb-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Your Dashboard</h1>
              <p className="text-sm text-gray-600 mt-1">Help others and get help from your communities</p>
            </div>
            <Link
              href="/requests/new"
              className="px-6 py-3 bg-red-600 text-white font-semibold rounded-lg hover:bg-red-700 transition-colors shadow-md"
            >
              + Ask for Help
            </Link>
          </div>

          {/* Main Content Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Column - Feed (takes 2 columns on large screens) */}
            <div className="lg:col-span-2">
              <Feed userId={user.id} limit={15} />
            </div>

            {/* Right Column - Quick Actions & Summary */}
            <div className="space-y-6">
              {/* Quick Stats */}
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Stats</h3>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Active Requests</span>
                    <span className="text-lg font-bold text-blue-600">{myActiveRequests.length}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Matches for You</span>
                    <span className="text-lg font-bold text-green-600">{matchedRequests.length}</span>
                  </div>
                </div>
              </div>

              {/* Quick Actions */}
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
                <div className="space-y-3">
                  <Link
                    href="/requests/new"
                    className="block w-full px-4 py-3 bg-blue-600 text-white text-center font-medium rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    + Create Request
                  </Link>
                  <Link
                    href="/communities"
                    className="block w-full px-4 py-3 bg-gray-100 text-gray-800 text-center font-medium rounded-lg hover:bg-gray-200 transition-colors"
                  >
                    Explore Communities
                  </Link>
                  <Link
                    href="/profile"
                    className="block w-full px-4 py-3 bg-gray-100 text-gray-800 text-center font-medium rounded-lg hover:bg-gray-200 transition-colors"
                  >
                    Edit Profile
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Floating Chat Component */}
        <FloatingChat />
      </Layout>
    </>
  )
}
