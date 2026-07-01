/**
 * Sprint 101 — /requests/[id] is the canonical viewer-aware action surface.
 *
 * The page previously redirected to the dashboard, so a community open-ask click never showed the
 * ask or the action available. It now reads `viewer_relation` (derived server-side) and renders the
 * one true next step for that member, in that state:
 *   can_offer       → Offer to Help (createMatch), then "offer sent" affordance
 *   already_offered → "waiting for the requester" + Helping link, no Offer button
 *   own_request     → "This is your ask" + Asks link, no Offer button
 *   not_actionable  → finite-state copy (e.g. completed), no fake action
 *
 * useRouter is mocked locally here (custom query.id + replace spy) to prove the page reads the id and
 * no longer redirects — this is the documented exception to the global jest.setup router mock.
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react'

const replace = jest.fn()
jest.mock('next/router', () => ({
  useRouter: () => ({ query: { id: 'r1' }, replace, push: jest.fn(), isReady: true }),
}))

const getRequest = jest.fn()
const createMatch = jest.fn()
const rejectMatch = jest.fn()
jest.mock('@/lib/api', () => ({
  requestService: {
    getRequest: (...args: unknown[]) => getRequest(...args),
    createMatch: (...args: unknown[]) => createMatch(...args),
    rejectMatch: (...args: unknown[]) => rejectMatch(...args),
    // S116: the can_offer detail now mounts a relationship-context panel; suppress it here (404).
    getRequestRelationshipContext: () => Promise.reject({ response: { status: 404 } }),
  },
}))
jest.mock('@/hooks/useTrustPath', () => ({ useTrustPath: () => ({ trustPath: null, loading: false, error: null }) }))

import RequestDetailPage from '@/pages/requests/[id]'

function detail(overrides: Record<string, unknown> = {}) {
  return {
    id: 'r1',
    requester_id: 'someone-else',
    title: 'Hang a ceiling fan',
    description: 'Need a hand mounting a fan.',
    status: 'open',
    expired: false,
    urgency: 'medium',
    request_type: 'generic',
    requester_name: 'Maria Reyes',
    community_name: 'North Portland',
    payload: {},
    requirements: {},
    viewer_relation: 'can_offer',
    viewer_match: null,
    ...overrides,
  }
}

beforeEach(() => {
  localStorage.clear()
  replace.mockClear()
  getRequest.mockReset()
  createMatch.mockReset()
  rejectMatch.mockReset()
})

describe('Sprint 101: actionable request detail page', () => {
  it('offers help when viewer_relation is can_offer (no client identity needed — server derives it)', async () => {
    // Deliberately NO localStorage.user — the offer must still fire (server derives responder via JWT).
    getRequest.mockResolvedValue({ data: detail({ viewer_relation: 'can_offer' }) })
    createMatch.mockResolvedValue({})

    render(<RequestDetailPage />)
    fireEvent.click(await screen.findByRole('button', { name: /Offer to Help/i }))

    await waitFor(() => expect(createMatch).toHaveBeenCalledWith({ request_id: 'r1' }))
    expect(replace).not.toHaveBeenCalledWith('/dashboard?tab=helping')
  })

  it('shows awaiting requester response when viewer already offered', async () => {
    getRequest.mockResolvedValue({ data: detail({ viewer_relation: 'already_offered', viewer_match: { id: 'm1', status: 'proposed' } }) })
    render(<RequestDetailPage />)
    expect(await screen.findByText(/waiting for the requester/i)).toBeInTheDocument()
    // No "offer to help" / "offer service" CTA — only the calm Withdraw offer affordance (S108).
    expect(screen.queryByRole('button', { name: /Offer to Help|Offer service/i })).not.toBeInTheDocument()
  })

  it('S108: lets the viewer withdraw a pending self-offer via rejectMatch', async () => {
    getRequest.mockResolvedValue({ data: detail({ viewer_relation: 'already_offered', viewer_match: { id: 'm1', status: 'proposed' } }) })
    rejectMatch.mockResolvedValue({})
    render(<RequestDetailPage />)
    fireEvent.click(await screen.findByRole('button', { name: /withdraw offer/i }))
    await waitFor(() => expect(rejectMatch).toHaveBeenCalledWith('m1'))
    expect(await screen.findByText(/offer withdrawn/i)).toBeInTheDocument()
  })

  it('S108: does NOT offer withdraw once the offer is accepted (match no longer proposed)', async () => {
    getRequest.mockResolvedValue({ data: detail({ viewer_relation: 'already_offered', viewer_match: { id: 'm1', status: 'matched' } }) })
    render(<RequestDetailPage />)
    expect(await screen.findByText(/waiting for the requester/i)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /withdraw/i })).not.toBeInTheDocument()
  })

  it('points own requests to Asks without showing Offer', async () => {
    localStorage.setItem('user', JSON.stringify({ id: 'me' }))
    getRequest.mockResolvedValue({ data: detail({ requester_id: 'me', viewer_relation: 'own_request' }) })
    render(<RequestDetailPage />)
    expect(await screen.findByText(/This is your ask/i)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Offer/i })).not.toBeInTheDocument()
  })

  it('renders completed requests as a finite state', async () => {
    getRequest.mockResolvedValue({ data: detail({ status: 'completed', viewer_relation: 'not_actionable' }) })
    render(<RequestDetailPage />)
    expect(await screen.findByText(/This ask is completed/i)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Offer/i })).not.toBeInTheDocument()
  })

  it('labels a service request action "Offer service" but uses the same createMatch mutation', async () => {
    getRequest.mockResolvedValue({ data: detail({ request_type: 'service', viewer_relation: 'can_offer' }) })
    createMatch.mockResolvedValue({})

    render(<RequestDetailPage />)
    fireEvent.click(await screen.findByRole('button', { name: /Offer service/i }))
    await waitFor(() => expect(createMatch).toHaveBeenCalledWith({ request_id: 'r1' }))
  })

  it('does not redirect to the dashboard anymore', async () => {
    getRequest.mockResolvedValue({ data: detail() })
    render(<RequestDetailPage />)
    await screen.findByText(/Hang a ceiling fan/i)
    expect(replace).not.toHaveBeenCalled()
  })
})
