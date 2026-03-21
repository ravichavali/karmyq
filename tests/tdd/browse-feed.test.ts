// tests/tdd/browse-feed.test.ts
/**
 * Pure-logic tests for BrowseFeed filter behavior.
 * Extracts filter logic from BrowseFeed component.
 */

type RequestTypeFilter = 'all' | 'generic' | 'ride' | 'service' | 'event' | 'borrow'
type UrgencyFilter = 'all' | 'urgent' | 'high' | 'medium' | 'low'

interface HelpRequest {
  id: string
  requester_id: string
  request_type?: string
  urgency?: string
  status: string
}

function filterRequests(
  requests: HelpRequest[],
  currentUserId: string,
  activeType: RequestTypeFilter,
  activeUrgency: UrgencyFilter
): HelpRequest[] {
  return requests.filter((r) => {
    if (r.requester_id === currentUserId) return false
    if (r.status !== 'open') return false
    const typeMatch = activeType === 'all' || r.request_type === activeType
    const urgencyMatch = activeUrgency === 'all' || r.urgency === activeUrgency
    return typeMatch && urgencyMatch
  })
}

const SAMPLE_REQUESTS: HelpRequest[] = [
  { id: '1', requester_id: 'user-a', request_type: 'ride', urgency: 'urgent', status: 'open' },
  { id: '2', requester_id: 'user-b', request_type: 'service', urgency: 'medium', status: 'open' },
  { id: '3', requester_id: 'user-c', request_type: 'generic', urgency: 'low', status: 'open' },
  { id: '4', requester_id: 'me', request_type: 'ride', urgency: 'high', status: 'open' },
  { id: '5', requester_id: 'user-d', request_type: 'borrow', urgency: 'medium', status: 'matched' },
]

const ME = 'me'

describe('BrowseFeed filter behavior', () => {
  it('shows all open requests from other users when type is "all"', () => {
    const result = filterRequests(SAMPLE_REQUESTS, ME, 'all', 'all')
    expect(result).toHaveLength(3)
    expect(result.map((r) => r.id)).toEqual(['1', '2', '3'])
  })

  it('filters to ride requests when type is "ride"', () => {
    const result = filterRequests(SAMPLE_REQUESTS, ME, 'ride', 'all')
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('1')
  })

  it('filters by urgency', () => {
    const result = filterRequests(SAMPLE_REQUESTS, ME, 'all', 'urgent')
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('1')
  })

  it('combines type and urgency filters', () => {
    const result = filterRequests(SAMPLE_REQUESTS, ME, 'service', 'medium')
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('2')
  })

  it('shows empty result when no requests match filter', () => {
    const result = filterRequests(SAMPLE_REQUESTS, ME, 'event', 'all')
    expect(result).toHaveLength(0)
  })

  it('does not show current user\'s own requests', () => {
    const result = filterRequests(SAMPLE_REQUESTS, ME, 'ride', 'all')
    const myRequest = result.find((r) => r.requester_id === ME)
    expect(myRequest).toBeUndefined()
  })

  it('does not show non-open requests', () => {
    const result = filterRequests(SAMPLE_REQUESTS, ME, 'borrow', 'all')
    expect(result).toHaveLength(0) // request 5 is matched, not open
  })
})

describe('urgency filter row visibility', () => {
  it('hides urgency row when both filters are "all"', () => {
    const shouldShow = (activeType: RequestTypeFilter, activeUrgency: UrgencyFilter) =>
      activeUrgency !== 'all' || activeType !== 'all'

    expect(shouldShow('all', 'all')).toBe(false)
    expect(shouldShow('ride', 'all')).toBe(true)
    expect(shouldShow('all', 'urgent')).toBe(true)
  })
})
