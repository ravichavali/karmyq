/**
 * Sprint 100 / F4 + F5 — the request card is clickable, and the Offer action still works.
 *
 * F4: tapping the card body opens `/requests/[id]`; the Offer button stops propagation so it sends
 *     the offer WITHOUT also navigating.
 * F5: the colored-initial avatar is labelled "Asked by {name}" so it isn't unexplained.
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import RequestCard from '@/components/Feed/RequestCard'
import type { RequestCardData } from '@/types/unified-feed'

const push = jest.fn()
const createMatch = jest.fn().mockResolvedValue({})

jest.mock('next/router', () => ({ useRouter: () => ({ push }) }))
jest.mock('@/lib/api', () => ({
  requestService: { createMatch: (...args: unknown[]) => createMatch(...args) },
}))
jest.mock('@/hooks/useTrustPath', () => ({ useTrustPath: () => ({ trustPath: null, loading: false, error: null }) }))

const data: RequestCardData = {
  request_id: 'r1', requester_id: 'other-user', title: 'Ride to the airport', description: 'early flight',
  author_name: 'Dana', community_id: 'c1', community_name: 'Hawthorne', urgency: 'high',
  status: 'open', request_type: 'generic' as any, payload: {} as any, requirements: {} as any,
} as RequestCardData

describe('Sprint 100: clickable request card (F4) + labelled avatar (F5)', () => {
  beforeEach(() => {
    push.mockClear()
    createMatch.mockClear()
  })

  it('navigates to the request detail when the card body is clicked', () => {
    render(<RequestCard data={data} currentUserId="me" />)
    fireEvent.click(screen.getByRole('link', { name: /Open request: Ride to the airport/i }))
    expect(push).toHaveBeenCalledWith('/requests/r1')
  })

  it('sends the offer WITHOUT navigating when the Offer button is clicked (stopPropagation)', async () => {
    render(<RequestCard data={data} currentUserId="me" />)
    fireEvent.click(screen.getByRole('button', { name: /Offer to Help/i }))

    await waitFor(() => expect(createMatch).toHaveBeenCalledWith({ request_id: 'r1', responder_id: 'me' }))
    expect(push).not.toHaveBeenCalled()
  })

  it('labels the asker avatar so it is not unexplained (F5)', () => {
    render(<RequestCard data={data} currentUserId="me" />)
    expect(screen.getByLabelText('Asked by Dana')).toBeInTheDocument()
  })

  it('renders no Offer action in readOnly mode but is still clickable', () => {
    render(<RequestCard data={data} currentUserId="me" readOnly />)
    expect(screen.queryByRole('button', { name: /Offer to Help/i })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('link', { name: /Open request/i }))
    expect(push).toHaveBeenCalledWith('/requests/r1')
  })
})
