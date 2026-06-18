/**
 * Sprint 106 / BUG-013 — DecisionBand must render a first-class `rate` action for a durable
 * `rate` decision (one the decisions feed surfaces for both parties of a fully-completed, unrated
 * match), and submit the rating to the correct counterparty/community. A decision that only owes a
 * one-sided `mark_done` must NOT prompt rating.
 */
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import DecisionBand from '@/components/Feed/DecisionBand'
import type { DecisionData } from '@/types/unified-feed'

const mockSubmitFeedback = jest.fn().mockResolvedValue({ data: { score: 4 } })

jest.mock('@/lib/api', () => ({
  requestService: { acceptMatch: jest.fn(), rejectMatch: jest.fn(), completeMatch: jest.fn() },
  dibsService: { acceptDibs: jest.fn(), declineDibs: jest.fn() },
  reputationService: { submitFeedback: (...a: any[]) => mockSubmitFeedback(...a) },
}))
jest.mock('@/lib/api/providerApi', () => ({ acceptOffer: jest.fn(), declineOffer: jest.fn() }))

const rateDecision: DecisionData = {
  subject_id: 'match-done-1',
  subject_kind: 'match',
  request_id: 'req-1',
  title: 'Fix the leaky tap',
  community_name: 'Maple Street',
  community_id: 'community-1',
  counterparty_name: 'Alice',
  counterparty_id: 'user-requester',
  member_role: 'responder',
  actions: ['rate'],
}

const markDoneDecision: DecisionData = {
  subject_id: 'match-open-1',
  subject_kind: 'match',
  request_id: 'req-2',
  title: 'Walk the dog',
  community_name: 'Maple Street',
  community_id: 'community-1',
  counterparty_name: 'Carol',
  counterparty_id: 'user-other',
  member_role: 'responder',
  actions: ['mark_done'],
}

describe('DecisionBand — BUG-013 rate action', () => {
  beforeEach(() => jest.clearAllMocks())

  it('renders a first-class Rate action for a rate decision', () => {
    render(<DecisionBand decisions={[rateDecision]} />)
    expect(screen.getByRole('button', { name: /rate/i })).toBeInTheDocument()
    // The rating prompt is not shown until the member chooses to rate.
    expect(screen.queryByText(/rate this exchange/i)).not.toBeInTheDocument()
  })

  it('opens the rating prompt and submits to the counterparty + community', async () => {
    render(<DecisionBand decisions={[rateDecision]} />)
    fireEvent.click(screen.getByRole('button', { name: /rate/i }))

    expect(screen.getByText(/rate this exchange/i)).toBeInTheDocument()
    // Click the 4th star.
    const stars = screen.getAllByRole('button').filter((b) => /[★☆]/.test(b.textContent || ''))
    fireEvent.click(stars[3])

    await waitFor(() => expect(mockSubmitFeedback).toHaveBeenCalledTimes(1))
    expect(mockSubmitFeedback).toHaveBeenCalledWith({
      match_id: 'match-done-1',
      to_user_id: 'user-requester',
      community_id: 'community-1',
      rating: 4,
    })
  })

  it('does NOT prompt rating for a one-sided mark_done decision', () => {
    render(<DecisionBand decisions={[markDoneDecision]} />)
    expect(screen.getByRole('button', { name: /mark done/i })).toBeInTheDocument()
    expect(screen.queryByText(/rate this exchange/i)).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^rate$/i })).not.toBeInTheDocument()
  })
})
