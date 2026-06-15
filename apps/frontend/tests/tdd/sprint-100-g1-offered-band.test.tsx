/**
 * Sprint 100 / G1 — an active helper's Home must not read empty.
 *
 * The curated feed hides asks the viewer already offered on, and a responder's own pending offer is
 * awaiting the requester (not a decision they owe), so it isn't in the decision band. The live audit
 * found a member with 330 such offers whose Home was empty. The server now returns `offeredAwaiting`
 * with the home feed; UnifiedFeed renders one honest band that points to the Helping tab. The band
 * shows only on Home, only when the count is positive.
 */

import { render, screen } from '@testing-library/react'
import UnifiedFeed from '@/components/Feed/UnifiedFeed'

const getCuratedRequests = jest.fn()

jest.mock('@/lib/api', () => ({
  requestService: {
    getCuratedRequests: (...args: unknown[]) => getCuratedRequests(...args),
    createMatch: jest.fn().mockResolvedValue({}),
  },
  dibsService: { acceptDibs: jest.fn(), declineDibs: jest.fn() },
}))
jest.mock('@/hooks/useTrustPath', () => ({ useTrustPath: () => ({ trustPath: null, loading: false, error: null }) }))

beforeEach(() => {
  getCuratedRequests.mockReset()
  localStorage.setItem('user', JSON.stringify({ id: 'me' }))
})

describe('Sprint 100 G1: Home "you offered to help" band', () => {
  it('shows the band with the count and a link to Helping when offers are awaiting', async () => {
    getCuratedRequests.mockResolvedValue({ data: { items: [], offeredAwaiting: 3 } })

    render(<UnifiedFeed view="home" />)

    expect(await screen.findByText(/3 open asks/i)).toBeInTheDocument()
    expect(screen.getByText(/offered to help on/i)).toBeInTheDocument()
    const link = screen.getByText(/View in Helping/i).closest('a')
    expect(link).toHaveAttribute('href', '/dashboard?tab=helping')
  })

  it('uses the singular "ask" for a single awaiting offer', async () => {
    getCuratedRequests.mockResolvedValue({ data: { items: [], offeredAwaiting: 1 } })
    render(<UnifiedFeed view="home" />)
    expect(await screen.findByText(/1 open ask\b/i)).toBeInTheDocument()
  })

  it('does NOT show the band when there are no awaiting offers', async () => {
    getCuratedRequests.mockResolvedValue({ data: { items: [], offeredAwaiting: 0 } })
    render(<UnifiedFeed view="home" />)
    await screen.findByText(/you're caught up/i)
    expect(screen.queryByText(/offered to help on/i)).not.toBeInTheDocument()
  })

  it('does NOT show the band on the community view', async () => {
    getCuratedRequests.mockResolvedValue({ data: { items: [], offeredAwaiting: 5 } })
    render(<UnifiedFeed view="community" communityId="c1" />)
    await screen.findByText(/No open requests right now/i)
    expect(screen.queryByText(/offered to help on/i)).not.toBeInTheDocument()
  })
})
