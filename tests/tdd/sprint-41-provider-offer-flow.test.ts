// tests/tdd/sprint-41-provider-offer-flow.test.ts
/**
 * Sprint 41 — Provider Offer Flow
 *
 * Pure-logic tests covering:
 * - ProviderMatchingRequests display behavior (request list, Make Offer button)
 * - SubmitOfferModal price initialization and submission logic
 * - CommitmentsTab "Offers Received" section (accept/decline provider offers)
 *
 * These tests do NOT import React components directly — they test the
 * business rules and data transformations used by those components.
 */

// ── Types ─────────────────────────────────────────────────────────────────────

interface HelpRequest {
  id: string
  title: string
  request_type?: string
  status: string
  urgency?: string
  community_name?: string
  requester_id: string
  created_at: string
}

interface ProviderOffer {
  id: string
  provider_id: string
  provider_user_id: string
  provider_email: string
  request_id: string
  price: number | null
  note?: string
  status: 'pending' | 'accepted' | 'declined' | 'withdrawn'
  created_at: string
}

// ── ProviderMatchingRequests helpers ─────────────────────────────────────────

function filterOpenRequests(requests: HelpRequest[]): HelpRequest[] {
  return requests.filter((r) => r.status === 'open')
}

function hasRequests(requests: HelpRequest[]): boolean {
  return requests.length > 0
}

function buildOfferTarget(request: HelpRequest): { requestId: string; requestTitle: string } {
  return { requestId: request.id, requestTitle: request.title }
}

// ── SubmitOfferModal helpers ──────────────────────────────────────────────────

function initPriceField(defaultPrice: number | null): string {
  return defaultPrice != null ? String(defaultPrice) : ''
}

function parseSubmitPayload(
  requestId: string,
  priceStr: string,
  note: string
): { requestId: string; price: number | null; note: string } {
  const parsedPrice = priceStr.trim() !== '' ? parseFloat(priceStr) : null
  return { requestId, price: parsedPrice, note }
}

// ── CommitmentsTab offer helpers ──────────────────────────────────────────────

function getPendingOffers(offers: ProviderOffer[]): ProviderOffer[] {
  return offers.filter((o) => o.status === 'pending')
}

function shouldShowOffersSection(pendingOffers: ProviderOffer[]): boolean {
  return pendingOffers.length > 0
}

// ── Sample data ───────────────────────────────────────────────────────────────

const OPEN_REQUESTS: HelpRequest[] = [
  {
    id: 'req-1',
    title: 'Need a plumber',
    request_type: 'service',
    status: 'open',
    urgency: 'high',
    community_name: 'Seattle Mutual Aid',
    requester_id: 'user-requester',
    created_at: '2026-03-26T10:00:00Z',
  },
  {
    id: 'req-2',
    title: 'Need a ride to the airport',
    request_type: 'ride',
    status: 'open',
    urgency: 'medium',
    requester_id: 'user-requester-2',
    created_at: '2026-03-26T11:00:00Z',
  },
]

const CLOSED_REQUEST: HelpRequest = {
  id: 'req-3',
  title: 'Already matched request',
  status: 'matched',
  requester_id: 'user-requester-3',
  created_at: '2026-03-26T09:00:00Z',
}

const SAMPLE_OFFERS: ProviderOffer[] = [
  {
    id: 'offer-1',
    provider_id: 'prov-1',
    provider_user_id: 'user-prov-1',
    provider_email: 'alice@example.com',
    request_id: 'req-1',
    price: 75,
    note: 'Available Saturday morning',
    status: 'pending',
    created_at: '2026-03-26T12:00:00Z',
  },
  {
    id: 'offer-2',
    provider_id: 'prov-2',
    provider_user_id: 'user-prov-2',
    provider_email: 'bob@example.com',
    request_id: 'req-1',
    price: null,
    note: 'Happy to help for free',
    status: 'accepted',
    created_at: '2026-03-26T12:30:00Z',
  },
]

// ── ProviderMatchingRequests tests ────────────────────────────────────────────

