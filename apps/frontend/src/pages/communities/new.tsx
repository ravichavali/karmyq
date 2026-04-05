import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import Link from 'next/link'
import { communityService } from '@/lib/api'
import Layout from '@/components/Layout'
import dynamic from 'next/dynamic'

const CommunityConfigEditor = dynamic(() => import('@/components/CommunityConfigEditor'), {
  loading: () => <div className="card p-6 text-center text-text-muted animate-pulse">Loading editor...</div>,
  ssr: false,
})
import CommunityTrustQuestionnaire from '@/components/CommunityTrustQuestionnaire'
import { CommunityConfig, ConfigTemplate } from '@/types/community-config'


const CATEGORIES = [
  'Neighborhood',
  'Professional',
  'Hobby',
  'Faith-based',
  'Educational',
  'Health & Wellness',
  'Environmental',
  'Social Justice',
  'Arts & Culture',
  'Other'
]

type Step = 'basic' | 'questionnaire' | 'config' | 'review'

export default function NewCommunityPage() {
  const router = useRouter()
  const { template: templateId } = router.query

  const [step, setStep] = useState<Step>('basic')
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    location: '',
    category: '',
    max_members: 150,
    access_type: 'public' as 'public' | 'private',
  })
  const [selectedTemplate, setSelectedTemplate] = useState<ConfigTemplate | null>(null)
  // Initialize with default config to allow customization even without template
  const [customConfig, setCustomConfig] = useState<CommunityConfig | null>({
    member_cap: 150,
    visibility_mode: 'public',
    outsider_response_allowed: true,
    enabled_request_types: [
      { name: 'generic', description: 'Any help that doesn\'t fit other categories', karma_multiplier: 1.0 },
      { name: 'ride', description: 'Need a ride to a specific destination', karma_multiplier: 1.2 },
      { name: 'service', description: 'Professional services, repairs, tutoring', karma_multiplier: 1.0 },
      { name: 'event', description: 'Volunteers for community events', karma_multiplier: 1.0 },
      { name: 'borrow', description: 'Temporarily borrow tools or equipment', karma_multiplier: 0.8 },
    ],
    karma_split_helper: 60,
    karma_split_requestor: 40,
    base_karma_pool_per_request: 100,
    karma_decay_half_life_days: 0,
    trust_depth_weight: 0.6,
    trust_breadth_weight: 0.4,
    trust_decay_half_life_days: 180,
    trust_path_max_hops: 3,
    min_interactions_for_trust: 1,
    request_approval_required: false,
    new_member_karma_lockout_days: 0,
    join_approval_required: true,
    joining_counts_as_interaction: true,
  })
  const [configErrors, setConfigErrors] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)
  const [templateLoading, setTemplateLoading] = useState(false)
  const [error, setError] = useState('')

  // Fetch template if specified in URL
  useEffect(() => {
    if (templateId && typeof templateId === 'string') {
      fetchTemplate(templateId)
    }
  }, [templateId])

  const fetchTemplate = async (id: string) => {
    try {
      setTemplateLoading(true)
      const response = await communityService.getConfigTemplates()
      const template = response.data?.find((t: ConfigTemplate) => t.id === id)
      if (template) {
        setSelectedTemplate(template)
        // Initialize custom config from template
        setCustomConfig({
          member_cap: template.member_cap,
          visibility_mode: template.visibility_mode,
          outsider_response_allowed: template.outsider_response_allowed,
          enabled_request_types: template.enabled_request_types,
          karma_split_helper: template.karma_split_helper,
          karma_split_requestor: template.karma_split_requestor,
          base_karma_pool_per_request: template.base_karma_pool_per_request,
          karma_decay_half_life_days: template.karma_decay_half_life_days,
          trust_depth_weight: template.trust_depth_weight,
          trust_breadth_weight: template.trust_breadth_weight,
          trust_decay_half_life_days: template.trust_decay_half_life_days,
          trust_path_max_hops: template.trust_path_max_hops,
          min_interactions_for_trust: template.min_interactions_for_trust,
          request_approval_required: template.request_approval_required,
          new_member_karma_lockout_days: template.new_member_karma_lockout_days,
          join_approval_required: template.join_approval_required,
          joining_counts_as_interaction: template.joining_counts_as_interaction,
        })
        // Set max_members from template
        setFormData(prev => ({ ...prev, max_members: template.member_cap }))
      }
    } catch (err) {
      console.error('Error fetching template', { error: err instanceof Error ? err.message : String(err) })
    } finally {
      setTemplateLoading(false)
    }
  }

  const validateConfig = (config: CommunityConfig): Record<string, string> => {
    const errors: Record<string, string> = {}

    // Trust weights must sum to 1.0
    const weightSum = config.trust_depth_weight + config.trust_breadth_weight
    if (Math.abs(weightSum - 1.0) > 0.01) {
      errors.trust_weights = `Weights sum to ${weightSum.toFixed(2)}, must equal 1.0`
    }

    // Request type names must be unique
    const names = config.enabled_request_types.map(t => t.name)
    if (new Set(names).size !== names.length) {
      errors.request_types = 'Request type names must be unique'
    }

    // Validate request type format
    config.enabled_request_types.forEach((type, index) => {
      if (!/^[a-z_]+$/.test(type.name)) {
        errors[`enabled_request_types[${index}].name`] = 'Use lowercase_underscore format'
      }
    })

    return errors
  }

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
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

    // Validate config if using custom config
    if (customConfig) {
      const errors = validateConfig(customConfig)
      if (Object.keys(errors).length > 0) {
        setConfigErrors(errors)
        setError('Please fix configuration errors before creating')
        return
      }
    }

    try {
      setLoading(true)
      const createData: any = {
        name: formData.name,
        description: formData.description,
        location: formData.location,
        category: formData.category,
        creator_id: user.id,
        max_members: formData.max_members,
        access_type: formData.access_type,
      }

      // Include config if template selected or custom config exists
      if (selectedTemplate) {
        createData.config = {
          template_id: selectedTemplate.id,
          custom_config: customConfig, // Include customizations if any
        }
      } else if (customConfig) {
        createData.config = {
          custom_config: customConfig,
        }
      }

      const response = await communityService.createCommunity(createData)

      // If response includes refreshed token, update localStorage
      // This prevents 403 errors when accessing the new community
      if (response.data.token) {
        localStorage.setItem('token', response.data.token)
      }

      router.push(`/communities/${response.data.community.id}`)
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to create community')
    } finally {
      setLoading(false)
    }
  }

  if (templateLoading) {
    return (
      <Layout title="Create New Community">
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-text-muted">Loading template...</p>
        </div>
      </Layout>
    )
  }

  return (
    <>
      <Head>
        <title>Create Community - Karmyq</title>
      </Head>
      <Layout title="Create New Community">
        <div className="container mx-auto px-4 py-8">
          <div className="max-w-4xl mx-auto">
            {/* Step Indicator */}
            <div className="mb-6">
              <div className="flex items-center justify-center space-x-4">
                <div className={`flex items-center ${step === 'basic' ? 'text-primary' : 'text-text-subtle'}`}>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center font-semibold ${step === 'basic' ? 'bg-primary text-white' : 'bg-gray-200'}`}>
                    1
                  </div>
                  <span className="ml-2 font-medium">Basic Info</span>
                </div>
                <div className="w-12 h-0.5 bg-gray-300"></div>
                <div className={`flex items-center ${step === 'questionnaire' ? 'text-primary' : 'text-text-subtle'}`}>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center font-semibold ${step === 'questionnaire' ? 'bg-primary text-white' : 'bg-gray-200'}`}>
                    2
                  </div>
                  <span className="ml-2 font-medium">Trust Model</span>
                </div>
                <div className="w-12 h-0.5 bg-gray-300"></div>
                <div className={`flex items-center ${step === 'config' ? 'text-primary' : 'text-text-subtle'}`}>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center font-semibold ${step === 'config' ? 'bg-primary text-white' : 'bg-gray-200'}`}>
                    3
                  </div>
                  <span className="ml-2 font-medium">Review & Customize</span>
                </div>
              </div>
            </div>

            {/* Template Info Banner */}
            {selectedTemplate && (
              <div className="bg-primary-light border border-primary-medium rounded-lg p-4 mb-6">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-semibold text-primary-dark">Using Template: {selectedTemplate.name}</h3>
                    <p className="text-sm text-primary-dark mt-1">{selectedTemplate.description}</p>
                  </div>
                  <button
                    onClick={() => {
                      setSelectedTemplate(null)
                      setCustomConfig(null)
                      router.replace('/communities/new', undefined, { shallow: true })
                    }}
                    className="text-primary hover:text-primary-dark text-sm font-medium"
                  >
                    Remove Template
                  </button>
                </div>
              </div>
            )}

            <div className="bg-surface-raised rounded-lg shadow-md p-8">
              {error && (
                <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
                  {error}
                </div>
              )}

              {/* Step 1: Basic Info */}
              {step === 'basic' && (
                <form onSubmit={(e) => {
                  e.preventDefault()
                  // Templates already have values set — skip to config. Otherwise, show questionnaire.
                  setStep(selectedTemplate ? 'config' : 'questionnaire')
                }} className="space-y-6">
                  {!selectedTemplate && (
                    <div className="bg-surface border border-border rounded-lg p-4 mb-6">
                      <p className="text-sm text-text-muted mb-2">
                        Want to start with a pre-configured template?
                      </p>
                      <Link
                        href="/communities/config-templates"
                        className="text-primary hover:text-primary-dark font-medium text-sm"
                      >
                        Browse Configuration Templates →
                      </Link>
                    </div>
                  )}

                  <div>
                    <label htmlFor="name" className="block text-sm font-medium text-text-muted mb-2">
                      Community Name *
                    </label>
                    <input
                      type="text"
                      id="name"
                      name="name"
                      required
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full px-4 py-2 border border-border rounded focus:ring-2 focus:ring-primary focus:border-transparent"
                      placeholder="e.g., Downtown Neighbors"
                    />
                  </div>

                  <div>
                    <label htmlFor="description" className="block text-sm font-medium text-text-muted mb-2">
                      Description
                    </label>
                    <textarea
                      id="description"
                      name="description"
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      className="w-full px-4 py-2 border border-border rounded focus:ring-2 focus:ring-primary focus:border-transparent"
                      rows={4}
                      placeholder="Describe what your community is about..."
                    />
                  </div>

                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="location" className="block text-sm font-medium text-text-muted mb-2">
                        Location
                      </label>
                      <input
                        type="text"
                        id="location"
                        name="location"
                        value={formData.location}
                        onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                        className="w-full px-4 py-2 border border-border rounded focus:ring-2 focus:ring-primary focus:border-transparent"
                        placeholder="e.g., Seattle, WA"
                      />
                    </div>

                    <div>
                      <label htmlFor="category" className="block text-sm font-medium text-text-muted mb-2">
                        Category
                      </label>
                      <select
                        id="category"
                        value={formData.category}
                        onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                        className="w-full px-4 py-2 border border-border rounded focus:ring-2 focus:ring-primary focus:border-transparent"
                      >
                        <option value="">Select a category...</option>
                        {CATEGORIES.map((cat) => (
                          <option key={cat} value={cat}>{cat}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="max_members" className="block text-sm font-medium text-text-muted mb-2">
                        Maximum Members
                      </label>
                      <input
                        type="number"
                        id="max_members"
                        min="1"
                        max="150"
                        value={formData.max_members}
                        onChange={(e) => setFormData({ ...formData, max_members: parseInt(e.target.value) })}
                        disabled={!!selectedTemplate}
                        className="w-full px-4 py-2 border border-border rounded focus:ring-2 focus:ring-primary focus:border-transparent disabled:bg-border-light"
                      />
                      {selectedTemplate && (
                        <p className="mt-1 text-xs text-text-subtle">
                          Set by template (can customize in next step)
                        </p>
                      )}
                    </div>

                    <div>
                      <label htmlFor="access_type" className="block text-sm font-medium text-text-muted mb-2">
                        Access Type
                      </label>
                      <select
                        id="access_type"
                        value={formData.access_type}
                        onChange={(e) => setFormData({ ...formData, access_type: e.target.value as 'public' | 'private' })}
                        className="w-full px-4 py-2 border border-border rounded focus:ring-2 focus:ring-primary focus:border-transparent"
                      >
                        <option value="public">Public</option>
                        <option value="private">Private (invite only)</option>
                      </select>
                    </div>
                  </div>

                  <div className="flex gap-4">
                    <button
                      type="submit"
                      disabled={loading}
                      className="flex-1 px-6 py-3 bg-primary text-white rounded hover:bg-primary-dark disabled:bg-gray-400 font-semibold"
                    >
                      Next: Configure Community Settings
                    </button>
                    <Link
                      href="/communities"
                      className="px-6 py-3 bg-gray-200 text-text-muted rounded hover:bg-gray-300 font-semibold text-center"
                    >
                      Cancel
                    </Link>
                  </div>
                </form>
              )}

              {/* Step 2: Questionnaire */}
              {step === 'questionnaire' && (
                <CommunityTrustQuestionnaire
                  mode="create"
                  onComplete={(inferred) => {
                    setCustomConfig(prev => prev ? { ...prev, ...inferred } : null)
                    setStep('config')
                  }}
                  onBack={() => setStep('basic')}
                />
              )}

              {/* Step 3: Configuration */}
              {step === 'config' && customConfig && (
                <div className="space-y-6">
                  <div>
                    <h2 className="text-xl font-bold text-text mb-2">Review & Customize (Optional)</h2>
                    <p className="text-text-muted mb-4">
                      Your trust model has been pre-configured from your answers. You can fine-tune below
                      or skip straight to creating your community.
                    </p>
                  </div>

                  <CommunityConfigEditor
                    config={customConfig}
                    onChange={setCustomConfig}
                    errors={configErrors}
                  />

                  <div className="flex gap-4 pt-4 border-t">
                    <button
                      onClick={() => setStep(selectedTemplate ? 'basic' : 'questionnaire')}
                      className="px-6 py-3 bg-gray-200 text-text-muted rounded hover:bg-gray-300 font-semibold"
                    >
                      ← Back
                    </button>
                    <button
                      onClick={() => handleSubmit()}
                      disabled={loading}
                      className="px-6 py-3 bg-gray-200 text-text-muted rounded hover:bg-gray-300 font-semibold"
                    >
                      Skip & Create
                    </button>
                    <button
                      onClick={() => handleSubmit()}
                      disabled={loading}
                      className="flex-1 px-6 py-3 bg-primary text-white rounded hover:bg-primary-dark disabled:bg-gray-400 font-semibold"
                    >
                      {loading ? 'Creating Community...' : 'Create Community'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </Layout>
    </>
  )
}
