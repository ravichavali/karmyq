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
  current_members: number
  max_members: number
  creator_name: string
  created_at: string
}

export default function CommunitiesPage() {
  const router = useRouter()
  const [communities, setCommunities] = useState<Community[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const token = localStorage.getItem('token')
    if (!token) {
      router.push('/login')
      return
    }
    fetchCommunities()
  }, [router])

  const fetchCommunities = async () => {
    try {
      setLoading(true)
      const response = await communityService.getCommunities({ status: 'active', limit: 50 })
      setCommunities(response.data.data)
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load communities')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <Head>
        <title>Communities - Karmyq</title>
      </Head>
      <Layout title="Communities">
        <div className="container mx-auto px-4 py-8">
          <div className="mb-8 flex justify-between items-center">
            <p className="text-gray-600">
              Join communities to help others and receive help. Each community can have up to 150 members.
            </p>
            <Link
              href="/communities/new"
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Create Community
            </Link>
          </div>

          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
              {error}
            </div>
          )}

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-gray-500">Loading communities...</div>
            </div>
          ) : communities.length === 0 ? (
            <div className="bg-white rounded-lg shadow-md p-8 text-center">
              <p className="text-gray-600 mb-4">No communities yet. Be the first to create one!</p>
              <Link
                href="/communities/new"
                className="inline-block px-6 py-3 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                Create Community
              </Link>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {communities.map((community) => (
                <Link
                  key={community.id}
                  href={`/communities/${community.id}`}
                  className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow"
                >
                  <h3 className="text-xl font-semibold mb-2">{community.name}</h3>
                  <p className="text-gray-600 mb-4 line-clamp-2">{community.description}</p>
                  <div className="flex items-center justify-between text-sm text-gray-500">
                    <span>
                      {community.current_members} / {community.max_members} members
                    </span>
                    <span>by {community.creator_name}</span>
                  </div>
                  <div className="mt-4">
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-blue-600 h-2 rounded-full"
                        style={{
                          width: `${(community.current_members / community.max_members) * 100}%`,
                        }}
                      ></div>
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
