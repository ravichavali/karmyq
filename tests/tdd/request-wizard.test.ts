// Pure logic extracted from RequestWizard for testability

type UrgencyLevel = 'normal' | 'urgent' | 'critical'
type TabId = 'browse' | 'commitments' | 'my-requests' | 'profile'

// Maps UI urgency to backend value
function mapUrgencyToApi(urgency: UrgencyLevel): string {
  return urgency === 'normal' ? 'medium' : urgency
}

// Determines if form is valid enough to submit
function isFormValid(params: {
  requestType: string | null
  description: string
  schemaLoading: boolean
}): boolean {
  return !!(params.requestType && params.description.trim().length > 0 && !params.schemaLoading)
}

// Which FAB actions are visible for a given tab
function getVisibleActions(tab: TabId): Array<'get-help' | 'get-service'> {
  switch (tab) {
    case 'browse': return ['get-help', 'get-service']
    case 'commitments': return ['get-help']
    case 'my-requests': return ['get-help']
    case 'profile': return []
  }
}

// Builds the API payload for the wizard
function buildWizardPayload(params: {
  requestType: string
  description: string
  urgency: UrgencyLevel
  dynamicPayload: Record<string, unknown>
  communityId?: string
  preferredProviderId?: string
}) {
  return {
    request_type: params.requestType,
    description: params.description.trim(),
    urgency: mapUrgencyToApi(params.urgency),
    payload: params.dynamicPayload,
    ...(params.communityId ? { community_id: params.communityId } : {}),
    ...(params.preferredProviderId ? { preferred_provider_id: params.preferredProviderId } : {}),
  }
}

describe('mapUrgencyToApi', () => {
  it('maps normal → medium', () => expect(mapUrgencyToApi('normal')).toBe('medium'))
  it('maps urgent → urgent', () => expect(mapUrgencyToApi('urgent')).toBe('urgent'))
  it('maps critical → critical', () => expect(mapUrgencyToApi('critical')).toBe('critical'))
})

describe('isFormValid', () => {
  it('returns false when no type selected', () =>
    expect(isFormValid({ requestType: null, description: 'need help', schemaLoading: false })).toBe(false))
  it('returns false when description is empty', () =>
    expect(isFormValid({ requestType: 'generic', description: '   ', schemaLoading: false })).toBe(false))
  it('returns false when schema is loading', () =>
    expect(isFormValid({ requestType: 'generic', description: 'need help', schemaLoading: true })).toBe(false))
  it('returns true when type + description set and schema loaded', () =>
    expect(isFormValid({ requestType: 'generic', description: 'need help', schemaLoading: false })).toBe(true))
})

describe('getVisibleActions', () => {
  it('browse shows both actions', () =>
    expect(getVisibleActions('browse')).toEqual(['get-help', 'get-service']))
  it('commitments shows only get-help', () =>
    expect(getVisibleActions('commitments')).toEqual(['get-help']))
  it('my-requests shows only get-help', () =>
    expect(getVisibleActions('my-requests')).toEqual(['get-help']))
  it('profile shows nothing', () =>
    expect(getVisibleActions('profile')).toEqual([]))
})

describe('buildWizardPayload', () => {
  const base = { requestType: 'generic', description: '  need help  ', urgency: 'normal' as UrgencyLevel, dynamicPayload: {} }
  it('trims description', () =>
    expect(buildWizardPayload(base).description).toBe('need help'))
  it('maps urgency normal → medium', () =>
    expect(buildWizardPayload(base).urgency).toBe('medium'))
  it('omits community_id when not set', () =>
    expect(buildWizardPayload(base)).not.toHaveProperty('community_id'))
  it('includes community_id when set', () =>
    expect(buildWizardPayload({ ...base, communityId: 'c1' }).community_id).toBe('c1'))
  it('includes preferred_provider_id when set', () =>
    expect(buildWizardPayload({ ...base, preferredProviderId: 'p1' }).preferred_provider_id).toBe('p1'))
  it('omits preferred_provider_id when not set', () =>
    expect(buildWizardPayload(base)).not.toHaveProperty('preferred_provider_id'))
})
