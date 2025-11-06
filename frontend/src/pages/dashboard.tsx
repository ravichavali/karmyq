import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import Link from 'next/link'
import { requestService } from '@/lib/api'
import Layout from '@/components/Layout'
import FloatingChat from '@/components/FloatingChat'

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
        <div className="container mx-auto px-4 py-6 max-w-5xl">
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

          {/* People Need Your Help - Primary Section */}
          <div className="bg-white rounded-lg shadow-lg mb-6">
            <div className="px-6 py-4 border-b border-gray-200 bg-red-50">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">🆘</span>
                  <h2 className="text-xl font-bold text-red-700">People Need Your Help</h2>
                </div>
                <Link
                  href="/requests"
                  className="text-sm text-red-700 hover:text-red-900 font-medium"
                >
                  See All Requests →
                </Link>
              </div>
              <p className="text-sm text-red-600 mt-1">Based on your skills and communities</p>
            </div>

            <div className="divide-y divide-gray-100">
              {loadingMatched ? (
                <div className="p-6 text-center text-gray-500">Loading...</div>
              ) : matchedRequests.length === 0 ? (
                <div className="p-8 text-center">
                  <p className="text-gray-600 mb-4">
                    No requests match your skills yet
                  </p>
                  <div className="space-y-2 text-sm text-gray-500">
                    <p>💡 Add more skills in your <Link href="/profile" className="text-blue-600 hover:underline">profile</Link> to see relevant requests</p>
                    <p>👥 Join more <Link href="/communities" className="text-blue-600 hover:underline">communities</Link> to help more people</p>
                  </div>
                </div>
              ) : (
                matchedRequests.map((request) => (
                  <div
                    key={request.id}
                    className="px-6 py-4 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <Link
                        href={`/requests/${request.id}`}
                        className="flex-1 min-w-0"
                      >
                        <div className="flex items-center gap-2 mb-1">
                          {request.urgency === 'high' && (
                            <span className="px-2 py-0.5 text-xs font-bold text-white bg-red-600 rounded">
                              URGENT
                            </span>
                          )}
                          <h3 className="font-semibold text-gray-900 hover:text-blue-600 transition-colors">
                            {request.title}
                          </h3>
                        </div>
                        <p className="text-sm text-gray-600">
                          {request.community_name} • {request.urgency} urgency
                        </p>
                      </Link>
                      <Link
                        href={`/requests/${request.id}`}
                        className="px-4 py-2 bg-green-600 text-white font-medium text-sm rounded-lg hover:bg-green-700 transition-colors whitespace-nowrap"
                      >
                        I Can Help
                      </Link>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Your Active Requests - Only show if user has any */}
          {myActiveRequests.length > 0 && (
            <div className="bg-white rounded-lg shadow-lg">
              <div className="px-6 py-4 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">📋</span>
                    <h2 className="text-xl font-bold text-gray-900">Your Active Requests</h2>
                  </div>
                  <Link
                    href="/requests/new"
                    className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                  >
                    + New Request
                  </Link>
                </div>
              </div>

              <div className="divide-y divide-gray-100">
                {loadingMy ? (
                  <div className="p-6 text-center text-gray-500">Loading...</div>
                ) : (
                  myActiveRequests.map((request) => (
                    <Link
                      key={request.id}
                      href={`/requests/${request.id}`}
                      className="block px-6 py-4 hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            {request.urgency === 'high' && (
                              <span className="px-2 py-0.5 text-xs font-bold text-white bg-red-600 rounded">
                                URGENT
                              </span>
                            )}
                            <h3 className="font-semibold text-gray-900">
                              {request.title}
                            </h3>
                          </div>
                          <p className="text-sm text-gray-600">
                            {request.community_name} • {request.urgency} urgency
                          </p>
                        </div>
                        <span className="px-3 py-1 bg-blue-100 text-blue-800 text-xs font-medium rounded">
                          Open
                        </span>
                      </div>
                    </Link>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* Floating Chat Component */}
        <FloatingChat />
      </Layout>
    </>
  )
}
