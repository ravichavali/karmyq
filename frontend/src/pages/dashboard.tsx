import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import Link from 'next/link'
import { communityService, requestService } from '@/lib/api'
import Layout from '@/components/Layout'

interface Community {
  id: string
  name: string
  description: string
  current_members: number
  max_members: number
}

interface HelpRequest {
  id: string
  title: string
  status: string
  urgency: string
  community_name: string
  created_at: string
}

interface HelpOffer {
  id: string
  title: string
  status: string
  category: string
  community_name: string
  created_at: string
}

export default function Dashboard() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [communities, setCommunities] = useState<Community[]>([])
  const [requests, setRequests] = useState<HelpRequest[]>([])
  const [offers, setOffers] = useState<HelpOffer[]>([])
  const [loadingCommunities, setLoadingCommunities] = useState(true)
  const [loadingRequests, setLoadingRequests] = useState(true)
  const [loadingOffers, setLoadingOffers] = useState(true)

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
    fetchRequests()
    fetchOffers()
  }, [router])

  const fetchCommunities = async () => {
    try {
      const response = await communityService.getCommunities({ limit: 10 })
      setCommunities(response.data.data)
    } catch (err) {
      console.error('Failed to load communities:', err)
    } finally {
      setLoadingCommunities(false)
    }
  }

  const fetchRequests = async () => {
    try {
      const response = await requestService.getRequests({ status: 'open', limit: 5 })
      setRequests(response.data.data)
    } catch (err) {
      console.error('Failed to load requests:', err)
    } finally {
      setLoadingRequests(false)
    }
  }

  const fetchOffers = async () => {
    try {
      const response = await requestService.getOffers({ status: 'active', limit: 5 })
      setOffers(response.data.data)
    } catch (err) {
      console.error('Failed to load offers:', err)
    } finally {
      setLoadingOffers(false)
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
        <div className="container mx-auto px-4 py-8">
          <div className="bg-white rounded-lg shadow-md p-8 mb-8">
            <h2 className="text-3xl font-bold mb-4">Welcome, {user.name}!</h2>
            <p className="text-gray-600">Email: {user.email}</p>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <div className="bg-white rounded-lg shadow-md p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-semibold">Communities</h3>
                <Link
                  href="/communities"
                  className="text-sm text-blue-600 hover:text-blue-800"
                >
                  View All
                </Link>
              </div>
              {loadingCommunities ? (
                <p className="text-gray-500">Loading...</p>
              ) : communities.length === 0 ? (
                <p className="text-gray-600 mb-4">
                  No communities yet. Be the first to create one!
                </p>
              ) : (
                <div className="space-y-2 mb-4">
                  {communities.slice(0, 3).map((community) => (
                    <Link
                      key={community.id}
                      href={`/communities/${community.id}`}
                      className="block p-3 bg-gray-50 rounded hover:bg-gray-100"
                    >
                      <div className="font-medium">{community.name}</div>
                      <div className="text-sm text-gray-600">
                        {community.current_members} members
                      </div>
                    </Link>
                  ))}
                </div>
              )}
              <Link
                href="/communities/new"
                className="block text-center px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                Create Community
              </Link>
            </div>

            <div className="bg-white rounded-lg shadow-md p-6">
              <h3 className="text-xl font-semibold mb-4">Your Karma</h3>
              <div className="text-4xl font-bold text-blue-600 mb-2">0</div>
              <p className="text-gray-600">
                Start helping others to earn karma points
              </p>
            </div>

            <div className="bg-white rounded-lg shadow-md p-6">
              <h3 className="text-xl font-semibold mb-4">Messages</h3>
              <div className="flex items-center justify-center py-8">
                <div className="text-center">
                  <div className="text-5xl mb-3">💬</div>
                  <p className="text-gray-600 mb-4">Chat with your matches</p>
                  <Link
                    href="/messages"
                    className="inline-block px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                  >
                    View Messages
                  </Link>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-md p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-semibold">Recent Requests</h3>
                <Link
                  href="/requests"
                  className="text-sm text-blue-600 hover:text-blue-800"
                >
                  View All
                </Link>
              </div>
              {loadingRequests ? (
                <p className="text-gray-500">Loading...</p>
              ) : requests.length === 0 ? (
                <p className="text-gray-600 mb-4">No open requests yet</p>
              ) : (
                <div className="space-y-2 mb-4">
                  {requests.slice(0, 3).map((request) => (
                    <Link
                      key={request.id}
                      href={`/requests/${request.id}`}
                      className="block p-3 bg-gray-50 rounded hover:bg-gray-100"
                    >
                      <div className="font-medium">{request.title}</div>
                      <div className="text-sm text-gray-600">
                        {request.community_name} • {request.urgency} urgency
                      </div>
                    </Link>
                  ))}
                </div>
              )}
              <Link
                href="/requests/new"
                className="block text-center px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                Create Request
              </Link>
            </div>

            <div className="bg-white rounded-lg shadow-md p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-semibold">Available Offers</h3>
                <Link
                  href="/offers"
                  className="text-sm text-blue-600 hover:text-blue-800"
                >
                  View All
                </Link>
              </div>
              {loadingOffers ? (
                <p className="text-gray-500">Loading...</p>
              ) : offers.length === 0 ? (
                <p className="text-gray-600 mb-4">No active offers yet</p>
              ) : (
                <div className="space-y-2 mb-4">
                  {offers.slice(0, 3).map((offer) => (
                    <div
                      key={offer.id}
                      className="block p-3 bg-gray-50 rounded"
                    >
                      <div className="font-medium">{offer.title}</div>
                      <div className="text-sm text-gray-600 capitalize">
                        {offer.community_name} • {offer.category.replace(/_/g, ' ')}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <Link
                href="/offers/new"
                className="block text-center px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
              >
                Create Offer
              </Link>
            </div>
          </div>
        </div>
      </Layout>
    </>
  )
}
