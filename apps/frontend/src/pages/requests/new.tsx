import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import Link from 'next/link'
import { requestService, communityService } from '../../lib/api'
import Layout from '@/components/Layout'
import RequestTypeSelector, { RequestType } from '@/components/requests/RequestTypeSelector'
import RideRequestForm, { RideRequestPayload } from '@/components/requests/RideRequestForm'
import ServiceRequestForm, { ServiceRequestPayload } from '@/components/requests/ServiceRequestForm'
import EventRequestForm, { EventRequestPayload } from '@/components/requests/EventRequestForm'
import BorrowRequestForm, { BorrowRequestPayload } from '@/components/requests/BorrowRequestForm'
import GenericRequestForm from '@/components/requests/GenericRequestForm'

interface Community {
  id: string
  name: string
}

type RequestPayload =
  | RideRequestPayload
  | ServiceRequestPayload
  | EventRequestPayload
  | BorrowRequestPayload
  | {}

export default function NewRequestPage() {
  const router = useRouter()
  const [communities, setCommunities] = useState<Community[]>([])
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [submitting, setSubmitting] = useState(false)

  // Step 1: Type selection
  const [selectedType, setSelectedType] = useState<RequestType | null>(null)

  // Step 2: Form data
  const [formData, setFormData] = useState({
    community_id: '',
    title: '',
    description: '',
    urgency: 'medium' as 'low' | 'medium' | 'high',
  })

  const [payload, setPayload] = useState<Partial<RequestPayload>>({})

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

  const handleTypeSelect = (type: RequestType) => {
    setSelectedType(type)
    setPayload({}) // Reset payload when changing type
  }

  const handlePayloadChange = (newPayload: Partial<RequestPayload>) => {
    setPayload(newPayload)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!currentUser) {
      alert('You must be logged in to create a request')
      return
    }

    if (!selectedType) {
      alert('Please select a request type')
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

    // Build request data based on type
    const requestData: any = {
      community_id: formData.community_id,
      request_type: selectedType,
      title: formData.title,
      description: formData.description,
      urgency: formData.urgency,
    }

    // Add payload for specialized types (not generic)
    if (selectedType !== 'generic') {
      requestData.payload = payload
    }

    try {
      setSubmitting(true)
      const response = await requestService.createRequest(requestData)

      alert('Request created successfully!')
      router.push(`/requests/${response.data.data.id}`)
    } catch (error: any) {
      console.error('Error creating request:', error)
      const errorMessage = error.response?.data?.message || 'Failed to create request'
      const validationErrors = error.response?.data?.errors

      if (validationErrors) {
        console.error('Validation errors:', validationErrors)
        alert(`Validation failed: ${JSON.stringify(validationErrors, null, 2)}`)
      } else {
        alert(errorMessage)
      }
    } finally {
      setSubmitting(false)
    }
  }

  const canProceed = selectedType !== null
  const showTypeSelector = !selectedType

  return (
    <>
      <Head>
        <title>Create Help Request - Karmyq</title>
      </Head>
      <Layout title="Create Help Request">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="bg-white rounded-lg shadow-sm p-8">
            {/* Progress Indicator */}
            <div className="mb-8">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center space-x-2">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${selectedType ? 'bg-blue-500 text-white' : 'bg-blue-100 text-blue-600'}`}>
                    1
                  </div>
                  <span className={`text-sm font-medium ${selectedType ? 'text-gray-900' : 'text-blue-600'}`}>
                    Select Type
                  </span>
                </div>
                <div className="flex-1 h-1 mx-4 bg-gray-200">
                  <div className={`h-full transition-all duration-300 ${selectedType ? 'bg-blue-500 w-full' : 'bg-blue-200 w-0'}`} />
                </div>
                <div className="flex items-center space-x-2">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${selectedType ? 'bg-blue-100 text-blue-600' : 'bg-gray-200 text-gray-400'}`}>
                    2
                  </div>
                  <span className={`text-sm font-medium ${selectedType ? 'text-blue-600' : 'text-gray-400'}`}>
                    Fill Details
                  </span>
                </div>
              </div>
            </div>

            {/* Step 1: Type Selection */}
            {showTypeSelector && (
              <RequestTypeSelector
                selectedType={selectedType}
                onSelectType={handleTypeSelect}
              />
            )}

            {/* Step 2: Form Details */}
            {canProceed && (
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Back Button */}
                <div className="flex items-center justify-between pb-4 border-b">
                  <button
                    type="button"
                    onClick={() => setSelectedType(null)}
                    className="flex items-center space-x-2 text-blue-600 hover:text-blue-700 transition"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                    <span>Change Request Type</span>
                  </button>
                </div>

                {/* Community Selection */}
                <div>
                  <label htmlFor="community" className="block text-sm font-medium text-gray-700 mb-2">
                    Community <span className="text-red-500">*</span>
                  </label>
                  <select
                    id="community"
                    name="community_id"
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
                    name="title"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Brief description of what you need"
                    minLength={3}
                    maxLength={200}
                    required
                  />
                </div>

                {/* Description */}
                <div>
                  <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-2">
                    Description <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    id="description"
                    name="description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Provide details about what you need help with..."
                    rows={6}
                    minLength={10}
                    maxLength={2000}
                    required
                  />
                  <p className="text-gray-500 text-sm mt-1">
                    Include any relevant details, timing, location, or specific requirements
                  </p>
                </div>

                {/* Urgency */}
                <div>
                  <label htmlFor="urgency" className="block text-sm font-medium text-gray-700 mb-2">
                    Urgency
                  </label>
                  <select
                    id="urgency"
                    value={formData.urgency}
                    onChange={(e) => setFormData({ ...formData, urgency: e.target.value as 'low' | 'medium' | 'high' })}
                    className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="low">Low - Can wait a week or more</option>
                    <option value="medium">Medium - Needed within a few days</option>
                    <option value="high">High - Needed urgently</option>
                  </select>
                </div>

                {/* Type-Specific Form */}
                <div className="border-t pt-6">
                  {selectedType === 'ride' && (
                    <RideRequestForm
                      initialData={payload as Partial<RideRequestPayload>}
                      onChange={handlePayloadChange}
                    />
                  )}
                  {selectedType === 'service' && (
                    <ServiceRequestForm
                      initialData={payload as Partial<ServiceRequestPayload>}
                      onChange={handlePayloadChange}
                    />
                  )}
                  {selectedType === 'event' && (
                    <EventRequestForm
                      initialData={payload as Partial<EventRequestPayload>}
                      onChange={handlePayloadChange}
                    />
                  )}
                  {selectedType === 'borrow' && (
                    <BorrowRequestForm
                      initialData={payload as Partial<BorrowRequestPayload>}
                      onChange={handlePayloadChange}
                    />
                  )}
                  {selectedType === 'generic' && (
                    <GenericRequestForm
                      onChange={handlePayloadChange}
                    />
                  )}
                </div>

                {/* Submit Button */}
                <div className="flex gap-4 pt-6 border-t">
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
            )}
          </div>
        </div>
      </Layout>
    </>
  )
}
