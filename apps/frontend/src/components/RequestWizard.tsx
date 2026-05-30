/**
 * RequestWizard — Two-step request creation modal.
 *
 * Step 1: Type picker grid (2-col mobile, 3-col desktop)
 * Step 2: DynamicForm + description textarea + urgency chips + community scope
 *
 * Owns all request creation logic extracted from dashboard.
 */
import { useState, useEffect } from 'react'
import { requestService, communityService, dibsService } from '@/lib/api'
import DynamicForm from '@/components/requests/DynamicForm'
import DibsPrompt, { DibsCandidate } from '@/components/requests/DibsPrompt'
import type { UISchema } from '@karmyq/shared/schemas/ui'

type UrgencyLevel = 'normal' | 'urgent' | 'critical'

const DEFAULT_TYPES = [
  { value: 'generic', label: 'General', icon: '🤝' },
  { value: 'ride', label: 'Ride', icon: '🚗' },
  { value: 'service', label: 'Service', icon: '🔧' },
  { value: 'event', label: 'Event', icon: '🎉' },
  { value: 'borrow', label: 'Borrow', icon: '📦' },
]

// Module-level schema cache to avoid redundant fetches
const schemaCache: Record<string, UISchema> = {}

function mapUrgencyToApi(urgency: UrgencyLevel): string {
  if (urgency === 'normal') return 'medium'
  if (urgency === 'urgent') return 'high'
  return urgency
}

interface RequestWizardProps {
  onClose: () => void
  onSuccess?: () => void
  preferredProviderId?: string
  preferredProviderName?: string
  preferredProviderServiceType?: string
}

