import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import Link from 'next/link'
import { requestService, communityService } from '../../lib/api'
import Layout from '@/components/Layout'
import RequestTypeSelector, { RequestType } from '@/components/requests/RequestTypeSelector'
import DynamicForm from '@/components/requests/DynamicForm'
import type { UISchema } from '@karmyq/shared/schemas/ui'

interface Community {
  id: string
  name: string
}

// In-memory schema cache (per session)
const schemaCache: Record<string, UISchema> = {}

export default function NewRequestPage() {
  const router = useRouter()
  const [communities, setCommunities] = useState<Community[]>([])
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [submitting, setSubmitting] = useState(false)

  // Smart default: Start with generic request (progressive disclosure)
  const [selectedType, setSelectedType] = useState<RequestType>('generic')
  const [showTypeSelector, setShowTypeSelector] = useState(false)

  // UI Schema for the selected type (Server-Driven UI)
  const [currentSchema, setCurrentSchema] = useState<UISchema | null>(null)
  const [schemaLoading, setSchemaLoading] = useState(false)

  // Form data
  const [formData, setFormData] = useState({
    community_id: '',
    title: '',
    description: '',
    urgency: 'medium' as 'low' | 'medium' | 'high',
  })

  const [payload, setPayload] = useState<Record<string, any>>({})

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

  // Fetch UI schema when type changes
  useEffect(() => {
    fetchSchema(selectedType)
  }, [selectedType])

  const fetchCommunities = async () => {
    try {
      const response = await communityService.getCommunities({ limit: 100 })
      setCommunities(response.data.data)
    } catch (error) {
      console.error('Error fetching communities:', error)
    }
  }

  const fetchSchema = async (type: string) => {
    // Check cache first
    if (schemaCache[type]) {
      setCurrentSchema(schemaCache[type])
      return
    }

    try {
      setSchemaLoading(true)
      const response = await requestService.getSchema(type)
      const schema = response.data.data.schema as UISchema
      schemaCache[type] = schema
      setCurrentSchema(schema)
    } catch (error) {
      console.error('Error fetching schema:', error)
      setCurrentSchema(null)
    } finally {
      setSchemaLoading(false)
    }
  }

  const handleTypeSelect = (type: RequestType) => {
    setSelectedType(type)
    setPayload({}) // Reset payload when changing type
    setShowTypeSelector(false) // Close type selector after selection
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

    // Build request data based on type
    const requestData: any = {
      community_id: formData.community_id,
      request_type: selectedType,
      title: formData.title,
      description: formData.description,
      urgency: formData.urgency,
    }

    // Add payload for specialized types (not generic)
    if (selectedType !== 'generic' && Object.keys(payload).length > 0) {
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

  return (
    <>
      <Head>
        <title>Create Help Request - Karmyq</title>
      </Head>
      <Layout title="Create Help Request">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="bg-white rounded-lg shadow-sm p-8">
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Header with current request type */}
              <div className="flex items-center justify-between pb-4 border-b">
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">Create Help Request</h1>
                  <p className="text-sm text-gray-600 mt-1">
                    Request type: <span className="font-medium text-blue-600">
                      {currentSchema?.label || (selectedType === 'generic' ? 'General Help' : selectedType.charAt(0).toUpperCase() + selectedType.slice(1))}
                    </span>
                  </p>
                </div>
              </div>

              {/* Collapsible Type Selector (Progressive Disclosure) */}
              <div className="bg-gray-50 border border-gray-200 rounded-lg">
                <button
                  type="button"
                  onClick={() => setShowTypeSelector(!showTypeSelector)}
                  className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-gray-100 transition rounded-lg"
                >
                  <div className="flex items-center space-x-2">
                    <span className="text-lg">{showTypeSelector ? '▼' : '▶'}</span>
                    <div>
                      <span className="font-medium text-gray-900">Need a specific type?</span>
                      <p className="text-xs text-gray-600 mt-0.5">
                        Ride, Borrow, Service, or Event - most requests work fine as general
                      </p>
                    </div>
                  </div>
                  <span className="text-xs text-gray-500 px-2 py-1 bg-white rounded border border-gray-200">
                    Optional
                  </span>
                </button>

                {showTypeSelector && (
                  <div className="px-4 pb-4 pt-2">
                    <RequestTypeSelector
                      selectedType={selectedType}
                      onSelectType={handleTypeSelect}
                      showExamples={true}
                    />
                  </div>
                )}
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

                {/* Server-Driven Dynamic Form */}
                {schemaLoading && (
                  <div className="border-t pt-6">
                    <div className="text-center text-gray-500 py-4">Loading form...</div>
                  </div>
                )}
                {currentSchema && currentSchema.sections.length > 0 && !schemaLoading && (
                  <div className="border-t pt-6">
                    <DynamicForm
                      schema={currentSchema}
                      value={payload}
                      onChange={setPayload}
                    />
                  </div>
                )}

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
          </div>
        </div>
      </Layout>
    </>
  )
}
