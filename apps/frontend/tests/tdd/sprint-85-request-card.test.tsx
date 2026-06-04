/**
 * Sprint 85 — Unified Feed: Dashboard Home (TDD)
 *
 * Task 2: match_score normalizer + canonical status-token mapper (the reconciliations
 * the canonical card depends on). RequestCard + DecisionBand rendering/action tests are
 * appended in Tasks 5 & 6.
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import {
  normalizeMatchScore,
  normalizeStatusToken,
  REQUEST_STATUS_TOKENS,
  URGENCY_LEVELS,
  type RequestCardData,
} from '@/types/unified-feed'
import RequestCard from '@/components/Feed/RequestCard'
import DecisionBand from '@/components/Feed/DecisionBand'
import type { DecisionData } from '@/types/unified-feed'

jest.mock('@/lib/api', () => ({
  requestService: {
    createMatch: jest.fn().mockResolvedValue({}),
    acceptMatch: jest.fn().mockResolvedValue({}),
    rejectMatch: jest.fn().mockResolvedValue({}),
    completeMatch: jest.fn().mockResolvedValue({}),
  },
  dibsService: {
    acceptDibs: jest.fn().mockResolvedValue({}),
    declineDibs: jest.fn().mockResolvedValue({}),
  },
}))
jest.mock('@/lib/api/providerApi', () => ({
  acceptOffer: jest.fn().mockResolvedValue({}),
  declineOffer: jest.fn().mockResolvedValue({}),
}))
jest.mock('@/hooks/useTrustPath', () => ({
  useTrustPath: () => ({ trustPath: null, loading: false, error: null }),
}))

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { requestService, dibsService } = require('@/lib/api') as {
  requestService: { createMatch: jest.Mock; acceptMatch: jest.Mock; rejectMatch: jest.Mock; completeMatch: jest.Mock }
  dibsService: { acceptDibs: jest.Mock; declineDibs: jest.Mock }
}

describe('normalizeMatchScore — one 0–100 integer scale', () => {
  it('scales a 0–1 fraction up to 0–100', () => {
    expect(normalizeMatchScore(0.42)).toBe(42)
    expect(normalizeMatchScore(1)).toBe(100) // 1.0 is the fraction ceiling
  })

  it('passes a value already on the 0–100 scale through (rounded)', () => {
    expect(normalizeMatchScore(42)).toBe(42)
    expect(normalizeMatchScore(87.6)).toBe(88)
  })

  it('maps absent/invalid scores to null (never 0, which is a real score)', () => {
    expect(normalizeMatchScore(undefined)).toBeNull()
    expect(normalizeMatchScore(null)).toBeNull()
    expect(normalizeMatchScore(Number.NaN)).toBeNull()
    expect(normalizeMatchScore(0)).toBe(0)
  })

  it('clamps out-of-range values into 0–100', () => {
    expect(normalizeMatchScore(140)).toBe(100)
    expect(normalizeMatchScore(-5)).toBe(0)
  })
})

describe('normalizeStatusToken — one member-facing status vocabulary', () => {
  it("maps the awaiting-acceptance token 'pending' to the canonical 'proposed'", () => {
    expect(normalizeStatusToken('pending')).toBe('proposed')
  })

  it('passes the canonical help_requests lifecycle tokens through unchanged', () => {
    expect(normalizeStatusToken('open')).toBe('open')
    expect(normalizeStatusToken('matched')).toBe('matched')
    expect(normalizeStatusToken('completed')).toBe('completed')
    expect(normalizeStatusToken('dibs_pending')).toBe('dibs_pending')
    expect(normalizeStatusToken('cancelled')).toBe('cancelled')
    expect(normalizeStatusToken('proposed')).toBe('proposed')
  })

  it('falls back to open for an unknown token', () => {
    expect(normalizeStatusToken('something_else')).toBe('open')
  })

  it('exposes the exact reconciled token set (no stale pending in the canonical set)', () => {
    expect([...REQUEST_STATUS_TOKENS]).toEqual([
      'open',
      'proposed',
      'matched',
      'dibs_pending',
      'completed',
      'cancelled',
    ])
    expect(REQUEST_STATUS_TOKENS).not.toContain('pending')
  })
})

describe('URGENCY_LEVELS — one urgency scale (Sprint 85 / ADR-066)', () => {
  it('is exactly urgent | high | medium | low, top-first, with critical retired', () => {
    expect([...URGENCY_LEVELS]).toEqual(['urgent', 'high', 'medium', 'low'])
    expect(URGENCY_LEVELS).not.toContain('critical')
    expect(URGENCY_LEVELS).not.toContain('normal')
  })
})

// ── RequestCard: the one canonical request card (Task 5) ──

const baseCard: RequestCardData = {
  request_id: 'req-1',
  requester_id: 'requester-9',
  title: 'Need a ride to the airport',
  description: 'Early Tuesday morning, SE Portland to PDX',
  author_name: 'Dana',
  community_id: 'comm-1',
  community_name: 'Hawthorne Mutual Aid',
  urgency: 'high',
  status: 'proposed',
  request_type: 'transportation',
  payload: {
    pickup_location: { address: '123 SE Main', city: 'Portland' },
    dropoff_location: { address: 'PDX', city: 'Portland' },
    passengers: 1,
    luggage: 'small',
    return_trip: false,
  },
  requirements: {},
  expected_duration: '30 min',
  offers_count: 0,
  match_score: 42,
  match_reason: '2nd-degree trust',
  trust_degree: 2,
  requesterKarma: 120,
  requesterTrustScore: 80,
}

describe('RequestCard', () => {
  beforeEach(() => requestService.createMatch.mockClear())

  it('renders the title, requester, community, status token and the polymorphic payload', () => {
    render(<RequestCard data={baseCard} currentUserId="helper-1" />)
    expect(screen.getByText('Need a ride to the airport')).toBeInTheDocument()
    expect(screen.getByText('Dana')).toBeInTheDocument()
    expect(screen.getByText('Hawthorne Mutual Aid')).toBeInTheDocument()
    // canonical member-facing status token (proposed = awaiting acceptance)
    expect(screen.getByText('Awaiting response')).toBeInTheDocument()
    // polymorphic payload renders commitment-legible detail (transportation → Pickup)
    expect(screen.getByText('Pickup')).toBeInTheDocument()
  })

  it('renders the Karma badge and the explainable match score (never a bare percentage)', () => {
    render(<RequestCard data={baseCard} currentUserId="helper-1" />)
    expect(screen.getByText('42% · 2nd-degree trust')).toBeInTheDocument()
    expect(screen.getByText(/120/)).toBeInTheDocument() // Karma badge
  })

  it('wires inline Offer to Help to createMatch with the right request + responder', async () => {
    render(<RequestCard data={baseCard} currentUserId="helper-1" />)
    fireEvent.click(screen.getByRole('button', { name: /offer to help/i }))
    await waitFor(() =>
      expect(requestService.createMatch).toHaveBeenCalledWith({
        request_id: 'req-1',
        responder_id: 'helper-1',
      }),
    )
    // optimistic confirmation steers the helper to the Helping tab
    expect(await screen.findByText(/Offer sent/i)).toBeInTheDocument()
  })

  it('hides Offer to Help on the member’s own request', () => {
    render(<RequestCard data={baseCard} currentUserId="requester-9" />)
    expect(screen.queryByRole('button', { name: /offer to help/i })).toBeNull()
  })
})

// ── DecisionBand: the "needs your response" top band (Task 6) ──

const decision = (over: Partial<DecisionData>): DecisionData => ({
  subject_id: 'subj-1',
  subject_kind: 'match',
  request_id: 'req-1',
  title: 'Ride to PDX',
  community_name: 'Hawthorne',
  counterparty_name: 'Sam',
  member_role: 'requester',
  actions: ['accept_offer', 'decline_offer'],
  ...over,
})

describe('DecisionBand', () => {
  beforeEach(() => {
    requestService.acceptMatch.mockClear()
    requestService.rejectMatch.mockClear()
    requestService.completeMatch.mockClear()
    dibsService.acceptDibs.mockClear()
    dibsService.declineDibs.mockClear()
  })

  it('renders nothing when there are no decisions', () => {
    const { container } = render(<DecisionBand decisions={[]} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('accepts an incoming offer as the requester via acceptMatch(matchId)', async () => {
    render(<DecisionBand decisions={[decision({ subject_id: 'match-7' })]} />)
    fireEvent.click(screen.getByRole('button', { name: 'Accept' }))
    await waitFor(() => expect(requestService.acceptMatch).toHaveBeenCalledWith('match-7'))
  })

  it('declines an incoming offer as the requester via rejectMatch(matchId)', async () => {
    render(<DecisionBand decisions={[decision({ subject_id: 'match-8' })]} />)
    fireEvent.click(screen.getByRole('button', { name: 'Decline' }))
    await waitFor(() => expect(requestService.rejectMatch).toHaveBeenCalledWith('match-8'))
  })

  it('withdraws the member’s OWN offer as the responder via rejectMatch(matchId) — the verify-locked path', async () => {
    render(
      <DecisionBand
        decisions={[decision({ subject_id: 'match-9', member_role: 'responder', actions: ['withdraw_offer'] })]}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Withdraw' }))
    await waitFor(() => expect(requestService.rejectMatch).toHaveBeenCalledWith('match-9'))
  })

  it('accepts/declines a dibs via the dibs service', async () => {
    render(
      <DecisionBand
        decisions={[decision({ subject_id: 'dibs-3', subject_kind: 'dibs', actions: ['accept_dibs', 'decline_dibs'] })]}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Accept' }))
    await waitFor(() => expect(dibsService.acceptDibs).toHaveBeenCalledWith('dibs-3'))
    fireEvent.click(screen.getByRole('button', { name: 'Decline' }))
    await waitFor(() => expect(dibsService.declineDibs).toHaveBeenCalledWith('dibs-3'))
  })

  it('marks a matched exchange done via completeMatch(matchId)', async () => {
    render(
      <DecisionBand decisions={[decision({ subject_id: 'match-10', actions: ['mark_done'], member_role: 'responder' })]} />,
    )
    fireEvent.click(screen.getByRole('button', { name: /mark done/i }))
    await waitFor(() => expect(requestService.completeMatch).toHaveBeenCalledWith('match-10'))
  })

  it('calls onResolved after an action so the container can drop the row', async () => {
    const onResolved = jest.fn()
    render(<DecisionBand decisions={[decision({ subject_id: 'match-11' })]} onResolved={onResolved} />)
    fireEvent.click(screen.getByRole('button', { name: 'Accept' }))
    await waitFor(() => expect(onResolved).toHaveBeenCalledWith('match-11'))
  })
})