export default function RequestWizard({
  onClose,
  onSuccess,
  preferredProviderId,
  preferredProviderName,
  preferredProviderServiceType,
}: RequestWizardProps) {
  const [step, setStep] = useState<1 | 2>(preferredProviderServiceType ? 2 : 1)
  const [requestType, setRequestType] = useState<string | null>(preferredProviderServiceType ?? null)
  const [availableTypes, setAvailableTypes] = useState<{ value: string; label: string; icon: string }[]>(DEFAULT_TYPES)
  const [currentSchema, setCurrentSchema] = useState<UISchema | null>(null)
  const [schemaLoading, setSchemaLoading] = useState(false)
  const [dynamicPayload, setDynamicPayload] = useState<Record<string, unknown>>({})
  const [description, setDescription] = useState('')
  const [urgency, setUrgency] = useState<UrgencyLevel>('normal')
  const [communityId, setCommunityId] = useState<string>('')
  const [showCommunitySelect, setShowCommunitySelect] = useState(false)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [userCommunities, setUserCommunities] = useState<any[]>([])
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Sprint 42: Dibs prompt state
  const [dibsCandidate, setDibsCandidate] = useState<DibsCandidate | null>(null)
  const [dibsRequestId, setDibsRequestId] = useState<string>('')
  const [dibsScheduledFor, setDibsScheduledFor] = useState<string>('')
  const [dibsExpiresAt, setDibsExpiresAt] = useState<string>('')

  // On mount: fetch available types + user communities
  useEffect(() => {
    // Augment default types with any custom schemas
    requestService.getSchemas().then((res) => {
      const schemas = res.data?.schemas ?? res.data ?? []
      if (Array.isArray(schemas) && schemas.length > 0) {
        const BUILT_IN = new Set(['generic', 'ride', 'service', 'event', 'borrow'])
        const custom = schemas
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .filter((s: any) => !BUILT_IN.has(s.type))
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .map((s: any) => ({ value: s.type, label: s.label ?? s.type, icon: s.icon ?? '✨' }))
        if (custom.length > 0) {
          setAvailableTypes((prev) => {
            const existing = new Set(prev.map((t) => t.value))
            const deduped = custom.filter((t: { value: string }) => !existing.has(t.value))
            return deduped.length > 0 ? [...prev, ...deduped] : prev
          })
        }
      }
    }).catch(() => { /* silently ignore — built-in types still show */ })

    // Fetch user communities for scope selector
    const userData = typeof window !== 'undefined' ? localStorage.getItem('user') : null
    if (userData) {
      try {
        const parsedUser = JSON.parse(userData)
        communityService.getMyCommunities(parsedUser.id).then((res) => {
          setUserCommunities(res.data?.communities ?? res.data ?? [])
        }).catch(() => {})
      } catch { /* ignore */ }
    }

    // If provider service type is pre-set, kick off schema fetch immediately
    if (preferredProviderServiceType) {
      fetchSchema(preferredProviderServiceType)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const fetchSchema = async (type: string) => {
    if (type === 'generic') {
      setCurrentSchema(null)
      setSchemaLoading(false)
      return
    }
    if (schemaCache[type]) {
      setCurrentSchema(schemaCache[type])
      setSchemaLoading(false)
      return
    }
    try {
      setSchemaLoading(true)
      const response = await requestService.getSchema(type)
      const schema = (response.data?.schema ?? response.data) as UISchema
      if (!schema || !Array.isArray(schema.sections)) {
        setCurrentSchema(null)
        return
      }
      // Normalize: ensure every section has a fields array
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      schema.sections = schema.sections.map((s: any) => ({ ...s, fields: s.fields ?? [] }))
      schemaCache[type] = schema
      setCurrentSchema(schema)
    } catch {
      setCurrentSchema(null)
    } finally {
      setSchemaLoading(false)
    }
  }

  const handleSelectType = (type: string) => {
    setRequestType(type)
    setDynamicPayload({})
    // Prefetch schema immediately so step 2 loads instantly
    fetchSchema(type)
    setStep(2)
  }

  const isValid = !!(requestType && description.trim().length > 0 && !schemaLoading)

  const handleSubmit = async () => {
    if (!isValid || !requestType) return
    try {
      setCreating(true)
      setError(null)
      const payload = {
        request_type: requestType,
        description: description.trim(),
        urgency: mapUrgencyToApi(urgency),
        payload: Object.keys(dynamicPayload).length > 0 ? dynamicPayload : undefined,
        ...(communityId ? { community_id: communityId } : { post_to_all_communities: true }),
        ...(preferredProviderId ? { preferred_provider_id: preferredProviderId } : {}),
      }
      const res = await requestService.createRequest(payload)
      const createdRequest = res.data
      if (createdRequest?.id) {
        try {
          const candidateRes = await dibsService.getDibsCandidate(createdRequest.id, requestType)
          const candidate = candidateRes.data as DibsCandidate | null
          if (candidate) {
            let expiresAt: string
            if (createdRequest.scheduled_for) {
              const scheduledMs = new Date(createdRequest.scheduled_for).getTime()
              const leadTimeMs = scheduledMs - Date.now()
              expiresAt = new Date(Date.now() + leadTimeMs * 0.20).toISOString()
            } else {
              expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
            }
            setDibsRequestId(createdRequest.id)
            setDibsScheduledFor(createdRequest.scheduled_for)
            setDibsExpiresAt(expiresAt)
            setDibsCandidate(candidate)
            // Don't call onSuccess/onClose yet — wait for dibs resolution
            return
          }
        } catch {
          // If dibs-candidate fetch fails, proceed normally — don't block creation
        }
      }
      onSuccess?.()
      onClose()
    } catch (err) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setError((err as any)?.response?.data?.error?.message ?? (err as any)?.response?.data?.message ?? 'Failed to create request. Please try again.')
    } finally {
      setCreating(false)
    }
  }

  const handleDibsSend = async () => {
    if (!dibsCandidate || !dibsRequestId) return
    await dibsService.sendDibs(dibsRequestId, dibsCandidate.providerUserId)
  }

  const handleDibsDone = () => {
    setDibsCandidate(null)
    onSuccess?.()
    onClose()
  }

  // Sprint 42: Show dibs prompt overlay when a candidate is available
  if (dibsCandidate) {
    return (
      <DibsPrompt
        candidate={dibsCandidate}
        requestId={dibsRequestId}
        scheduledFor={dibsScheduledFor}
        expiresAt={dibsExpiresAt}
        onSend={handleDibsSend}
        onSkip={handleDibsDone}
      />
    )
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-[49]"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-0 md:p-4">
        <div className="bg-surface w-full md:max-w-lg md:rounded-2xl rounded-t-2xl shadow-xl flex flex-col max-h-[90vh] overflow-hidden">

          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-border flex-shrink-0">
            <div className="flex items-center gap-3">
              {step === 2 && !preferredProviderServiceType && (
                <button
                  className="btn-ghost px-2 py-1 text-sm"
                  onClick={() => { setStep(1); setRequestType(null); setCurrentSchema(null); setDynamicPayload({}) }}
                >
                  ←
                </button>
              )}
              <h2 className="text-lg font-semibold text-text">
                {step === 1
                  ? 'What kind of help do you need?'
                  : preferredProviderName
                    ? `Request from ${preferredProviderName}`
                    : 'What do you need?'}
              </h2>
            </div>
            <button
              className="btn-ghost p-1.5 rounded-full"
              onClick={onClose}
              aria-label="Close"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Content */}
          <div className="overflow-y-auto flex-1 px-5 py-4">

            {/* Step 1: Type picker */}
            {step === 1 && (
              <div className="wizard-step">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {availableTypes.map((type) => (
                    <button
                      key={type.value}
                      className="type-card"
                      onClick={() => handleSelectType(type.value)}
                    >
                      <span className="text-3xl leading-none">{type.icon}</span>
                      <span className="text-sm font-medium text-text">{type.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Step 2: Form */}
            {step === 2 && (
              <div className="wizard-step">
                {/* If provider type is locked, show locked type card */}
                {preferredProviderServiceType && (
                  <div className="flex items-center gap-3 p-3 bg-primary-light border border-primary rounded-xl text-primary text-sm font-medium">
                    <span className="text-xl">
                      {availableTypes.find((t) => t.value === preferredProviderServiceType)?.icon ?? '🔧'}
                    </span>
                    <span>
                      {availableTypes.find((t) => t.value === preferredProviderServiceType)?.label ?? preferredProviderServiceType}
                    </span>
                  </div>
                )}

                {/* DynamicForm for type-specific fields */}
                {schemaLoading && (
                  <div className="animate-pulse space-y-2">
                    <div className="h-4 bg-border rounded w-1/3" />
                    <div className="h-10 bg-border rounded" />
                  </div>
                )}
                {!schemaLoading && currentSchema && (
                  <DynamicForm
                    schema={currentSchema}
                    value={dynamicPayload}
                    onChange={setDynamicPayload}
                  />
                )}

                {/* Description textarea */}
                <div>
                  <label className="block text-sm font-medium text-text-muted mb-1.5">
                    Description
                  </label>
                  <textarea
                    className="w-full px-3 py-2.5 rounded-lg border border-border bg-surface text-text
                               placeholder:text-text-subtle resize-none focus:outline-none focus:ring-2
                               focus:ring-primary focus:ring-offset-2 focus:border-primary transition-colors"
                    rows={3}
                    placeholder="Describe what you need…"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    autoFocus
                  />
                </div>

                {/* Urgency chips */}
                <div>
                  <label className="block text-sm font-medium text-text-muted mb-1.5">
                    Urgency
                  </label>
                  <div className="flex gap-2">
                    {(['normal', 'urgent', 'critical'] as UrgencyLevel[]).map((level) => (
                      <button
                        key={level}
                        className={`urgency-option ${urgency === level ? 'selected' : ''}`}
                        onClick={() => setUrgency(level)}
                      >
                        {level.charAt(0).toUpperCase() + level.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Community scope */}
                <div>
                  <button
                    className="text-sm text-text-muted hover:text-text transition-colors"
                    onClick={() => setShowCommunitySelect(!showCommunitySelect)}
                  >
                    Post to: {communityId
                      ? (userCommunities.find((c) => c.id === communityId)?.name ?? 'selected community')
                      : 'All communities'
                    } ▾
                  </button>
                  {showCommunitySelect && (
                    <select
                      className="mt-2 w-full px-3 py-2 rounded-lg border border-border bg-surface text-text text-sm
                                 focus:outline-none focus:ring-2 focus:ring-primary"
                      value={communityId}
                      onChange={(e) => setCommunityId(e.target.value)}
                    >
                      <option value="">All communities</option>
                      {userCommunities.map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  )}
                </div>

                {/* Error */}
                {error && (
                  <p className="text-sm text-error bg-error/10 rounded-lg px-3 py-2">{error}</p>
                )}
              </div>
            )}
          </div>

          {/* Footer (step 2 only) */}
          {step === 2 && (
            <div className="px-5 py-4 border-t border-border flex-shrink-0">
              <button
                className="btn-primary w-full"
                disabled={!isValid || creating}
                onClick={handleSubmit}
              >
                {creating ? 'Posting…' : 'Post Request'}
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
