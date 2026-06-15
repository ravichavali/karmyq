/**
 * Sprint 98 — Dashboard feed caught-up vs show-more coherence (BUG-098-005)
 *
 * SUPERSEDED BY Sprint 100 / F3: the empty Home feed no longer offers a "Show more open requests"
 * widening nudge at all — it shows ONE honest caught-up message that points to communities (where
 * the F2 open-asks reachability now lives). So the old contradiction (caught-up WHILE offering
 * show-more) is gone by construction: there is no show-more on an empty Home to contradict. These
 * tests now assert the F3 single-message behaviour. The populated-feed widening + terminal note is
 * covered by sprint-97-feed-terminal-state.
 */

import { render, screen } from '@testing-library/react'
import UnifiedFeed from '@/components/Feed/UnifiedFeed'

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

beforeEach(() => {
  getCuratedRequests.mockReset()
  localStorage.setItem('user', JSON.stringify({ id: 'me' }))
})

describe('Sprint 98 → 100 (F3): empty Home is a single coherent caught-up message', () => {
  it('empty Home shows "You\'re caught up" with NO Show-more affordance to contradict it', async () => {
    getCuratedRequests.mockResolvedValue({ data: { items: [] } })

    render(<UnifiedFeed view="home" />)

    expect(await screen.findByText(/you're caught up/i)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /show more open requests/i })).not.toBeInTheDocument()
  })

  it('empty Home points the member to communities rather than nudging to widen', async () => {
    getCuratedRequests.mockResolvedValue({ data: { items: [] } })

    render(<UnifiedFeed view="home" />)

    await screen.findByText(/you're caught up/i)
    expect(screen.getByText(/Browse communities/i)).toBeInTheDocument()
    // A populated feed retains its own Show-more (sprint-97); on an empty Home nothing widens in.
    expect(screen.queryByText('Water the garden')).not.toBeInTheDocument()
  })
})
