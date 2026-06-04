/**
 * Sprint 85 / ADR-066 — UnifiedFeed (Dashboard Home container) tests.
 *
 * Covers the container logic the component tests don't: fetching view=home, partitioning the union
 * into the decision band + request cards, the "you're caught up" end-state, and optimistic removal of
 * a card once the member offers.
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import UnifiedFeed from '@/components/Feed/UnifiedFeed'
import type { DecisionData, RequestCardData, UnifiedFeedItem } from '@/types/unified-feed'

const getCuratedRequests = jest.fn()
const createMatch = jest.fn().mockResolvedValue({})

jest.mock('@/lib/api', () => ({
  requestService: {
    getCuratedRequests: (...args: unknown[]) => getCuratedRequests(...args),
    createMatch: (...args: unknown[]) => createMatch(...args),
    acceptMatch: jest.fn().mockResolvedValue({}),
    rejectMatch: jest.fn().mockResolvedValue({}),
    completeMatch: jest.fn().mockResolvedValue({}),
  },
  dibsService: { acceptDibs: jest.fn(), declineDibs: jest.fn() },
}))
jest.mock('@/lib/api/providerApi', () => ({ acceptOffer: jest.fn(), declineOffer: jest.fn() }))
jest.mock('@/hooks/useTrustPath', () => ({ useTrustPath: () => ({ trustPath: null, loading: false, error: null }) }))

function requestItem(over: Partial<RequestCardData>): UnifiedFeedItem {
  return {
    kind: 'request',
    priority: 1050,
    data: {
      request_id: 'r1', requester_id: 'other', title: 'Plumbing help', description: 'leak',
      author_name: 'Dana', community_id: 'c1', community_name: 'Hawthorne', urgency: 'high',
      status: 'open', request_type: 'service' as any, payload: undefined, requirements: {},
      expected_duration: '30m', offers_count: 0, match_score: 42, match_reason: '2nd-degree trust',
      ...over,
    } as RequestCardData,
  }
}

function decisionItem(over: Partial<DecisionData> = {}): UnifiedFeedItem {
  return {
    kind: 'decision',
    priority: 2050,
    data: {
      subject_id: 'm1', subject_kind: 'match', request_id: 'rd', title: 'Ride to PDX',
      community_name: 'Hawthorne', counterparty_name: 'Sam', member_role: 'requester',
      actions: ['accept_offer', 'decline_offer'], ...over,
    },
  }
}

beforeEach(() => {
  getCuratedRequests.mockReset()
  createMatch.mockClear()
  localStorage.setItem('user', JSON.stringify({ id: 'me' }))
})

describe('UnifiedFeed', () => {
  it('partitions the union: decisions into the band, requests into cards', async () => {
    getCuratedRequests.mockResolvedValue({ data: { items: [decisionItem(), requestItem({ request_id: 'r1', title: 'Plumbing help' })] } })

    render(<UnifiedFeed />)

    expect(await screen.findByText('Needs your response')).toBeInTheDocument()
    expect(screen.getByText('Ride to PDX')).toBeInTheDocument() // decision row
    expect(screen.getByText('Plumbing help')).toBeInTheDocument() // request card
    // fetched the home view
    expect(getCuratedRequests).toHaveBeenCalledWith(expect.objectContaining({ view: 'home' }))
  })

  it('shows the "you\'re caught up" end-state when no fillable requests remain', async () => {
    getCuratedRequests.mockResolvedValue({ data: { items: [decisionItem()] } })

    render(<UnifiedFeed />)

    expect(await screen.findByText(/caught up/i)).toBeInTheDocument()
    // the decision still shows even when there are no request cards
    expect(screen.getByText('Ride to PDX')).toBeInTheDocument()
  })

  it('optimistically removes a card after the member offers to help', async () => {
    getCuratedRequests.mockResolvedValue({
      data: { items: [requestItem({ request_id: 'r1', title: 'Plumbing help' }), requestItem({ request_id: 'r2', title: 'Garden help' })] },
    })

    render(<UnifiedFeed />)
    await screen.findByText('Plumbing help')

    const offerButtons = screen.getAllByRole('button', { name: /offer to help/i })
    fireEvent.click(offerButtons[0])

    await waitFor(() => expect(createMatch).toHaveBeenCalledWith({ request_id: 'r1', responder_id: 'me' }))
    await waitFor(() => expect(screen.queryByText('Plumbing help')).toBeNull())
    expect(screen.getByText('Garden help')).toBeInTheDocument() // the other card stays
  })

  it('renders the error state when the feed fetch fails', async () => {
    getCuratedRequests.mockRejectedValue(new Error('boom'))

    render(<UnifiedFeed />)

    expect(await screen.findByText(/Couldn't load your feed/i)).toBeInTheDocument()
  })
})
