/**
 * Sprint 106 / BUG-015 — the "Needs your response" DecisionBand is commitment work, not new asks to
 * browse. It must mount at the top of the Helping tab (CommitmentsTab) and be ABSENT from the Browse
 * feed (UnifiedFeed home view).
 */
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import CommitmentsTab from '@/components/CommitmentsTab'
import UnifiedFeed from '@/components/Feed/UnifiedFeed'

const mockGetCuratedRequests = jest.fn()
const mockGetMatches = jest.fn()
const mockGetRequests = jest.fn()
const mockGetPendingDibs = jest.fn()
const mockAcceptMatch = jest.fn().mockResolvedValue({})

jest.mock('@/lib/api', () => ({
  requestService: {
    getCuratedRequests: (...a: any[]) => mockGetCuratedRequests(...a),
    getMatches: (...a: any[]) => mockGetMatches(...a),
    getRequests: (...a: any[]) => mockGetRequests(...a),
    completeMatch: jest.fn(),
    acceptMatch: (...a: any[]) => mockAcceptMatch(...a),
    rejectMatch: jest.fn(),
  },
  dibsService: {
    getPendingDibsForProvider: (...a: any[]) => mockGetPendingDibs(...a),
    acceptDibs: jest.fn(),
    declineDibs: jest.fn(),
  },
  reputationService: { submitFeedback: jest.fn() },
}))
jest.mock('@/lib/api/providerApi', () => ({
  getOffersForRequest: jest.fn().mockResolvedValue({ offers: [] }),
  acceptOffer: jest.fn(),
  declineOffer: jest.fn(),
}))

const decisionItem = {
  kind: 'decision',
  priority: 2050,
  data: {
    subject_id: 'match-1',
    subject_kind: 'match',
    request_id: 'req-1',
    title: 'Bob offered to help with your request',
    community_name: 'Maple Street',
    community_id: 'community-1',
    counterparty_name: 'Bob',
    counterparty_id: 'user-bob',
    member_role: 'requester',
    actions: ['accept_offer', 'decline_offer'],
  },
}

beforeEach(() => {
  jest.clearAllMocks()
  localStorage.setItem('user', JSON.stringify({ id: 'user-me', name: 'Me' }))
  mockGetCuratedRequests.mockResolvedValue({ data: { items: [decisionItem] } })
  mockGetMatches.mockResolvedValue({ data: { matches: [] } })
  mockGetRequests.mockResolvedValue({ data: { requests: [] } })
  mockGetPendingDibs.mockResolvedValue({ data: [] })
})

describe('BUG-015 — DecisionBand placement', () => {
  it('mounts the DecisionBand at the top of the Helping tab', async () => {
    render(<CommitmentsTab communityId="community-1" />)
    expect(await screen.findByText('Needs your response')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Accept' })).toBeInTheDocument()
  })

  it('does NOT render the DecisionBand in the Browse feed', async () => {
    render(<UnifiedFeed view="home" />)
    // Wait for the curated fetch to resolve (empty request list → caught-up state).
    await screen.findByText(/caught up/i)
    expect(screen.queryByText('Needs your response')).not.toBeInTheDocument()
  })

  it('reconciles decisions after a band action so resolved siblings disappear', async () => {
    const sibling = (over: Record<string, any>) => ({
      kind: 'decision',
      priority: 2050,
      data: {
        subject_id: 'm-x',
        subject_kind: 'match',
        request_id: 'same-request',
        title: 'Borrow a tile saw',
        community_name: 'Maple Street',
        community_id: 'community-1',
        counterparty_name: 'Alex',
        counterparty_id: 'user-alex',
        member_role: 'requester',
        actions: ['accept_offer', 'decline_offer'],
        ...over,
      },
    })
    mockGetCuratedRequests
      .mockReset()
      .mockResolvedValueOnce({ data: { items: [sibling({ subject_id: 'm-accept', counterparty_name: 'Alex', counterparty_id: 'a' }), sibling({ subject_id: 'm-sibling', counterparty_name: 'Blair', counterparty_id: 'b' })] } })
      .mockResolvedValue({ data: { items: [] } })

    render(<CommitmentsTab communityId="community-1" />)
    await screen.findByText(/Alex/)
    expect(screen.getByText(/Blair/)).toBeInTheDocument()

    fireEvent.click(screen.getAllByRole('button', { name: 'Accept' })[0])

    await waitFor(() => expect(mockAcceptMatch).toHaveBeenCalledWith('m-accept'))
    await waitFor(() => expect(screen.queryByText(/Blair/)).toBeNull())
  })
})