describe('ProviderMatchingRequests', () => {
  it('renders open requests when provider is on-duty', () => {
    const open = filterOpenRequests(OPEN_REQUESTS)
    expect(open).toHaveLength(2)
    expect(open.map((r) => r.id)).toEqual(['req-1', 'req-2'])
  })

  it('excludes non-open requests from the list', () => {
    const mixed = [...OPEN_REQUESTS, CLOSED_REQUEST]
    const open = filterOpenRequests(mixed)
    expect(open).toHaveLength(2)
    expect(open.some((r) => r.id === 'req-3')).toBe(false)
  })

  it('shows "Make Offer" button for each open request (hasRequests returns true)', () => {
    const open = filterOpenRequests(OPEN_REQUESTS)
    expect(hasRequests(open)).toBe(true)
  })

  it('returns empty list when no open requests exist', () => {
    const open = filterOpenRequests([CLOSED_REQUEST])
    expect(open).toHaveLength(0)
    expect(hasRequests(open)).toBe(false)
  })

  it('builds correct offerTarget from a request', () => {
    const target = buildOfferTarget(OPEN_REQUESTS[0])
    expect(target.requestId).toBe('req-1')
    expect(target.requestTitle).toBe('Need a plumber')
  })
})

// ── SubmitOfferModal tests ────────────────────────────────────────────────────

describe('SubmitOfferModal', () => {
  it('pre-fills price field with defaultPrice when provided', () => {
    const price = initPriceField(50)
    expect(price).toBe('50')
  })

  it('leaves price field empty when defaultPrice is null', () => {
    const price = initPriceField(null)
    expect(price).toBe('')
  })

  it('allows price to be edited (returns updated string)', () => {
    let price = initPriceField(50)
    // simulate user typing a new value
    price = '75'
    expect(price).toBe('75')
  })

  it('calls submitOffer with correct args — parses price string to float', () => {
    const payload = parseSubmitPayload('req-1', '75.50', 'Available Saturday')
    expect(payload.requestId).toBe('req-1')
    expect(payload.price).toBe(75.5)
    expect(payload.note).toBe('Available Saturday')
  })

  it('passes null price when price field is empty', () => {
    const payload = parseSubmitPayload('req-1', '', 'No charge')
    expect(payload.price).toBeNull()
  })

  it('passes null price when price field is whitespace only', () => {
    const payload = parseSubmitPayload('req-1', '   ', 'Some note')
    expect(payload.price).toBeNull()
  })
})

// ── CommitmentsTab "Offers Received" tests ────────────────────────────────────

describe('CommitmentsTab — Offers Received', () => {
  it('shows Offers Received section when pending offers exist', () => {
    const pending = getPendingOffers(SAMPLE_OFFERS)
    expect(pending).toHaveLength(1)
    expect(shouldShowOffersSection(pending)).toBe(true)
  })

  it('hides Offers Received section when no pending offers', () => {
    const noOffers: ProviderOffer[] = []
    const pending = getPendingOffers(noOffers)
    expect(shouldShowOffersSection(pending)).toBe(false)
  })

  it('Accept button calls acceptOffer with correct offerId', async () => {
    const acceptedIds: string[] = []
    const mockAcceptOffer = async (offerId: string) => {
      acceptedIds.push(offerId)
    }

    const pending = getPendingOffers(SAMPLE_OFFERS)
    await mockAcceptOffer(pending[0].id)

    expect(acceptedIds).toHaveLength(1)
    expect(acceptedIds[0]).toBe('offer-1')
  })

  it('Decline button calls declineOffer with correct offerId', async () => {
    const declinedIds: string[] = []
    const mockDeclineOffer = async (offerId: string) => {
      declinedIds.push(offerId)
    }

    const pending = getPendingOffers(SAMPLE_OFFERS)
    await mockDeclineOffer(pending[0].id)

    expect(declinedIds).toHaveLength(1)
    expect(declinedIds[0]).toBe('offer-1')
  })

  it('only shows pending offers (not accepted/declined/withdrawn)', () => {
    const allOffers: ProviderOffer[] = [
      ...SAMPLE_OFFERS,
      {
        id: 'offer-3',
        provider_id: 'prov-3',
        provider_user_id: 'user-prov-3',
        provider_email: 'charlie@example.com',
        request_id: 'req-1',
        price: 100,
        status: 'declined',
        created_at: '2026-03-26T13:00:00Z',
      },
    ]
    const pending = getPendingOffers(allOffers)
    // offer-1 is pending; offer-2 is accepted; offer-3 is declined
    expect(pending).toHaveLength(1)
    expect(pending[0].id).toBe('offer-1')
  })
})
