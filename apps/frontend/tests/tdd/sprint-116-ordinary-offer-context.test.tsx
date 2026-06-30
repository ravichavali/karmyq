import React from 'react'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import type { RelationshipContext } from '@karmyq/shared'
import MyRequestsTab from '@/components/MyRequestsTab'
import { requestService } from '@/lib/api'

const REQUEST_ID = '99999999-9999-4999-8999-999999999999'
const MATCH_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const REQUESTER_ID = '11111111-1111-4111-8111-111111111111'

jest.mock('@/lib/api', () => ({
  requestService: {
    getRequests: jest.fn(),
    getMatches: jest.fn(),
    getMatchRelationshipContext: jest.fn(),
    acceptMatch: jest.fn(),
    rejectMatch: jest.fn(),
  },
}))

const mocked = requestService as unknown as {
  getRequests: jest.Mock
  getMatches: jest.Mock
  getMatchRelationshipContext: jest.Mock
  acceptMatch: jest.Mock
  rejectMatch: jest.Mock
}

function requesterContext(): RelationshipContext {
  return {
    viewer: { id: REQUESTER_ID, name: 'Maria' },
    counterpart: { id: '44444444-4444-4444-8444-444444444444', name: 'Sam', role: 'member' },
    request: { id: REQUEST_ID, visibilityScope: 'community', reachability: 'same_community' },
    path: {
      scope: 'platform',
      degrees: 2,
      nodes: [
        { id: REQUESTER_ID, name: 'Maria' },
        { id: '22222222-2222-4222-8222-222222222222', name: 'Lee' },
        { id: '44444444-4444-4444-8444-444444444444', name: 'Sam' },
      ],
    },
    networks: { viewer: [], counterpart: [], shared: [], truncated: false },
    links: [],
    summary: 'You and Sam both know Lee.',
  }
}

function seedTab(opts: { contextResolves?: boolean } = {}) {
  localStorage.setItem('user', JSON.stringify({ id: REQUESTER_ID, name: 'Maria' }))
  mocked.getRequests.mockResolvedValue({
    data: { requests: [{ id: REQUEST_ID, title: 'Help moving a couch', status: 'open', created_at: '2026-06-01T00:00:00Z' }] },
  })
  mocked.getMatches.mockResolvedValue({
    data: { matches: [{ id: MATCH_ID, request_id: REQUEST_ID, responder_id: '44444444-4444-4444-8444-444444444444', responder_name: 'Sam', status: 'proposed' }] },
  })
  if (opts.contextResolves === false) {
    mocked.getMatchRelationshipContext.mockRejectedValue({ response: { status: 503 } })
  } else {
    mocked.getMatchRelationshipContext.mockResolvedValue({ data: requesterContext() })
  }
}

beforeEach(() => {
  jest.clearAllMocks()
  localStorage.clear()
})

describe('Sprint 116 — reciprocal context while reviewing an ordinary offer', () => {
  it('shows the match-scoped lens inside an expanded proposed offer, before Accept/Decline', async () => {
    seedTab()
    render(<MyRequestsTab onNewRequest={() => {}} />)

    fireEvent.click(await screen.findByText('Help moving a couch'))

    const summary = await screen.findByText('You and Sam both know Lee.')
    await waitFor(() =>
      expect(mocked.getMatchRelationshipContext).toHaveBeenCalledWith(REQUEST_ID, MATCH_ID)
    )

    const acceptButton = screen.getByRole('button', { name: 'Accept' })
    // The lens must precede the decision controls in document order.
    expect(summary.compareDocumentPosition(acceptButton) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('keeps Accept and Decline enabled when the context call fails', async () => {
    seedTab({ contextResolves: false })
    render(<MyRequestsTab onNewRequest={() => {}} />)

    fireEvent.click(await screen.findByText('Help moving a couch'))

    const acceptButton = await screen.findByRole('button', { name: 'Accept' })
    const declineButton = screen.getByRole('button', { name: 'Decline' })
    await waitFor(() =>
      expect(screen.getByText(/isn’t available right now/i)).toBeInTheDocument()
    )
    expect(acceptButton).toBeEnabled()
    expect(declineButton).toBeEnabled()
  })
})
