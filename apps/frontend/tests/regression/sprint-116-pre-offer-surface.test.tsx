import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import type { RelationshipContext } from '@karmyq/shared'
import RequestDetailPage from '@/pages/requests/[id]'
import { requestService } from '@/lib/api'

const REQUEST_ID = '99999999-9999-4999-8999-999999999999'

jest.mock('next/router', () => ({
  useRouter: () => ({
    isReady: true,
    query: { id: '99999999-9999-4999-8999-999999999999' },
    push: jest.fn(),
    replace: jest.fn(),
    prefetch: jest.fn().mockResolvedValue(undefined),
    pathname: '/requests/[id]',
    route: '/requests/[id]',
    asPath: `/requests/99999999-9999-4999-8999-999999999999`,
    events: { on: jest.fn(), off: jest.fn(), emit: jest.fn() },
  }),
}))

jest.mock('@/lib/api', () => ({
  requestService: {
    getRequest: jest.fn(),
    getRequestRelationshipContext: jest.fn(),
    createMatch: jest.fn(),
    rejectMatch: jest.fn(),
  },
}))

const mocked = requestService as unknown as {
  getRequest: jest.Mock
  getRequestRelationshipContext: jest.Mock
  createMatch: jest.Mock
  rejectMatch: jest.Mock
}

function detail(viewerRelation: string) {
  return {
    data: {
      id: REQUEST_ID,
      title: 'Help moving a couch',
      description: 'Saturday afternoon',
      status: 'open',
      request_type: 'generic',
      requester_name: 'Sam',
      viewer_relation: viewerRelation,
    },
  }
}

function memberContext(): RelationshipContext {
  return {
    viewer: { id: '11111111-1111-4111-8111-111111111111', name: 'Maria' },
    counterpart: { id: '44444444-4444-4444-8444-444444444444', name: 'Sam', role: 'member' },
    request: { id: REQUEST_ID, visibilityScope: 'platform', reachability: 'trust_network' },
    path: {
      scope: 'platform',
      degrees: 2,
      nodes: [
        { id: '11111111-1111-4111-8111-111111111111', name: 'Maria' },
        { id: '22222222-2222-4222-8222-222222222222', name: 'Lee' },
        { id: '44444444-4444-4444-8444-444444444444', name: 'Sam' },
      ],
    },
    networks: { viewer: [], counterpart: [], shared: [], truncated: false },
    links: [],
    summary: 'You and Sam both know Lee.',
  }
}

beforeEach(() => {
  jest.clearAllMocks()
})

describe('Sprint 116 — pre-offer relationship surface on /requests/[id]', () => {
  it('shows the request-scoped context only when the viewer can offer', async () => {
    mocked.getRequest.mockResolvedValue(detail('can_offer'))
    mocked.getRequestRelationshipContext.mockResolvedValue({ data: memberContext() })

    render(<RequestDetailPage />)

    expect(await screen.findByText('You and Sam both know Lee.')).toBeInTheDocument()
    expect(mocked.getRequestRelationshipContext).toHaveBeenCalledWith(REQUEST_ID)
  })

  it('does not fetch or show context for the request owner', async () => {
    mocked.getRequest.mockResolvedValue(detail('own_request'))

    render(<RequestDetailPage />)

    expect(await screen.findByText(/This is your ask/i)).toBeInTheDocument()
    expect(mocked.getRequestRelationshipContext).not.toHaveBeenCalled()
  })

  it('does not show context for an already-offered viewer', async () => {
    mocked.getRequest.mockResolvedValue(detail('already_offered'))

    render(<RequestDetailPage />)

    expect(await screen.findByText(/Waiting for the requester/i)).toBeInTheDocument()
    expect(mocked.getRequestRelationshipContext).not.toHaveBeenCalled()
  })

  it('keeps the Offer button enabled when the context call fails', async () => {
    mocked.getRequest.mockResolvedValue(detail('can_offer'))
    mocked.getRequestRelationshipContext.mockRejectedValue({ response: { status: 503 } })

    render(<RequestDetailPage />)

    const offerButton = await screen.findByRole('button', { name: /offer/i })
    await waitFor(() => expect(offerButton).toBeEnabled())
    expect(await screen.findByText(/isn’t available right now/i)).toBeInTheDocument()
  })
})
