import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import type { RelationshipContext } from '@karmyq/shared'
import RelationshipContextPanel from '@/components/relationships/RelationshipContextPanel'
import { requestService } from '@/lib/api'

jest.mock('@/lib/api', () => ({
  requestService: {
    getRequestRelationshipContext: jest.fn(),
    getMatchRelationshipContext: jest.fn(),
    getProviderOfferRelationshipContext: jest.fn(),
  },
}))

const mocked = requestService as unknown as {
  getRequestRelationshipContext: jest.Mock
  getMatchRelationshipContext: jest.Mock
  getProviderOfferRelationshipContext: jest.Mock
}

const IDS = {
  viewer: '11111111-1111-4111-8111-111111111111',
  bridge: '22222222-2222-4222-8222-222222222222',
  counterpart: '44444444-4444-4444-8444-444444444444',
  shared: '77777777-7777-4777-8777-777777777777',
  oak: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  request: '99999999-9999-4999-8999-999999999999',
  match: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  offer: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
} as const

const community = { id: IDS.oak, name: 'Oak Circle' }

function memberContext(): RelationshipContext {
  return {
    viewer: { id: IDS.viewer, name: 'Maria' },
    counterpart: { id: IDS.counterpart, name: 'Sam', role: 'member' },
    request: {
      id: IDS.request,
      visibilityScope: 'platform',
      reachability: 'trust_network',
    },
    path: {
      scope: 'platform',
      degrees: 2,
      nodes: [
        { id: IDS.viewer, name: 'Maria' },
        { id: IDS.bridge, name: 'Lee' },
        { id: IDS.counterpart, name: 'Sam' },
      ],
    },
    networks: {
      viewer: [{ id: IDS.shared, name: 'Zoe', communities: [community] }],
      counterpart: [{ id: IDS.shared, name: 'Zoe', communities: [community] }],
      shared: [{ id: IDS.shared, name: 'Zoe', communities: [community] }],
      truncated: false,
    },
    links: [
      { source: IDS.viewer, target: IDS.bridge, relationship_state: 'warm', bond_depth: 'forming' },
      { source: IDS.bridge, target: IDS.counterpart, relationship_state: 'strong', bond_depth: 'growing' },
    ],
    summary: 'You and Sam both know Lee, and you share Zoe in Oak Circle.',
  }
}

beforeEach(() => {
  jest.clearAllMocks()
})

describe('Sprint 116 — RelationshipContextPanel non-blocking fetch', () => {
  it('renders the lens summary when the request-scoped call resolves with context', async () => {
    const context = memberContext()
    mocked.getRequestRelationshipContext.mockResolvedValue({ data: context })

    render(<RelationshipContextPanel kind="request" requestId={IDS.request} />)

    expect(await screen.findByText(context.summary)).toBeInTheDocument()
    expect(mocked.getRequestRelationshipContext).toHaveBeenCalledWith(IDS.request)
  })

  it('stays quiet while loading — no lens, no error note', () => {
    mocked.getRequestRelationshipContext.mockReturnValue(new Promise(() => {}))

    const { container } = render(<RelationshipContextPanel kind="request" requestId={IDS.request} />)

    expect(container.querySelector('[data-relationship-context="ready"]')).toBeNull()
    expect(container.querySelector('[data-relationship-context="unavailable"]')).toBeNull()
    expect(container.querySelector('[data-relationship-context="loading"]')).not.toBeNull()
  })

  it('suppresses the panel entirely on 403', async () => {
    mocked.getRequestRelationshipContext.mockRejectedValue({ response: { status: 403 } })

    const { container } = render(<RelationshipContextPanel kind="request" requestId={IDS.request} />)

    await waitFor(() =>
      expect(container.querySelector('[data-relationship-context="loading"]')).toBeNull()
    )
    expect(container.querySelector('[data-relationship-context]')).toBeNull()
  })

  it('suppresses the panel entirely on 404', async () => {
    mocked.getRequestRelationshipContext.mockRejectedValue({ response: { status: 404 } })

    const { container } = render(<RelationshipContextPanel kind="request" requestId={IDS.request} />)

    await waitFor(() =>
      expect(container.querySelector('[data-relationship-context="loading"]')).toBeNull()
    )
    expect(container.querySelector('[data-relationship-context]')).toBeNull()
  })

  it('suppresses the panel when the route returns 204 with an empty body', async () => {
    mocked.getRequestRelationshipContext.mockResolvedValue({ data: '' })

    const { container } = render(<RelationshipContextPanel kind="request" requestId={IDS.request} />)

    await waitFor(() =>
      expect(container.querySelector('[data-relationship-context="loading"]')).toBeNull()
    )
    expect(container.querySelector('[data-relationship-context]')).toBeNull()
  })

  it('shows a small unavailable note on 5xx', async () => {
    mocked.getRequestRelationshipContext.mockRejectedValue({ response: { status: 503 } })

    render(<RelationshipContextPanel kind="request" requestId={IDS.request} />)

    expect(await screen.findByText(/isn’t available right now/i)).toBeInTheDocument()
  })

  it('shows the unavailable note when the call fails with no response (timeout)', async () => {
    mocked.getRequestRelationshipContext.mockRejectedValue(new Error('timeout of 2500ms exceeded'))

    render(<RelationshipContextPanel kind="request" requestId={IDS.request} />)

    expect(await screen.findByText(/isn’t available right now/i)).toBeInTheDocument()
  })

  it('calls the match-scoped endpoint for kind="match"', async () => {
    mocked.getMatchRelationshipContext.mockResolvedValue({ data: memberContext() })

    render(<RelationshipContextPanel kind="match" requestId={IDS.request} matchId={IDS.match} />)

    await waitFor(() =>
      expect(mocked.getMatchRelationshipContext).toHaveBeenCalledWith(IDS.request, IDS.match)
    )
    expect(mocked.getRequestRelationshipContext).not.toHaveBeenCalled()
  })

  it('calls the provider-offer-scoped endpoint for kind="provider-offer"', async () => {
    mocked.getProviderOfferRelationshipContext.mockResolvedValue({ data: memberContext() })

    render(<RelationshipContextPanel kind="provider-offer" requestId={IDS.request} offerId={IDS.offer} />)

    await waitFor(() =>
      expect(mocked.getProviderOfferRelationshipContext).toHaveBeenCalledWith(IDS.request, IDS.offer)
    )
  })
})
