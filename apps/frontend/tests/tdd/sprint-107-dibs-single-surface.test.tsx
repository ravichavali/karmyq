/**
 * Sprint 107 / BUG-022 — pending dibs should have one canonical action surface in Helping.
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import CommitmentsTab from '@/components/CommitmentsTab'

const mockGetCuratedRequests = jest.fn()
const mockGetMatches = jest.fn()
const mockGetRequests = jest.fn()
const mockGetPendingDibs = jest.fn()
const mockAcceptDibs = jest.fn()
const mockDeclineDibs = jest.fn()

jest.mock('@/lib/api', () => ({
  requestService: {
    getCuratedRequests: (...a: any[]) => mockGetCuratedRequests(...a),
    getMatches: (...a: any[]) => mockGetMatches(...a),
    getRequests: (...a: any[]) => mockGetRequests(...a),
    getOfferedAwaiting: jest.fn().mockResolvedValue({ data: { count: 0, items: [] } }),
    completeMatch: jest.fn(),
    acceptMatch: jest.fn(),
    rejectMatch: jest.fn(),
  },
  dibsService: {
    getPendingDibsForProvider: (...a: any[]) => mockGetPendingDibs(...a),
    acceptDibs: (...a: any[]) => mockAcceptDibs(...a),
    declineDibs: (...a: any[]) => mockDeclineDibs(...a),
  },
  reputationService: { submitFeedback: jest.fn() },
}))

jest.mock('@/lib/api/providerApi', () => ({
  getOffersForRequest: jest.fn().mockResolvedValue({ offers: [] }),
  acceptOffer: jest.fn(),
  declineOffer: jest.fn(),
}))

const sameDibsTitle = 'Need a Saturday repair visit'

const dibsDecision = {
  kind: 'decision',
  priority: 2100,
  data: {
    subject_id: 'dibs-1',
    subject_kind: 'dibs',
    request_id: 'request-1',
    title: sameDibsTitle,
    community_name: 'Maple Street',
    community_id: 'community-1',
    counterparty_name: 'Rae',
    counterparty_id: 'user-rae',
    member_role: 'responder',
    actions: ['accept_dibs', 'decline_dibs'],
  },
}

beforeEach(() => {
  jest.clearAllMocks()
  localStorage.setItem('user', JSON.stringify({ id: 'provider-user', name: 'Provider' }))
  mockGetCuratedRequests
    .mockResolvedValueOnce({ data: { items: [dibsDecision] } })
    .mockResolvedValue({ data: { items: [] } })
  mockGetMatches.mockResolvedValue({ data: { matches: [] } })
  mockGetRequests.mockResolvedValue({ data: { requests: [] } })
  mockGetPendingDibs.mockResolvedValue({
    data: [
      {
        id: 'dibs-1',
        request_title: sameDibsTitle,
        scheduled_for: '2026-07-04T17:00:00.000Z',
        expires_at: '2026-07-01T17:00:00.000Z',
        requester_name: 'Rae',
      },
    ],
  })
  mockAcceptDibs.mockResolvedValue({})
  mockDeclineDibs.mockResolvedValue({})
})

describe('Sprint 107 / BUG-022 dibs single surface', () => {
  it('renders the same pending dibs once via DecisionBand and removes it after accept', async () => {
    render(<CommitmentsTab communityId="community-1" onDibsLoaded={jest.fn()} />)

    await screen.findByText(sameDibsTitle)

    expect(screen.getAllByText(sameDibsTitle)).toHaveLength(1)
    expect(screen.getAllByRole('button', { name: 'Accept' })).toHaveLength(1)

    fireEvent.click(screen.getByRole('button', { name: 'Accept' }))

    await waitFor(() => expect(mockAcceptDibs).toHaveBeenCalledWith('dibs-1'))
    await waitFor(() => expect(screen.queryByText(sameDibsTitle)).toBeNull())
    expect(mockGetPendingDibs).not.toHaveBeenCalled()
  })
})
