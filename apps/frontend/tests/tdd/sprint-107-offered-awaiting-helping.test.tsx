/**
 * Sprint 107 / BUG-023 — Home's offered-awaiting rows must be findable in Helping.
 */

import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import Dashboard from '@/pages/dashboard'
import CommitmentsTab from '@/components/CommitmentsTab'
import OfferedAwaitingPanel from '@/components/Feed/OfferedAwaitingPanel'

const router = {
  push: jest.fn(),
  back: jest.fn(),
  isReady: true,
  pathname: '/dashboard',
  query: { tab: 'helping' },
}

jest.mock('next/router', () => ({ useRouter: () => router }))

jest.mock('next/link', () => {
  return ({ children, href, className }: { children: React.ReactNode; href: string; className?: string }) => (
    <a href={href} className={className}>{children}</a>
  )
})

const mockGetMyCommunities = jest.fn()
const mockGetCuratedRequests = jest.fn()
const mockGetMatches = jest.fn()
const mockGetRequests = jest.fn()
const mockGetOfferedAwaiting = jest.fn()

jest.mock('@/lib/api', () => ({
  communityService: {
    getMyCommunities: (...a: any[]) => mockGetMyCommunities(...a),
  },
  requestService: {
    getCuratedRequests: (...a: any[]) => mockGetCuratedRequests(...a),
    getMatches: (...a: any[]) => mockGetMatches(...a),
    getRequests: (...a: any[]) => mockGetRequests(...a),
    getOfferedAwaiting: (...a: any[]) => mockGetOfferedAwaiting(...a),
    completeMatch: jest.fn(),
    acceptMatch: jest.fn(),
    rejectMatch: jest.fn(),
  },
  dibsService: {
    acceptDibs: jest.fn(),
    declineDibs: jest.fn(),
  },
  reputationService: { submitFeedback: jest.fn() },
}))

jest.mock('@/lib/api/providerApi', () => ({
  getOffersForRequest: jest.fn().mockResolvedValue({ offers: [] }),
  acceptOffer: jest.fn(),
  declineOffer: jest.fn(),
}))

jest.mock('@/contexts/ProviderContext', () => ({
  useProvider: () => ({ hasProviderProfile: false, isAvailable: false, providerServiceTypes: [] }),
}))

jest.mock('@/hooks/useOnboarding', () => ({
  useOnboarding: () => ({ shouldShow: false, markSeen: jest.fn() }),
}))

jest.mock('@/components/Layout', () => ({ children }: { children: React.ReactNode }) => <div>{children}</div>)
jest.mock('@/components/WelcomeModal', () => () => null)
jest.mock('@/components/Feed/UnifiedFeed', () => () => <div data-testid="feed" />)
jest.mock('@/components/SpeedDialFab', () => () => null)
jest.mock('@/components/RequestWizard', () => () => null)
jest.mock('@/components/OnboardingOverlay', () => () => null)

const awaitingItem = {
  match_id: 'match-1',
  request_id: 'request-1',
  title: 'Carpool to Saturday Market',
  community_name: 'Portland Tool Library & Share',
  status: 'proposed' as const,
  offered_at: '2026-06-20T12:00:00.000Z',
}

beforeEach(() => {
  jest.clearAllMocks()
  router.query = { tab: 'helping' }
  localStorage.clear()
  localStorage.setItem('token', 'token')
  localStorage.setItem('user', JSON.stringify({ id: 'user-1', name: 'Ada' }))
  window.scrollTo = jest.fn()

  mockGetMyCommunities.mockResolvedValue({ data: { communities: [{ id: 'community-1', name: 'Maple Street' }] } })
  mockGetCuratedRequests.mockResolvedValue({ data: { items: [] } })
  mockGetMatches.mockResolvedValue({ data: { matches: [] } })
  mockGetRequests.mockResolvedValue({ data: { requests: [] } })
  mockGetOfferedAwaiting.mockResolvedValue({ data: { count: 1, items: [awaitingItem] } })
})

describe('Sprint 107 / BUG-023 Home to Helping truth', () => {
  it('opens Dashboard on Helping when linked with ?tab=helping', async () => {
    render(<Dashboard />)

    await waitFor(() => {
      expect(screen.getByRole('tab', { name: /Helping/i })).toHaveAttribute('aria-selected', 'true')
    })
  })

  it('renders offered-awaiting rows explicitly in Helping', async () => {
    mockGetMatches.mockResolvedValue({
      data: {
        matches: [
          {
            id: 'match-1',
            request_id: 'request-1',
            responder_id: 'user-1',
            requester_id: 'requester-1',
            status: 'proposed',
            created_at: '2026-06-20T12:00:00.000Z',
            request_title: 'Carpool to Saturday Market',
            requester_name: 'Ravi',
            admin_proposed: false,
          },
        ],
      },
    })

    render(<CommitmentsTab communityId="community-1" />)

    expect(await screen.findByText('Offers awaiting requester')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Carpool to Saturday Market/i })).toHaveAttribute('href', '/requests/request-1')
    expect(screen.getByText('Portland Tool Library & Share')).toBeInTheDocument()
    expect(screen.getAllByText('Carpool to Saturday Market')).toHaveLength(1)
    expect(screen.queryByText('Awaiting Acceptance')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Withdraw Offer/i })).not.toBeInTheDocument()
    expect(screen.queryByText('No active commitments')).not.toBeInTheDocument()
  })

  it('keeps Home preview copy and the View all link aligned with Helping', () => {
    render(<OfferedAwaitingPanel count={1} items={[awaitingItem]} />)

    expect(screen.getByText('Waiting for the requester to respond.')).toBeInTheDocument()
    expect(screen.getByText(/View all in Helping/i).closest('a')).toHaveAttribute('href', '/dashboard?tab=helping')
  })
})
