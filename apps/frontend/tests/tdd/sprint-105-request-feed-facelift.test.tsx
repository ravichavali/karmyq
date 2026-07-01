import fs from 'fs'
import path from 'path'
import { render, screen, waitFor } from '@testing-library/react'
import RequestsPage from '@/pages/requests'
import RequestDetailPage from '@/pages/requests/[id]'
import OffersPage from '@/pages/offers'
import MatchRedirectPage from '@/pages/matches/[id]'
import { requestService } from '@/lib/api'

const replace = jest.fn()
const push = jest.fn()
let routerQuery: Record<string, string> = {}

jest.mock('next/router', () => ({
  useRouter: () => ({
    isReady: true,
    pathname: '/offers',
    route: '/offers',
    asPath: '/offers',
    query: routerQuery,
    replace,
    push,
  }),
}))

jest.mock('@/lib/api', () => ({
  requestService: {
    getCuratedRequests: jest.fn(),
    getRequests: jest.fn(),
    getRequest: jest.fn(),
    createMatch: jest.fn(),
    getOffers: jest.fn(),
    getMatch: jest.fn(),
    // S116: the can_offer detail mounts a relationship-context panel; suppress it here (404).
    getRequestRelationshipContext: () => Promise.reject({ response: { status: 404 } }),
  },
}))

jest.mock('@/hooks/useOnboarding', () => ({
  useOnboarding: () => ({ shouldShow: false, markSeen: jest.fn() }),
}))

jest.mock('@/components/OnboardingOverlay', () => function OnboardingOverlay() {
  return null
})

jest.mock('@/contexts/ProviderContext', () => ({
  useProvider: () => ({
    hasProviderProfile: false,
    isAvailable: false,
    setAvailability: jest.fn(),
    providerProfiles: [],
  }),
}))

jest.mock('@/contexts/NotificationContext', () => ({
  useNotifications: () => ({
    communityUnreadCount: 0,
    communityNotifications: [],
    loading: false,
    error: null,
    markAsRead: jest.fn(),
    deleteNotification: jest.fn(),
  }),
}))

jest.mock('@/components/Feed/RequestPayloadRenderer', () => function RequestPayloadRenderer() {
  return <div>Payload details</div>
})

const source = (relativePath: string) =>
  fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8')

const detail = (overrides: Record<string, unknown> = {}) => ({
  id: 'r1',
  title: 'Hang a ceiling fan',
  description: 'Need a hand mounting a fan.',
  status: 'open',
  expired: false,
  urgency: 'medium',
  request_type: 'generic',
  requester_name: 'Maria Reyes',
  community_name: 'North Portland',
  payload: null,
  requirements: {},
  viewer_relation: 'can_offer',
  viewer_match: null,
  ...overrides,
})

describe('Sprint 105 request feed/detail/offers/match facelift', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    localStorage.clear()
    routerQuery = {}
  })

  it('retires the standalone /requests feed by redirecting to Dashboard Home', async () => {
    render(<RequestsPage />)

    await waitFor(() => expect(replace).toHaveBeenCalledWith('/dashboard'))
    expect(requestService.getCuratedRequests).not.toHaveBeenCalled()
    expect(screen.queryByText(/Smart Filtering/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/Minimum Match Score/i)).not.toBeInTheDocument()
  })

  it('removes the fossil match-percentage lead from the retired route source', () => {
    const requestsSource = source('src/pages/requests/index.tsx')
    expect(requestsSource).not.toMatch(/% Match|matchScore|Minimum Match Score|Smart Filtering|max-w-7xl/)
  })

  it('removes stale links to the retired /requests feed and converges feed sibling cards', () => {
    expect(source('src/pages/settings/preferences.tsx')).not.toMatch(/router\.push\('\/requests'\)/)
    for (const relativePath of [
      'src/components/Feed/ActivityCard.tsx',
      'src/components/Feed/StoryCard.tsx',
      'src/components/Feed/DecisionBand.tsx',
    ]) {
      expect(source(relativePath)).not.toMatch(/feed-card/)
    }
  })

  it('renders request detail with humanized status and urgency token badges', async () => {
    routerQuery = { id: 'r1' }
    ;(requestService.getRequest as jest.Mock).mockResolvedValue({
      data: detail({ status: 'dibs_pending', urgency: 'medium' }),
    })

    render(<RequestDetailPage />)

    expect(await screen.findByRole('heading', { name: 'Hang a ceiling fan' })).toHaveClass('kq-headline-sm')
    expect(screen.getByText('Dibs pending')).toHaveClass('text-warn', 'bg-warn-light', 'border-warn')
    expect(screen.getByText('Medium')).toHaveClass('text-warn', 'bg-warn-light', 'border-warn')
    expect(screen.queryByText('dibs_pending')).not.toBeInTheDocument()
  })

  it('omits the request-detail status pill when status is absent', async () => {
    routerQuery = { id: 'r1' }
    ;(requestService.getRequest as jest.Mock).mockResolvedValue({
      data: detail({ status: undefined }),
    })

    render(<RequestDetailPage />)

    expect(await screen.findByRole('heading', { name: 'Hang a ceiling fan' })).toBeInTheDocument()
    expect(screen.queryByText('Unknown')).not.toBeInTheDocument()
  })

  it('shows request-detail offer errors with semantic error styling', async () => {
    routerQuery = { id: 'r1' }
    ;(requestService.getRequest as jest.Mock).mockRejectedValue({ response: { status: 500 } })

    render(<RequestDetailPage />)

    expect(await screen.findByText("Couldn't load this request")).toBeInTheDocument()
    expect(screen.getByTestId('empty-state')).toHaveClass('kq-finite-state')
  })

  it('renders offers with warm cards and humanized status labels', async () => {
    ;(requestService.getOffers as jest.Mock).mockResolvedValue({
      data: {
        data: [
          {
            id: 'offer-1',
            title: 'Can drive to appointments',
            description: 'Weekday afternoons',
            status: 'active',
            community_name: 'North Portland',
            helper_name: 'Sam',
            category: 'transportation',
            created_at: '2026-06-17T12:00:00Z',
          },
        ],
      },
    })

    render(<OffersPage />)

    expect(await screen.findByText('Can drive to appointments')).toBeInTheDocument()
    expect(screen.getByLabelText('Status: Active')).toHaveClass('text-primary-dark', 'bg-primary-light')
    expect(document.querySelector('.kq-card')).toBeTruthy()
  })

  it('renders match lookup failures as an accessible warm finite state', async () => {
    routerQuery = { id: 'match-1' }
    ;(requestService.getMatch as jest.Mock).mockRejectedValue(new Error('not found'))

    render(<MatchRedirectPage />)

    expect(await screen.findByRole('heading', { name: 'Match not found' })).toBeInTheDocument()
    expect(screen.getByTestId('empty-state')).toHaveClass('kq-finite-state')
    expect(screen.getByRole('button', { name: 'Go to Dashboard' })).toBeInTheDocument()
  })
})
