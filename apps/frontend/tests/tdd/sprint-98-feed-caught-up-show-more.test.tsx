/**
 * Sprint 98 — Dashboard feed caught-up vs show-more coherence (BUG-098-005)
 *
 * The empty home feed showed "You're caught up" WHILE also offering "Show more open
 * requests" — two contradicting terminal states. Coherent rule:
 *  - Before widening we don't yet know if lower-ranked asks exist, so we offer
 *    "Show more open requests" and DO NOT claim the user is caught up.
 *  - After widening (minScore=0), the state is final: if still empty → "You're caught up"
 *    with NO show-more affordance; if results → show them + one finite terminal note.
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import UnifiedFeed from '@/components/Feed/UnifiedFeed'
import type { RequestCardData, UnifiedFeedItem } from '@/types/unified-feed'

const getCuratedRequests = jest.fn()

jest.mock('@/lib/api', () => ({
  requestService: {
    getCuratedRequests: (...args: unknown[]) => getCuratedRequests(...args),
    createMatch: jest.fn().mockResolvedValue({}),
    acceptMatch: jest.fn().mockResolvedValue({}),
    rejectMatch: jest.fn().mockResolvedValue({}),
    completeMatch: jest.fn().mockResolvedValue({}),
  },
  dibsService: { acceptDibs: jest.fn(), declineDibs: jest.fn() },
}))
jest.mock('@/lib/api/providerApi', () => ({ acceptOffer: jest.fn(), declineOffer: jest.fn() }))
jest.mock('@/hooks/useTrustPath', () => ({ useTrustPath: () => ({ trustPath: null, loading: false, error: null }) }))

function requestItem(over: Partial<RequestCardData> = {}): UnifiedFeedItem {
  return {
    kind: 'request',
    priority: 1012,
    data: {
      request_id: 'r-1', requester_id: 'neighbor-1', title: 'Water the garden',
      description: 'Tomatoes need attention.', author_name: 'Nina',
      community_id: 'comm-1', community_name: 'Hawthorne Mutual Aid',
      urgency: 'low', status: 'open', request_type: 'generic' as any,
      payload: {}, requirements: {}, expected_duration: '15 min', offers_count: 0,
      match_score: 12, match_reason: 'same community', trust_degree: null, ...over,
    } as RequestCardData,
  }
}

beforeEach(() => {
  getCuratedRequests.mockReset()
  localStorage.setItem('user', JSON.stringify({ id: 'me' }))
})

describe('Sprint 98: caught-up and show-more are mutually exclusive', () => {
  it('empty feed before widening offers Show more and does NOT claim caught up', async () => {
    getCuratedRequests.mockResolvedValueOnce({ data: { items: [] } })

    render(<UnifiedFeed view="home" />)

    expect(await screen.findByRole('button', { name: /show more open requests/i })).toBeInTheDocument()
    expect(screen.queryByText(/you're caught up/i)).not.toBeInTheDocument()
  })

  it('empty feed after widening shows caught up and removes the Show more affordance', async () => {
    getCuratedRequests
      .mockResolvedValueOnce({ data: { items: [] } })  // minScore 30
      .mockResolvedValueOnce({ data: { items: [] } })  // minScore 0 (widened) — still empty

    render(<UnifiedFeed view="home" />)

    fireEvent.click(await screen.findByRole('button', { name: /show more open requests/i }))

    expect(await screen.findByText(/you're caught up/i)).toBeInTheDocument()
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: /show more open requests/i })).not.toBeInTheDocument()
    )
  })

  it('after widening with results, shows one finite terminal note (not Show more)', async () => {
    getCuratedRequests
      .mockResolvedValueOnce({ data: { items: [] } })                  // minScore 30 → empty
      .mockResolvedValueOnce({ data: { items: [requestItem()] } })     // widened → has a lower-ranked ask

    render(<UnifiedFeed view="home" />)

    fireEvent.click(await screen.findByRole('button', { name: /show more open requests/i }))

    expect(await screen.findByText('Water the garden')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /show more open requests/i })).not.toBeInTheDocument()
    expect(screen.getByText(/that's everyone for now/i)).toBeInTheDocument()
  })
})
