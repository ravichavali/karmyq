/**
 * Sprint 101 — Home "you offered to help" band becomes item-level.
 *
 * Sprint 100 (G1) added a count-only band so an active helper's Home never reads empty. Sprint 101
 * makes it actionable: the server now returns `offeredAwaitingItems` (a small preview of the actual
 * open asks awaiting the requester), and Home renders each as a link to that request's detail page.
 * The aggregate count is kept (the preview is capped) with a trailing link to Helping.
 *
 * The default render path must NOT need a per-file router mock — the global apps/frontend/jest.setup.js
 * `next/router` mock covers RequestCard and any link rendering here.
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

describe('Sprint 101: Home offered-awaiting preview items', () => {
  it('renders the offered-awaiting preview items and links to each request detail', async () => {
    getCuratedRequests.mockResolvedValue({
      data: {
        items: [],
        offeredAwaiting: 4,
        offeredAwaitingItems: [
          { request_id: 'r1', match_id: 'm1', title: 'Hang a ceiling fan', community_name: 'North Portland', status: 'proposed', offered_at: '2026-06-15T12:00:00Z' },
          { request_id: 'r2', match_id: 'm2', title: 'Ride to appointment', community_name: 'Hawthorne', status: 'proposed', offered_at: '2026-06-15T13:00:00Z' },
        ],
      },
    })

    render(<UnifiedFeed view="home" />)

    // Apostrophe-tolerant: the band uses the codebase's typographic apostrophe (You’ve).
    expect(await screen.findByText(/You.?ve offered to help on 4 open asks/i)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Hang a ceiling fan/i })).toHaveAttribute('href', '/requests/r1')
    expect(screen.getByRole('link', { name: /Ride to appointment/i })).toHaveAttribute('href', '/requests/r2')
    expect(screen.getByText(/View all in Helping/i).closest('a')).toHaveAttribute('href', '/dashboard?tab=helping')
  })

  it('uses singular copy and still renders the single item for one awaiting offer', async () => {
    getCuratedRequests.mockResolvedValue({
      data: {
        items: [],
        offeredAwaiting: 1,
        offeredAwaitingItems: [
          { request_id: 'r1', match_id: 'm1', title: 'Hang a ceiling fan', community_name: 'North Portland', status: 'proposed', offered_at: '2026-06-15T12:00:00Z' },
        ],
      },
    })

    render(<UnifiedFeed view="home" />)

    expect(await screen.findByText(/You.?ve offered to help on 1 open ask\b/i)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Hang a ceiling fan/i })).toHaveAttribute('href', '/requests/r1')
  })

  it('does NOT render the band on the community view even with items present', async () => {
    getCuratedRequests.mockResolvedValue({
      data: {
        items: [],
        offeredAwaiting: 3,
        offeredAwaitingItems: [
          { request_id: 'r1', match_id: 'm1', title: 'Hang a ceiling fan', status: 'proposed', offered_at: '2026-06-15T12:00:00Z' },
        ],
      },
    })

    render(<UnifiedFeed view="community" communityId="c1" />)

    await screen.findByText(/No open requests right now/i)
    expect(screen.queryByText(/offered to help on/i)).not.toBeInTheDocument()
  })

  it('does NOT render the band when the count is zero', async () => {
    getCuratedRequests.mockResolvedValue({ data: { items: [], offeredAwaiting: 0, offeredAwaitingItems: [] } })
    render(<UnifiedFeed view="home" />)
    await screen.findByText(/you're caught up/i)
    expect(screen.queryByText(/offered to help on/i)).not.toBeInTheDocument()
  })
})
