/**
 * Sprint 86 / ADR-066 — UnifiedFeed Community view + texture + seam fix (TDD).
 *
 * Covers the new `view="community"` behavior:
 *   - fetches view=community and renders request cards + ActivityCard + StoryCard
 *   - does NOT render the decision band or the browse-mode control (those are Home-only)
 *   - view="home" still renders the decision band (no regression)
 *   - the ADR-067 seam fix: `payload_type` reaches RequestPayloadRenderer (payload detail shows)
 */

import { render, screen } from '@testing-library/react'
import UnifiedFeed from '@/components/Feed/UnifiedFeed'
import type { ActivityData, DecisionData, RequestCardData, UnifiedFeedItem } from '@/types/unified-feed'
import type { StoryData } from '@/types/feed-items'

const getCuratedRequests = jest.fn()

jest.mock('@/lib/api', () => ({
  requestService: {
    getCuratedRequests: (...args: unknown[]) => getCuratedRequests(...args),
    createMatch: jest.fn().mockResolvedValue({}),
    acceptMatch: jest.fn().mockResolvedValue({}),
    rejectMatch: jest.fn().mockResolvedValue({}),
    completeMatch: jest.fn().mockResolvedValue({}),
  },
  dibsService: { acceptDibs: jest.fn(), declineDibs: jest.fn() },
}))
jest.mock('@/lib/api/providerApi', () => ({ acceptOffer: jest.fn(), declineOffer: jest.fn() }))
jest.mock('@/hooks/useTrustPath', () => ({ useTrustPath: () => ({ trustPath: null, loading: false, error: null }) }))

function requestItem(over: Partial<RequestCardData> = {}): UnifiedFeedItem {
  return {
    kind: 'request',
    priority: 1050,
    data: {
      request_id: 'r1', requester_id: 'other', title: 'Ride to the airport', description: 'early flight',
      author_name: 'Dana', community_id: 'c1', community_name: 'Hawthorne', urgency: 'high',
      status: 'open', request_type: 'ride' as any, payload_type: 'transportation',
      payload: {
        pickup_location: { address: '1 A St', city: 'Town', state: 'TX' },
        dropoff_location: { address: 'PDX', city: 'Portland', state: 'OR' },
        passengers: 1, luggage: 'small', return_trip: false,
      } as any,
      requirements: {}, expected_duration: '1h', offers_count: 0, match_score: 42, match_reason: '2nd-degree',
      ...over,
    } as RequestCardData,
  }
}

function activityItem(): UnifiedFeedItem {
  const data: ActivityData = {
    community_id: 'c1', community_name: 'Hawthorne', exchanges_completed_week: 4,
    new_members_count: 2, open_requests_count: 7,
  }
  return { kind: 'activity', priority: 500, data }
}

function storyItem(): UnifiedFeedItem {
  const data: StoryData = { type: 'first_timer', title: 'Priya helped for the first time', description: 'Welcome!', community_name: 'Hawthorne' }
  return { kind: 'story', priority: 100, data }
}

function decisionItem(): UnifiedFeedItem {
  return {
    kind: 'decision',
    priority: 2050,
    data: {
      subject_id: 'm1', subject_kind: 'match', request_id: 'rd', title: 'Decision item',
      community_name: 'Hawthorne', counterparty_name: 'Sam', member_role: 'requester',
      actions: ['accept_offer', 'decline_offer'],
    } as DecisionData,
  }
}

beforeEach(() => {
  getCuratedRequests.mockReset()
  localStorage.setItem('user', JSON.stringify({ id: 'me' }))
})

describe('UnifiedFeed — Community view (Sprint 86)', () => {
  it('fetches view=community and renders request cards + activity + story texture', async () => {
    getCuratedRequests.mockResolvedValue({ data: { items: [requestItem(), activityItem(), storyItem()] } })

    render(<UnifiedFeed view="community" communityId="c1" />)

    // request card
    expect(await screen.findByText('Ride to the airport')).toBeInTheDocument()
    // activity texture (community pulse)
    expect(screen.getByText(/exchange/i)).toBeInTheDocument()
    // story texture
    expect(screen.getByText('Priya helped for the first time')).toBeInTheDocument()
    // requested the community view, scoped to the community
    expect(getCuratedRequests).toHaveBeenCalledWith(expect.objectContaining({ view: 'community', community_id: 'c1' }))
  })

  it('hides the decision band and browse-mode control in the community view', async () => {
    // Even if a decision item slipped through, the community view must not render the band.
    getCuratedRequests.mockResolvedValue({ data: { items: [decisionItem(), requestItem()] } })

    render(<UnifiedFeed view="community" communityId="c1" isOnDuty />)

    await screen.findByText('Ride to the airport')
    expect(screen.queryByText('Needs your response')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Provider' })).toBeNull()
  })

  it('renders payload detail via the seam-fixed payload_type', async () => {
    getCuratedRequests.mockResolvedValue({ data: { items: [requestItem()] } })

    render(<UnifiedFeed view="community" communityId="c1" />)

    await screen.findByText('Ride to the airport')
    // RequestPayloadRenderer (transportation) only renders when payload_type drives it.
    expect(screen.getByText('Pickup')).toBeInTheDocument()
    expect(screen.getByText('Dropoff')).toBeInTheDocument()
  })

  it('still renders the decision band in the home view (no regression)', async () => {
    getCuratedRequests.mockResolvedValue({ data: { items: [decisionItem(), requestItem()] } })

    render(<UnifiedFeed view="home" />)

    expect(await screen.findByText('Needs your response')).toBeInTheDocument()
    expect(getCuratedRequests).toHaveBeenCalledWith(expect.objectContaining({ view: 'home' }))
  })
})
