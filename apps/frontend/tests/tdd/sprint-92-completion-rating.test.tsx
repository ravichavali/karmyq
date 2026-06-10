/**
 * Sprint 92 — BUG-005: "Mark as done" unlocks rating consistently.
 *
 * One source of truth: both the Dashboard DecisionBand and the CommitmentsTab fire
 * the rating prompt on the SAME condition — the completeMatch transition to
 * `fully_completed`. A one-sided done must NOT prompt for a rating.
 */

import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

jest.mock('@/lib/api', () => ({
  requestService: {
    getMatches: jest.fn(),
    getRequests: jest.fn(),
    acceptMatch: jest.fn(),
    rejectMatch: jest.fn(),
    completeMatch: jest.fn(),
  },
  dibsService: {
    acceptDibs: jest.fn().mockResolvedValue({}),
    declineDibs: jest.fn().mockResolvedValue({}),
    getPendingDibsForProvider: jest.fn().mockResolvedValue({ data: [] }),
  },
  reputationService: { submitFeedback: jest.fn().mockResolvedValue({}) },
}))
jest.mock('@/lib/api/providerApi', () => ({
  acceptOffer: jest.fn(),
  declineOffer: jest.fn(),
  getOffersForRequest: jest.fn().mockResolvedValue({ offers: [] }),
}))
jest.mock('@/components/EmptyState', () => ({ __esModule: true, default: () => <div /> }))
jest.mock('@/components/ExpandableConversation', () => ({ __esModule: true, default: () => <div /> }))
jest.mock('@/components/TrustCard', () => ({ TrustCard: () => <div /> }))
jest.mock('@/components/commitments/DibsCard', () => ({ __esModule: true, default: () => <div /> }))
jest.mock('../../src/utils/commitmentSort', () => ({ sortByActionPriority: (a: any[]) => a }))

import DecisionBand from '@/components/Feed/DecisionBand'
import type { DecisionData } from '@/types/unified-feed'
const { requestService } = require('@/lib/api')

const markDoneDecision = (): DecisionData => ({
  subject_id: 'm1',
  subject_kind: 'match',
  request_id: 'r1',
  title: 'Help moving boxes',
  community_name: 'Hawthorne',
  counterparty_name: 'Sam',
  counterparty_id: 'sam-id',
  community_id: 'comm-1',
  member_role: 'requester',
  actions: ['mark_done'],
})

describe('BUG-005 DecisionBand: mark done unlocks rating on full completion', () => {
  beforeEach(() => jest.clearAllMocks())

  it('shows the rating prompt when mark_done completes the exchange', async () => {
    ;(requestService.completeMatch as jest.Mock).mockResolvedValue({ data: { fully_completed: true, waiting_for: null } })
    const onResolved = jest.fn()
    render(<DecisionBand decisions={[markDoneDecision()]} onResolved={onResolved} />)

    fireEvent.click(screen.getByRole('button', { name: 'Mark done' }))

    await waitFor(() => expect(screen.getByText(/rate this exchange/i)).toBeInTheDocument())
    // Row is NOT dropped while rating is pending.
    expect(onResolved).not.toHaveBeenCalled()
  })

  it('does NOT show the rating prompt on a one-sided done (drops the row instead)', async () => {
    ;(requestService.completeMatch as jest.Mock).mockResolvedValue({ data: { fully_completed: false, waiting_for: 'helper' } })
    const onResolved = jest.fn()
    render(<DecisionBand decisions={[markDoneDecision()]} onResolved={onResolved} />)

    fireEvent.click(screen.getByRole('button', { name: 'Mark done' }))

    await waitFor(() => expect(onResolved).toHaveBeenCalledWith('m1'))
    expect(screen.queryByText(/rate this exchange/i)).toBeNull()
  })
})

// ── CommitmentsTab gating ──────────────────────────────────────────────────────

const CommitmentsTab = require('@/components/CommitmentsTab').default

const MATCHED_HELPING = {
  id: 'mh1',
  request_id: 'req-1',
  responder_id: 'user-me',
  requester_id: 'user-alice',
  status: 'matched',
  created_at: new Date().toISOString(),
  request_title: 'Need a ride',
  requester_name: 'Alice',
  responder_name: 'Me',
  responder_done_at: null,
}

function setupLocalStorage(userId = 'user-me') {
  Object.defineProperty(window, 'localStorage', {
    value: {
      getItem: (key: string) => (key === 'user' ? JSON.stringify({ id: userId, name: 'Me' }) : null),
      setItem: jest.fn(),
      removeItem: jest.fn(),
    },
    writable: true,
  })
}

describe('BUG-005 CommitmentsTab: rating gated on full completion', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    setupLocalStorage()
    ;(requestService.getMatches as jest.Mock).mockResolvedValue({ data: { matches: [MATCHED_HELPING] } })
    ;(requestService.getRequests as jest.Mock).mockResolvedValue({ data: { requests: [] } })
  })

  it('does NOT show the rating prompt after a one-sided Mark Done', async () => {
    ;(requestService.completeMatch as jest.Mock).mockResolvedValue({ data: { fully_completed: false, waiting_for: 'requester' } })
    render(<CommitmentsTab communityId="comm-1" />)
    await waitFor(() => screen.getByRole('button', { name: /mark done/i }))

    fireEvent.click(screen.getByRole('button', { name: /mark done/i }))

    await waitFor(() => expect(requestService.completeMatch).toHaveBeenCalledWith('mh1'))
    expect(screen.queryByText(/rate this exchange/i)).toBeNull()
  })

  it('shows the rating prompt when Mark Done fully completes the exchange', async () => {
    ;(requestService.completeMatch as jest.Mock).mockResolvedValue({ data: { fully_completed: true, waiting_for: null } })
    render(<CommitmentsTab communityId="comm-1" />)
    await waitFor(() => screen.getByRole('button', { name: /mark done/i }))

    fireEvent.click(screen.getByRole('button', { name: /mark done/i }))

    await waitFor(() => expect(screen.getByText(/rate this exchange/i)).toBeInTheDocument())
  })
})
