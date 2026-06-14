/**
 * Sprint 88 — UnifiedFeed curated default + show-more open requests.
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import UnifiedFeed from '@/components/Feed/UnifiedFeed'
import type { RequestCardData, UnifiedFeedItem } from '@/types/unified-feed'

const getCuratedRequests = jest.fn()
const createMatch = jest.fn().mockResolvedValue({})

jest.mock('@/lib/api', () => ({
  requestService: {
    getCuratedRequests: (...args: unknown[]) => getCuratedRequests(...args),
    createMatch: (...args: unknown[]) => createMatch(...args),
    acceptMatch: jest.fn().mockResolvedValue({}),
    rejectMatch: jest.fn().mockResolvedValue({}),
    completeMatch: jest.fn().mockResolvedValue({}),
  },
  dibsService: { acceptDibs: jest.fn(), declineDibs: jest.fn() },
}))

jest.mock('@/lib/api/providerApi', () => ({ acceptOffer: jest.fn(), declineOffer: jest.fn() }))
jest.mock('@/hooks/useTrustPath', () => ({ useTrustPath: () => ({ trustPath: null, loading: false, error: null }) }))

function requestItem(over: Partial<RequestCardData>): UnifiedFeedItem {
  return {
    kind: 'request',
    priority: 1012,
    data: {
      request_id: 'below-threshold',
      requester_id: 'neighbor-1',
      title: 'Water the garden',
      description: 'The tomatoes need a little attention.',
      author_name: 'Nina',
      community_id: 'comm-1',
      community_name: 'Hawthorne Mutual Aid',
      urgency: 'low',
      status: 'open',
      request_type: 'generic' as any,
      payload: {},
      requirements: {},
      expected_duration: '15 min',
      offers_count: 0,
      match_score: 12,
      match_reason: 'same community',
      trust_degree: null,
      ...over,
    } as RequestCardData,
  }
}

beforeEach(() => {
  getCuratedRequests.mockReset()
  createMatch.mockClear()
  localStorage.setItem('user', JSON.stringify({ id: 'me' }))
})

describe('UnifiedFeed show-more open requests', () => {
  it('fetches Home with minScore 30 by default and minScore 0 after show-more', async () => {
    getCuratedRequests
      .mockResolvedValueOnce({ data: { items: [] } })
      .mockResolvedValueOnce({ data: { items: [requestItem({})] } })

    render(<UnifiedFeed view="home" />)

    // Sprint 98 (BUG-098-005): before widening we offer "Show more" without claiming
    // the user is caught up (the two no longer appear together).
    expect(await screen.findByRole('button', { name: /show more open requests/i })).toBeInTheDocument()
    expect(screen.queryByText(/You're caught up/i)).not.toBeInTheDocument()
    expect(getCuratedRequests).toHaveBeenNthCalledWith(1, expect.objectContaining({ view: 'home', minScore: 30 }))

    fireEvent.click(screen.getByRole('button', { name: /show more open requests/i }))

    await waitFor(() => expect(getCuratedRequests).toHaveBeenNthCalledWith(2, expect.objectContaining({ view: 'home', minScore: 0 })))
    expect(await screen.findByText('Water the garden')).toBeInTheDocument()
  })

  it('lets members widen a non-empty curated feed', async () => {
    getCuratedRequests
      .mockResolvedValueOnce({
        data: {
          items: [
            requestItem({
              request_id: 'curated-request',
              title: 'Pick up medicine',
              match_score: 48,
            }),
          ],
        },
      })
      .mockResolvedValueOnce({
        data: {
          items: [
            requestItem({
              request_id: 'curated-request',
              title: 'Pick up medicine',
              match_score: 48,
            }),
            requestItem({}),
          ],
        },
      })

    render(<UnifiedFeed view="home" />)

    expect(await screen.findByText('Pick up medicine')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /show more open requests/i })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /show more open requests/i }))

    await waitFor(() => expect(getCuratedRequests).toHaveBeenNthCalledWith(2, expect.objectContaining({ view: 'home', minScore: 0 })))
    expect(await screen.findByText('Water the garden')).toBeInTheDocument()
  })

  it('fetches Community Home with minScore 30 by default and keeps the community id', async () => {
    getCuratedRequests.mockResolvedValueOnce({ data: { items: [] } })

    render(<UnifiedFeed view="community" communityId="comm-1" />)

    await screen.findByText(/No open requests right now/i)
    expect(getCuratedRequests).toHaveBeenCalledWith(expect.objectContaining({
      view: 'community',
      community_id: 'comm-1',
      minScore: 30,
    }))
  })
})
