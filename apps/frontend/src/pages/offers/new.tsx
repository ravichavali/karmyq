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

export default function NewOfferPage() {
  const router = useRouter()
  const [communities, setCommunities] = useState<Community[]>([])
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [submitting, setSubmitting] = useState(false)
  const [formData, setFormData] = useState({
    community_id: '',
    title: '',
    description: '',
    type: 'physical_help',
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
      alert('You must be logged in to create an offer')
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
      const response = await requestService.createOffer({
        ...formData,
        offerer_id: currentUser.id,
      })

      alert('Offer created successfully!')
      router.push('/offers')
    } catch (error: any) {
      console.error('Error creating offer:', error)
      alert(error.response?.data?.message || 'Failed to create offer')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <Head>
        <title>Create Help Offer - Karmyq</title>
      </Head>
      <Layout title="Create Help Offer">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="bg-surface-raised rounded-lg shadow-sm p-8">

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Community Selection */}
            <div>
              <label htmlFor="community" className="block text-sm font-medium text-text-muted mb-2">
                Community <span className="text-red-500">*</span>
              </label>
              <select
                id="community"
                value={formData.community_id}
                onChange={(e) => setFormData({ ...formData, community_id: e.target.value })}
                className="w-full border border-border rounded-lg px-4 py-2 focus:ring-2 focus:ring-primary focus:border-transparent"
                required
              >
                <option value="">Select a community...</option>
                {communities.map((community) => (
                  <option key={community.id} value={community.id}>
                    {community.name}
                  </option>
                ))}
              </select>
              <p className="text-text-subtle text-sm mt-1">
                Choose which community you can help
              </p>
            </div>

            {/* Title */}
            <div>
              <label htmlFor="title" className="block text-sm font-medium text-text-muted mb-2">
                Title <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                id="title"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="w-full border border-border rounded-lg px-4 py-2 focus:ring-2 focus:ring-primary focus:border-transparent"
                placeholder="Brief description of what you can help with"
                maxLength={255}
                required
              />
            </div>

            {/* Category */}
            <div>
              <label htmlFor="type" className="block text-sm font-medium text-text-muted mb-2">
                Category <span className="text-red-500">*</span>
              </label>
              <select
                id="type"
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                className="w-full border border-border rounded-lg px-4 py-2 focus:ring-2 focus:ring-primary focus:border-transparent"
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

            {/* Description */}
            <div>
              <label htmlFor="description" className="block text-sm font-medium text-text-muted mb-2">
                Description <span className="text-red-500">*</span>
              </label>
              <textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full border border-border rounded-lg px-4 py-2 focus:ring-2 focus:ring-primary focus:border-transparent"
                placeholder="Provide details about what you can offer..."
                rows={6}
                required
              />
              <p className="text-text-subtle text-sm mt-1">
                Include your skills, availability, any limitations or requirements
              </p>
            </div>

            {/* Submit Button */}
            <div className="flex gap-4 pt-4">
              <button
                type="submit"
                disabled={submitting}
                className="flex-1 bg-primary text-white px-6 py-3 rounded-lg hover:bg-primary-dark transition font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? 'Creating Offer...' : 'Create Offer'}
              </button>
              <Link
                href="/offers"
                className="flex-1 bg-gray-200 text-text-muted px-6 py-3 rounded-lg hover:bg-gray-300 transition text-center font-semibold"
              >
                Cancel
              </Link>
            </div>
          </form>

          {/* Info Box */}
          <div className="mt-8 bg-primary-light border border-primary-medium rounded-lg p-4">
            <h3 className="font-semibold text-primary-dark mb-2">About Help Offers</h3>
            <ul className="text-primary-dark text-sm space-y-1">
              <li>• Offers help you respond to requests more quickly</li>
              <li>• You can link an offer when responding to a request</li>
              <li>• Offers remain active until used or withdrawn</li>
              <li>• You can create multiple offers for different skills</li>
            </ul>
          </div>
          </div>
        </div>
      </Layout>
    </>
  )
}
