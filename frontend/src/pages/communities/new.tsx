import { useState } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import Link from 'next/link'
import { communityService } from '@/lib/api'

export default function NewCommunityPage() {
  const router = useRouter()
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    max_members: 150,
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    const user = JSON.parse(localStorage.getItem('user') || '{}')
    if (!user.id) {
      router.push('/login')
      return
    }

    if (formData.name.length < 3) {
      setError('Community name must be at least 3 characters')
      return
    }

    try {
      setLoading(true)
      const response = await communityService.createCommunity({
        name: formData.name,
        description: formData.description,
        creator_id: user.id,
        max_members: formData.max_members,
      })
      router.push(`/communities/${response.data.data.id}`)
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to create community')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <Head>
        <title>Create Community - Karmyq</title>
      </Head>
      <div className="min-h-screen bg-gray-50">
        <nav className="bg-white shadow">
          <div className="container mx-auto px-4 py-4 flex justify-between items-center">
            <Link href="/dashboard" className="text-2xl font-bold text-blue-600">
              Karmyq
            </Link>
            <div className="flex gap-4">
              <Link href="/communities" className="px-4 py-2 text-gray-700 hover:text-blue-600">
                All Communities
              </Link>
              <Link href="/dashboard" className="px-4 py-2 text-gray-700 hover:text-blue-600">
                Dashboard
              </Link>
            </div>
          </div>
        </nav>

        <div className="container mx-auto px-4 py-8">
          <div className="max-w-2xl mx-auto">
            <div className="bg-white rounded-lg shadow-md p-8">
              <h1 className="text-3xl font-bold mb-6">Create New Community</h1>

              {error && (
                <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                  <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
                    Community Name *
                  </label>
                  <input
                    type="text"
                    id="name"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="e.g., Downtown Neighbors"
                  />
                  <p className="mt-1 text-sm text-gray-500">
                    Choose a descriptive name for your community (3-255 characters)
                  </p>
                </div>

                <div>
                  <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-2">
                    Description
                  </label>
                  <textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    rows={4}
                    placeholder="Describe what your community is about..."
                  />
                  <p className="mt-1 text-sm text-gray-500">
                    Help others understand what your community is for
                  </p>
                </div>

                <div>
                  <label htmlFor="max_members" className="block text-sm font-medium text-gray-700 mb-2">
                    Maximum Members
                  </label>
                  <input
                    type="number"
                    id="max_members"
                    min="1"
                    max="150"
                    value={formData.max_members}
                    onChange={(e) => setFormData({ ...formData, max_members: parseInt(e.target.value) })}
                    className="w-full px-4 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <p className="mt-1 text-sm text-gray-500">
                    Based on Dunbar's number, communities work best with up to 150 members
                  </p>
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded p-4">
                  <h3 className="font-semibold text-blue-900 mb-2">What happens next?</h3>
                  <ul className="text-sm text-blue-800 space-y-1">
                    <li>✓ You'll be the community admin</li>
                    <li>✓ You can invite other members</li>
                    <li>✓ Members can propose community norms</li>
                    <li>✓ Start helping each other build karma!</li>
                  </ul>
                </div>

                <div className="flex gap-4">
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex-1 px-6 py-3 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-semibold"
                  >
                    {loading ? 'Creating...' : 'Create Community'}
                  </button>
                  <Link
                    href="/communities"
                    className="px-6 py-3 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 font-semibold text-center"
                  >
                    Cancel
                  </Link>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
