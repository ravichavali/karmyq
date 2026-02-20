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

  // No default type — user must choose
  const [selectedType, setSelectedType] = useState<RequestType | null>(null)

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
    if (selectedType) {
      fetchSchema(selectedType)
    } else {
      setCurrentSchema(null)
    }
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
  }

  // When schema has structured sections, title and description are optional
  const hasStructuredFields = !schemaLoading && currentSchema && currentSchema.sections.length > 0

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

    // For generic (no structured schema), title + description required
    if (!hasStructuredFields) {
      if (!formData.title.trim() || !formData.description.trim()) {
        alert('Please fill in the title and description')
        return
      }
    }

    // Build request data based on type
    const requestData: any = {
      community_id: formData.community_id,
      request_type: selectedType,
      urgency: formData.urgency,
    }

    if (formData.title.trim()) requestData.title = formData.title.trim()
    if (formData.description.trim()) requestData.description = formData.description.trim()

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
          <div className="bg-surface-raised rounded-lg shadow-sm p-8">
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Header */}
              <div className="pb-4 border-b">
                <h1 className="text-2xl font-bold text-text">Create Help Request</h1>
                <p className="text-sm text-text-muted mt-1">
                  Choose what kind of help you need
                </p>
              </div>

              {/* Step 1: Type Selection (always visible, required) */}
              <div>
                <label className="block text-sm font-medium text-text-muted mb-3">
                  What kind of help do you need? <span className="text-red-500">*</span>
                </label>
                <RequestTypeSelector
                  selectedType={selectedType}
                  onSelectType={handleTypeSelect}
                  showExamples={true}
                />
              </div>

              {/* Step 2: Form fields (only shown after type is selected) */}
              {selectedType && (
                <>
                  {/* Community Selection */}
                  <div>
                    <label htmlFor="community" className="block text-sm font-medium text-text-muted mb-2">
                      Community <span className="text-red-500">*</span>
                    </label>
                    <select
                      id="community"
                      name="community_id"
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
                      Choose which community you need help from
                    </p>
                  </div>

                  {/* Server-Driven Dynamic Form (primary for structured types) */}
                  {schemaLoading && (
                    <div className="text-center text-text-subtle py-4">Loading form…</div>
                  )}
                  {hasStructuredFields && (
                    <DynamicForm
                      schema={currentSchema!}
                      value={payload}
                      onChange={setPayload}
                    />
                  )}

                  {/* Title — required for generic, optional for structured */}
                  <div>
                    <label htmlFor="title" className="block text-sm font-medium text-text-muted mb-2">
                      Title {!hasStructuredFields && <span className="text-red-500">*</span>}
                      {hasStructuredFields && <span className="text-text-subtle text-xs ml-1">(optional)</span>}
                    </label>
                    <input
                      type="text"
                      id="title"
                      name="title"
                      value={formData.title}
                      onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                      className="w-full border border-border rounded-lg px-4 py-2 focus:ring-2 focus:ring-primary focus:border-transparent"
                      placeholder={hasStructuredFields ? 'Optional — a short label for this request' : 'Brief description of what you need'}
                      minLength={3}
                      maxLength={200}
                      required={!hasStructuredFields}
                    />
                  </div>

                  {/* Description — required for generic, optional for structured */}
                  <div>
                    <label htmlFor="description" className="block text-sm font-medium text-text-muted mb-2">
                      Description {!hasStructuredFields && <span className="text-red-500">*</span>}
                      {hasStructuredFields && <span className="text-text-subtle text-xs ml-1">(optional)</span>}
                    </label>
                    <textarea
                      id="description"
                      name="description"
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      className="w-full border border-border rounded-lg px-4 py-2 focus:ring-2 focus:ring-primary focus:border-transparent"
                      placeholder={hasStructuredFields ? 'Optional — anything else helpers should know' : 'Provide details about what you need help with…'}
                      rows={hasStructuredFields ? 3 : 6}
                      minLength={hasStructuredFields ? undefined : 10}
                      maxLength={2000}
                      required={!hasStructuredFields}
                    />
                    {!hasStructuredFields && (
                      <p className="text-text-subtle text-sm mt-1">
                        Include any relevant details, timing, location, or specific requirements
                      </p>
                    )}
                  </div>

                  {/* Urgency */}
                  <div>
                    <label htmlFor="urgency" className="block text-sm font-medium text-text-muted mb-2">
                      Urgency
                    </label>
                    <select
                      id="urgency"
                      value={formData.urgency}
                      onChange={(e) => setFormData({ ...formData, urgency: e.target.value as 'low' | 'medium' | 'high' })}
                      className="w-full border border-border rounded-lg px-4 py-2 focus:ring-2 focus:ring-primary focus:border-transparent"
                    >
                      <option value="low">Low - Can wait a week or more</option>
                      <option value="medium">Medium - Needed within a few days</option>
                      <option value="high">High - Needed urgently</option>
                    </select>
                  </div>

                  {/* Submit Button */}
                  <div className="flex gap-4 pt-6 border-t">
                    <button
                      type="submit"
                      disabled={submitting}
                      className="flex-1 bg-primary text-white px-6 py-3 rounded-lg hover:bg-primary-dark transition font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {submitting ? 'Creating Request...' : 'Create Request'}
                    </button>
                    <Link
                      href="/requests"
                      className="flex-1 bg-gray-200 text-text-muted px-6 py-3 rounded-lg hover:bg-gray-300 transition text-center font-semibold"
                    >
                      Cancel
                    </Link>
                  </div>
                </>
              )}

              {/* Prompt when no type selected */}
              {!selectedType && (
                <div className="flex gap-4 pt-4">
                  <Link
                    href="/requests"
                    className="flex-1 bg-gray-200 text-text-muted px-6 py-3 rounded-lg hover:bg-gray-300 transition text-center font-semibold"
                  >
                    Cancel
                  </Link>
                </div>
              )}
            </form>
          </div>
        </div>
      </Layout>
    </>
  )
}
