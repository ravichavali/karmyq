import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import type { RelationshipContext } from '@karmyq/shared'
import SubmitOfferModal from '@/components/SubmitOfferModal'
import CommitmentsTab from '@/components/CommitmentsTab'
import { PERSON_RADIUS } from '@/components/relationships/relationshipLensModel'
import { requestService } from '@/lib/api'
import { getOffersForRequest, submitOffer } from '@/lib/api/providerApi'

const REQUEST_ID = '99999999-9999-4999-8999-999999999999'
const OFFER_ID = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
const REQUESTER_ID = '11111111-1111-4111-8111-111111111111'

jest.mock('@/lib/api', () => ({
  requestService: {
    getCuratedRequests: jest.fn(),
    getOfferedAwaiting: jest.fn(),
    getMatches: jest.fn(),
    getRequests: jest.fn(),
    getRequestRelationshipContext: jest.fn(),
    getProviderOfferRelationshipContext: jest.fn(),
  },
  dibsService: {},
}))

jest.mock('@/lib/api/providerApi', () => ({
  submitOffer: jest.fn(),
  getOffersForRequest: jest.fn(),
  acceptOffer: jest.fn(),
  declineOffer: jest.fn(),
}))

const mockedRequest = requestService as unknown as Record<string, jest.Mock>
const mockedSubmitOffer = submitOffer as jest.Mock
const mockedGetOffers = getOffersForRequest as jest.Mock

function requesterFacingProviderContext(): RelationshipContext {
  return {
    viewer: { id: REQUESTER_ID, name: 'Maria' },
    counterpart: {
      id: '22222222-2222-4222-8222-222222222222',
      name: 'Dev',
      role: 'provider',
      provider: { serviceType: 'tradesperson', collectiveName: 'Marin Helping Hands' },
    },
    request: { id: REQUEST_ID, visibilityScope: 'platform', reachability: 'trust_network' },
    path: {
      scope: 'platform',
      degrees: 2,
      nodes: [
        { id: REQUESTER_ID, name: 'Maria' },
        { id: '33333333-3333-4333-8333-333333333333', name: 'Lee' },
        { id: '22222222-2222-4222-8222-222222222222', name: 'Dev' },
      ],
    },
    networks: { viewer: [], counterpart: [], shared: [], truncated: false },
    links: [],
    summary: 'You and Dev both know Lee.',
  }
}

function plainContext(): RelationshipContext {
  return { ...requesterFacingProviderContext(), counterpart: { id: '22222222-2222-4222-8222-222222222222', name: 'Dev', role: 'member' } }
}

beforeEach(() => {
  jest.clearAllMocks()
  localStorage.clear()
})

describe('Sprint 116 — provider submitting sees the requester', () => {
  it('shows request-scoped context above the Submit control', async () => {
    mockedRequest.getRequestRelationshipContext.mockResolvedValue({ data: plainContext() })

    render(
      <SubmitOfferModal
        requestId={REQUEST_ID}
        requestTitle="Fix a leaking tap"
        defaultPrice={null}
        onClose={() => {}}
        onSubmitted={() => {}}
      />
    )

    const summary = await screen.findByText('You and Dev both know Lee.')
    expect(mockedRequest.getRequestRelationshipContext).toHaveBeenCalledWith(REQUEST_ID)
    const submit = screen.getByRole('button', { name: /submit offer/i })
    expect(summary.compareDocumentPosition(submit) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('keeps Submit usable when the context call fails', async () => {
    mockedRequest.getRequestRelationshipContext.mockRejectedValue({ response: { status: 503 } })

    render(
      <SubmitOfferModal
        requestId={REQUEST_ID}
        requestTitle="Fix a leaking tap"
        defaultPrice={null}
        onClose={() => {}}
        onSubmitted={() => {}}
      />
    )

    const submit = await screen.findByRole('button', { name: /submit offer/i })
    await waitFor(() => expect(screen.getByText(/isn’t available right now/i)).toBeInTheDocument())
    expect(submit).toBeEnabled()
    expect(mockedSubmitOffer).not.toHaveBeenCalled()
  })
})

describe('Sprint 116 — requester reviewing a provider offer sees the provider role', () => {
  function seedCommitments(opts: { contextResolves?: boolean } = {}) {
    localStorage.setItem('user', JSON.stringify({ id: REQUESTER_ID, name: 'Maria' }))
    mockedRequest.getCuratedRequests.mockResolvedValue({ data: { items: [] } })
    mockedRequest.getOfferedAwaiting.mockResolvedValue({ data: { count: 0, items: [] } })
    mockedRequest.getMatches.mockResolvedValue({ data: { matches: [] } })
    mockedRequest.getRequests.mockResolvedValue({
      data: { requests: [{ id: REQUEST_ID, title: 'Fix a leaking tap', status: 'open' }] },
    })
    mockedGetOffers.mockResolvedValue({
      offers: [{ id: OFFER_ID, provider_email: 'dev@example.com', price: 40, note: 'Available Saturday', status: 'pending' }],
    })
    if (opts.contextResolves === false) {
      mockedRequest.getProviderOfferRelationshipContext.mockRejectedValue({ response: { status: 503 } })
    } else {
      mockedRequest.getProviderOfferRelationshipContext.mockResolvedValue({ data: requesterFacingProviderContext() })
    }
  }

  it('renders the provider-offer lens with the service type and collective label, equal person nodes', async () => {
    seedCommitments()
    const { container } = render(<CommitmentsTab />)

    expect(await screen.findByText('You and Dev both know Lee.')).toBeInTheDocument()
    await waitFor(() =>
      expect(mockedRequest.getProviderOfferRelationshipContext).toHaveBeenCalledWith(REQUEST_ID, OFFER_ID)
    )
    const badge = container.querySelector('[data-provider-badge]')!
    expect(badge).toHaveTextContent('Tradesperson')
    expect(badge).toHaveTextContent('Marin Helping Hands')
    const radii = [...container.querySelectorAll('circle')].map(c => c.getAttribute('r'))
    expect(new Set(radii)).toEqual(new Set([String(PERSON_RADIUS)]))
  })

  it('keeps Accept and Decline enabled when the provider context fails', async () => {
    seedCommitments({ contextResolves: false })
    render(<CommitmentsTab />)

    const accept = await screen.findByRole('button', { name: 'Accept' })
    const decline = screen.getByRole('button', { name: 'Decline' })
    await waitFor(() => expect(screen.getByText(/isn’t available right now/i)).toBeInTheDocument())
    expect(accept).toBeEnabled()
    expect(decline).toBeEnabled()
  })
})
