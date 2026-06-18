import fs from 'fs'
import path from 'path'
import { render, screen } from '@testing-library/react'

const mockRouter = {
  query: { id: 'comm-1' } as Record<string, unknown>,
  pathname: '/communities/[id]',
  push: jest.fn(),
  replace: jest.fn(),
}

jest.mock('next/router', () => ({ useRouter: () => mockRouter }))

jest.mock('@/components/Layout', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

jest.mock('@/components/Feed/UnifiedFeed', () => ({
  __esModule: true,
  default: () => <div data-testid="unified-feed" />,
}))

jest.mock('@/components/community/tabs/TrustGraphTab', () => ({
  __esModule: true,
  default: () => <div data-testid="trust-graph-tab" />,
}))
jest.mock('@/components/community/tabs/StewardshipTab', () => ({
  __esModule: true,
  default: () => <div data-testid="stewardship-tab" />,
}))
jest.mock('@/components/community/tabs/ActiveTab', () => ({
  __esModule: true,
  default: () => <div data-testid="people-tab" />,
}))
jest.mock('@/components/ActivitiesTab', () => ({
  __esModule: true,
  default: () => <div data-testid="activities-tab" />,
}))

function buildCommunity(overrides: Record<string, unknown> = {}) {
  return {
    id: 'comm-1',
    name: 'Hawthorne Mutual Aid',
    description: 'Neighbours helping neighbours',
    current_members: 12,
    max_members: 50,
    access_type: 'public',
    creator_id: 'admin-1',
    creator_name: 'Ada Admin',
    status: 'active',
    community_type: 'mutual_aid',
    members: [
      { id: 'm-admin', user_id: 'admin-1', user_name: 'Ada Admin', role: 'admin', status: 'active' },
      { id: 'm-pending', user_id: 'pending-1', user_name: 'Pat Pending', role: 'member', status: 'pending' },
    ],
    ...overrides,
  }
}

let communityDataOverride: Record<string, unknown> = {}
jest.mock('@/hooks/useCommunityData', () => ({
  useCommunityData: () => ({
    community: buildCommunity(),
    loading: false,
    error: '',
    currentUser: { id: 'admin-1' },
    norms: [],
    config: null,
    settings: null,
    stats: null,
    loadingStats: false,
    communityTrust: null,
    loadingTrust: false,
    networkMetrics: null,
    communityRequests: [],
    loadingRequests: false,
    memberTrustScores: {},
    communityCollectives: [],
    refetchCommunity: jest.fn(),
    refetchNorms: jest.fn(),
    refetchStats: jest.fn(),
    refetchCommunityTrust: jest.fn(),
    refetchNetworkMetrics: jest.fn(),
    refetchCommunityRequests: jest.fn(),
    refetchMemberTrustScores: jest.fn(),
    refetchCommunityCollectives: jest.fn(),
    ...communityDataOverride,
  }),
}))

jest.mock('@/hooks/useCommunityPulse', () => ({
  useCommunityPulse: () => ({
    pulse: { helpedThisWeek: 3, openAsks: 5, timeSensitive: 1, recentJoins: 2, recentHelpers: [], windowDays: 7 },
    loading: false,
    error: null,
  }),
}))

const source = (relativePath: string) =>
  fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8')

function renderPage() {
  const CommunityDetailPage = require('@/pages/communities/[id]').default
  return render(<CommunityDetailPage />)
}

describe('Sprint 105 community polish', () => {
  beforeEach(() => {
    communityDataOverride = {}
    mockRouter.query = { id: 'comm-1' }
    localStorage.setItem('token', 'fake-jwt')
  })

  it('keeps pending tab state accessible instead of color-only', () => {
    renderPage()

    expect(screen.getByRole('button', { name: /People, 1 pending member request/i })).toBeInTheDocument()
  })

  it('uses semantic error styling on the community error state', () => {
    const page = source('src/pages/communities/[id].tsx')

    expect(page).not.toMatch(/text-red-500|bg-red-500/)
    expect(page).toMatch(/text-error|bg-error-light|border-error/)
  })

  it('keeps the existing warm community tab IA intact', () => {
    renderPage()

    expect(screen.getByRole('button', { name: /^Home$/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /People/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /How we're connected/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^Stewardship$/i })).toBeInTheDocument()
  })
})
