/**
 * Sprint 108 — admin-proposed responder decisions: preview on Home, decide in Helping.
 *
 *  - Home (UnifiedFeed) renders a calm SuggestedAsHelperPanel when `suggestedAsHelper.count > 0`,
 *    links to Helping, and never renders an inline accept/decline (BUG-015 keeps decisions off Home).
 *  - The Helping DecisionBand renders a responder-role admin-proposed match decision and routes
 *    accept → requestService.acceptMatch (PUT /matches/:id/accept), decline → rejectMatch — never the
 *    requester/offer path.
 *  - OfferedAwaitingPanel is actionable: each previewed ask has an inline affordance to open it.
 *  - The Home caught-up state is honest: scoped to direct matches, with a Browse CTA, never a bare
 *    "That's everyone".
 *
 * Uses the global apps/frontend/jest.setup.js next/router mock (no per-file router mock).
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import UnifiedFeed from '@/components/Feed/UnifiedFeed'
import DecisionBand from '@/components/Feed/DecisionBand'
import OfferedAwaitingPanel from '@/components/Feed/OfferedAwaitingPanel'
import type { DecisionData, OfferedAwaitingItem } from '@/types/unified-feed'

const getCuratedRequests = jest.fn()
const acceptMatch = jest.fn().mockResolvedValue({})
const rejectMatch = jest.fn().mockResolvedValue({})

jest.mock('@/lib/api', () => ({
  requestService: {
    getCuratedRequests: (...args: unknown[]) => getCuratedRequests(...args),
    acceptMatch: (...args: unknown[]) => acceptMatch(...args),
    rejectMatch: (...args: unknown[]) => rejectMatch(...args),
    completeMatch: jest.fn(),
    createMatch: jest.fn().mockResolvedValue({}),
  },
  dibsService: { acceptDibs: jest.fn(), declineDibs: jest.fn() },
}))
jest.mock('@/lib/api/providerApi', () => ({ acceptOffer: jest.fn(), declineOffer: jest.fn() }))
jest.mock('@/hooks/useTrustPath', () => ({ useTrustPath: () => ({ trustPath: null, loading: false, error: null }) }))

beforeEach(() => {
  getCuratedRequests.mockReset()
  acceptMatch.mockClear()
  rejectMatch.mockClear()
  localStorage.setItem('user', JSON.stringify({ id: 'me' }))
})

const suggestedItems: OfferedAwaitingItem[] = [
  { request_id: 'r1', match_id: 'm1', title: 'Carry boxes up three flights', community_name: 'South San Francisco', status: 'proposed', offered_at: '2026-06-20T12:00:00Z' },
  { request_id: 'r2', match_id: 'm2', title: 'Walk a neighbour’s dog', community_name: 'Marin Mutual Aid', status: 'proposed', offered_at: '2026-06-20T13:00:00Z' },
]

describe('Sprint 108: Home SuggestedAsHelperPanel preview', () => {
  it('renders the preview band and links to Helping when suggestedAsHelper.count > 0, with no inline decision', async () => {
    getCuratedRequests.mockResolvedValue({
      data: { items: [], offeredAwaiting: 0, offeredAwaitingItems: [], suggestedAsHelper: { count: 2, items: suggestedItems } },
    })

    render(<UnifiedFeed view="home" />)

    expect(await screen.findByText(/suggested you as a helper/i)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Carry boxes up three flights/i })).toHaveAttribute('href', '/requests/r1')
    const helpingLink = screen.getByRole('link', { name: /Respond in Helping/i })
    expect(helpingLink).toHaveAttribute('href', '/dashboard?tab=helping')
    // Home previews only — the accept/decline lives in Helping (BUG-015), never inline on Home.
    expect(screen.queryByRole('button', { name: /^accept$/i })).not.toBeInTheDocument()
  })

  it('does NOT render the SuggestedAsHelperPanel on the community view', async () => {
    getCuratedRequests.mockResolvedValue({
      data: { items: [], offeredAwaiting: 0, offeredAwaitingItems: [], suggestedAsHelper: { count: 2, items: suggestedItems } },
    })
    render(<UnifiedFeed view="community" communityId="c1" />)
    await screen.findByText(/No open requests right now/i)
    expect(screen.queryByText(/suggested you as a helper/i)).not.toBeInTheDocument()
  })

  it('does NOT render the band when suggestedAsHelper.count is zero', async () => {
    getCuratedRequests.mockResolvedValue({ data: { items: [], offeredAwaiting: 0, offeredAwaitingItems: [], suggestedAsHelper: { count: 0, items: [] } } })
    render(<UnifiedFeed view="home" />)
    await screen.findByText(/you're caught up/i)
    expect(screen.queryByText(/suggested you as a helper/i)).not.toBeInTheDocument()
  })
})

describe('Sprint 108: Helping DecisionBand renders admin-proposed responder decisions', () => {
  const adminProposedDecision: DecisionData = {
    subject_id: 'match-ap-1',
    subject_kind: 'match',
    request_id: 'req-ap-1',
    title: 'Carry boxes up three flights',
    community_name: 'South San Francisco',
    counterparty_name: 'Maria',
    counterparty_id: 'user-requester',
    member_role: 'responder',
    actions: ['accept_offer', 'decline_offer'],
  }

  it('labels it as a suggestion and routes accept → acceptMatch (the matches endpoint, not the offer path)', async () => {
    render(<DecisionBand decisions={[adminProposedDecision]} />)
    expect(screen.getByText(/suggested you as a helper/i)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /^accept$/i }))
    await waitFor(() => expect(acceptMatch).toHaveBeenCalledWith('match-ap-1'))
  })

  it('routes decline → rejectMatch', async () => {
    render(<DecisionBand decisions={[adminProposedDecision]} />)
    fireEvent.click(screen.getByRole('button', { name: /^decline$/i }))
    await waitFor(() => expect(rejectMatch).toHaveBeenCalledWith('match-ap-1'))
  })
})

describe('Sprint 108: OfferedAwaitingPanel is actionable', () => {
  it('exposes an explicit open-ask affordance per previewed ask', () => {
    const items: OfferedAwaitingItem[] = [
      { request_id: 'r9', match_id: 'm9', title: 'Hang a ceiling fan', community_name: 'North Portland', status: 'proposed', offered_at: '2026-06-15T12:00:00Z' },
    ]
    render(<OfferedAwaitingPanel count={1} items={items} />)
    const open = screen.getByRole('link', { name: /open ask/i })
    expect(open).toHaveAttribute('href', '/requests/r9')
  })
})

describe('Sprint 108: honest caught-up copy on Home', () => {
  it('scopes the caught-up claim to direct matches with a Browse CTA, never a bare "That’s everyone"', async () => {
    getCuratedRequests.mockResolvedValue({ data: { items: [], offeredAwaiting: 0, offeredAwaitingItems: [], suggestedAsHelper: { count: 0, items: [] } } })
    render(<UnifiedFeed view="home" />)
    expect(await screen.findByText(/you're caught up/i)).toBeInTheDocument()
    expect(screen.getByText(/direct matches/i)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /browse communities/i })).toBeInTheDocument()
    expect(screen.queryByText(/that's everyone/i)).not.toBeInTheDocument()
  })
})
