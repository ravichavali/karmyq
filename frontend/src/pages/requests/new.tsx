import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import Link from 'next/link'
import { requestService, communityService } from '../../lib/api'
import Layout from '@/components/Layout'

interface Community {
  id: string
  name: string
}

export default function NewRequestPage() {
  const router = useRouter()
  const [communities, setCommunities] = useState<Community[]>([])
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [submitting, setSubmitting] = useState(false)
  const [formData, setFormData] = useState({
    community_id: '',
    title: '',
    description: '',
    type: 'physical_help',
    urgency: 'medium',
  })

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const userStr = localStorage.getItem('user')
      if (userStr) {
        setCurrentUser(JSON.parse(userStr))
      } else {
        router.push('/login')
      }
    }
  }, [])

  useEffect(() => {
    if (currentUser) {
      fetchCommunities()
    }
  }, [currentUser])

  const fetchCommunities = async () => {
    try {
      const response = await communityService.getCommunities({ limit: 100 })
      setCommunities(response.data.data)
    } catch (error) {
      console.error('Error fetching communities:', error)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!currentUser) {
      alert('You must be logged in to create a request')
      return
    }

    if (!formData.community_id) {
      alert('Please select a community')
      return
    }

    if (!formData.title.trim() || !formData.description.trim()) {
      alert('Please fill in all required fields')
      return
    }

    try {
      setSubmitting(true)
      const response = await requestService.createRequest({
        ...formData,
        requester_id: currentUser.id,
      })

      alert('Request created successfully!')
      router.push(`/requests/${response.data.data.id}`)
    } catch (error: any) {
      console.error('Error creating request:', error)
      alert(error.response?.data?.message || 'Failed to create request')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <Head>
        <title>Create Help Request - Karmyq</title>
      </Head>
      <Layout title="Create Help Request">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="bg-white rounded-lg shadow-sm p-8">

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Community Selection */}
            <div>
              <label htmlFor="community" className="block text-sm font-medium text-gray-700 mb-2">
                Community <span className="text-red-500">*</span>
              </label>
              <select
                id="community"
                value={formData.community_id}
                onChange={(e) => setFormData({ ...formData, community_id: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              >
                <option value="">Select a community...</option>
                {communities.map((community) => (
                  <option key={community.id} value={community.id}>
                    {community.name}
                  </option>
                ))}
              </select>
              <p className="text-gray-500 text-sm mt-1">
                Choose which community you need help from
              </p>
            </div>

            {/* Title */}
            <div>
              <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-2">
                Title <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                id="title"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Brief description of what you need"
                maxLength={255}
                required
              />
            </div>

            {/* Category */}
            <div>
              <label htmlFor="type" className="block text-sm font-medium text-gray-700 mb-2">
                Category <span className="text-red-500">*</span>
              </label>
              <select
                id="type"
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              >
                <option value="physical_help">Physical Help</option>
                <option value="skills">Skills & Expertise</option>
                <option value="resources">Resources</option>
                <option value="emotional_support">Emotional Support</option>
                <option value="transportation">Transportation</option>
                <option value="other">Other</option>
              </select>
            </div>

            {/* Urgency */}
            <div>
              <label htmlFor="urgency" className="block text-sm font-medium text-gray-700 mb-2">
                Urgency <span className="text-red-500">*</span>
              </label>
              <select
                id="urgency"
                value={formData.urgency}
                onChange={(e) => setFormData({ ...formData, urgency: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              >
                <option value="low">Low - Can wait a week or more</option>
                <option value="medium">Medium - Needed within a few days</option>
                <option value="high">High - Needed urgently</option>
              </select>
            </div>

            {/* Description */}
            <div>
              <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-2">
                Description <span className="text-red-500">*</span>
              </label>
              <textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Provide details about what you need help with..."
                rows={6}
                required
              />
              <p className="text-gray-500 text-sm mt-1">
                Include any relevant details, timing, location, or specific requirements
              </p>
            </div>

            {/* Submit Button */}
            <div className="flex gap-4 pt-4">
              <button
                type="submit"
                disabled={submitting}
                className="flex-1 bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? 'Creating Request...' : 'Create Request'}
              </button>
              <Link
                href="/requests"
                className="flex-1 bg-gray-200 text-gray-700 px-6 py-3 rounded-lg hover:bg-gray-300 transition text-center font-semibold"
              >
                Cancel
              </Link>
            </div>
          </form>
          </div>
        </div>
      </Layout>
    </>
  )
}
