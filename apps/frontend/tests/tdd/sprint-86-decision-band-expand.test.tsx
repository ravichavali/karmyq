/**
 * Sprint 86 — DecisionBand inline expand.
 *
 * A "Needs your response" row is clickable to expand in place, revealing the request's description
 * and payload detail (via RequestPayloadRenderer), without leaving the page. Rows with no extra
 * context aren't expandable, and the action buttons keep working.
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import DecisionBand from '@/components/Feed/DecisionBand'
import type { DecisionData } from '@/types/unified-feed'

const acceptMatch = jest.fn().mockResolvedValue({})
jest.mock('@/lib/api', () => ({
  requestService: {
    acceptMatch: (...a: unknown[]) => acceptMatch(...a),
    rejectMatch: jest.fn().mockResolvedValue({}),
    completeMatch: jest.fn().mockResolvedValue({}),
  },
  dibsService: { acceptDibs: jest.fn().mockResolvedValue({}), declineDibs: jest.fn().mockResolvedValue({}) },
}))
jest.mock('@/lib/api/providerApi', () => ({ acceptOffer: jest.fn(), declineOffer: jest.fn() }))

const decision = (over: Partial<DecisionData> = {}): DecisionData => ({
  subject_id: 'm1',
  subject_kind: 'match',
  request_id: 'r1',
  title: 'Ride to the airport',
  community_name: 'Hawthorne',
  counterparty_name: 'Sam',
  member_role: 'requester',
  actions: ['accept_offer', 'decline_offer'],
  description: 'Early Tuesday flight, SE Portland to PDX',
  payload_type: 'transportation',
  payload: {
    pickup_location: { address: '123 SE Main', city: 'Portland', state: 'OR' },
    dropoff_location: { address: 'PDX', city: 'Portland', state: 'OR' },
    passengers: 1,
    luggage: 'small',
    return_trip: false,
  } as any,
  ...over,
})

beforeEach(() => acceptMatch.mockClear())

describe('DecisionBand — inline expand (Sprint 86)', () => {
  it('reveals description + payload detail when the row is clicked, hidden by default', () => {
    render(<DecisionBand decisions={[decision()]} />)

    // collapsed by default
    expect(screen.queryByText('Early Tuesday flight, SE Portland to PDX')).toBeNull()
    expect(screen.queryByText('Pickup')).toBeNull()

    fireEvent.click(screen.getByText('Ride to the airport'))

    // expanded: description + transportation payload detail render in place
    expect(screen.getByText('Early Tuesday flight, SE Portland to PDX')).toBeInTheDocument()
    expect(screen.getByText('Pickup')).toBeInTheDocument()
    expect(screen.getByText('Dropoff')).toBeInTheDocument()
  })

  it('collapses again on a second click', () => {
    render(<DecisionBand decisions={[decision()]} />)
    const row = screen.getByText('Ride to the airport')
    fireEvent.click(row)
    expect(screen.getByText('Pickup')).toBeInTheDocument()
    fireEvent.click(row)
    expect(screen.queryByText('Pickup')).toBeNull()
  })

  it('is not expandable when there is no description or payload', () => {
    render(<DecisionBand decisions={[decision({ description: undefined, payload: undefined, payload_type: undefined })]} />)
    const row = screen.getByText('Ride to the airport')
    expect(row.closest('button')).not.toHaveAttribute('aria-expanded') // canExpand=false → attribute omitted
    fireEvent.click(row)
    expect(screen.queryByText('Pickup')).toBeNull()
  })

  it('action buttons still fire their service call (independent of expand)', async () => {
    render(<DecisionBand decisions={[decision()]} onResolved={jest.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Accept' }))
    await waitFor(() => expect(acceptMatch).toHaveBeenCalledWith('m1'))
  })
})
