/**
 * Sprint 100 / F3 — the Dashboard Home empty feed shows ONE honest, calm message.
 *
 * The old empty state was a two-stage engagement nudge: "No top matches right now" with a "Show more
 * open requests" button that widened the feed before it would say "You're caught up". The decision
 * (F3) is to collapse that to a single verbatim caught-up message that points to communities — no
 * first stage, no show-more button.
 */

import { render, screen } from '@testing-library/react'
import UnifiedFeed from '@/components/Feed/UnifiedFeed'

const getCuratedRequests = jest.fn()

jest.mock('next/router', () => ({ useRouter: () => ({ push: jest.fn() }) }))
jest.mock('@/lib/api', () => ({
  requestService: {
    getCuratedRequests: (...args: unknown[]) => getCuratedRequests(...args),
    createMatch: jest.fn().mockResolvedValue({}),
  },
  dibsService: { acceptDibs: jest.fn(), declineDibs: jest.fn() },
}))
jest.mock('@/hooks/useTrustPath', () => ({ useTrustPath: () => ({ trustPath: null, loading: false, error: null }) }))

describe('Sprint 100: Dashboard Home empty feed (F3)', () => {
  beforeEach(() => {
    getCuratedRequests.mockResolvedValue({ data: { items: [] } })
    localStorage.clear()
    localStorage.setItem('user', JSON.stringify({ id: 'u1' }))
  })

  it('shows a single "You\'re caught up" message with no Show-more button and no "No top matches" stage', async () => {
    render(<UnifiedFeed view="home" />)

    expect(await screen.findByText("You're caught up")).toBeInTheDocument()
    expect(
      screen.getByText(/No direct matches for you right now — but your communities may still have open asks waiting\. Browse to lend a hand\./i),
    ).toBeInTheDocument()

    // The engagement nudge and the first "No top matches" stage are gone.
    expect(screen.queryByText(/Show more open requests/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/No top matches/i)).not.toBeInTheDocument()

    // Still points the member to where open asks live.
    expect(screen.getByText(/Browse communities/i)).toBeInTheDocument()
  })
})
