/**
 * Sprint 89 / ADR-068 — Community page information architecture.
 *
 * Locks the warm four-tab model: every legacy deep link resolves into the new model (no dead ends),
 * Home is the default surface for EVERY role (the headline bug — the warm feed used to be admin-
 * gated), the admin steward-request manager is NOT on Home (it moved under Stewardship), and the
 * CommunityPulse renders real rows while suppressing zero rows.
 */

import { render, screen } from '@testing-library/react'
import { resolveCommunityTab, VALID_TABS } from '@/lib/communityTabs'
import CommunityPulse from '@/components/community/CommunityPulse'

// ── Mocks: keep the page render light + deterministic ───────────────────────────────────────────
const mockRouter = {
  query: { id: 'comm-1' } as Record<string, unknown>,
  pathname: '/communities/[id]',
  push: jest.fn(),
  replace: jest.fn(),
}
jest.mock('next/router', () => ({ useRouter: () => mockRouter }))

jest.mock('@/components/Feed/UnifiedFeed', () => ({
  __esModule: true,
  default: (props: any) => <div data-testid="unified-feed">Unified feed {props.view}</div>,
}))

jest.mock('@/components/Layout', () => ({
  __esModule: true,
  default: ({ children }: any) => <div>{children}</div>,
}))

// Non-Home tab surfaces are heavy (d3 graph, governance, admin panels) and aren't rendered on Home;
// stub them so requiring the page doesn't pull untransformed ESM (d3) into jest.
jest.mock('@/components/community/tabs/TrustGraphTab', () => ({ __esModule: true, default: () => <div data-testid="trust-graph-tab" /> }))
jest.mock('@/components/community/tabs/StewardshipTab', () => ({ __esModule: true, default: () => <div data-testid="stewardship-tab" /> }))
jest.mock('@/components/community/tabs/ActiveTab', () => ({ __esModule: true, default: () => <div data-testid="people-tab" /> }))
jest.mock('@/components/ActivitiesTab', () => ({ __esModule: true, default: () => <div data-testid="activities-tab" /> }))

const baseMembers = [
  { id: 'm-admin', user_id: 'admin-1', user_name: 'Ada Admin', user_email: 'ada@x.com', role: 'admin', status: 'active', joined_at: '2024-01-01' },
  { id: 'm-member', user_id: 'member-1', user_name: 'Mo Member', user_email: 'mo@x.com', role: 'member', status: 'active', joined_at: '2024-01-02' },
]

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
    members: baseMembers,
    ...overrides,
  }
}

let communityDataOverride: Record<string, unknown> = {}
jest.mock('@/hooks/useCommunityData', () => ({
  useCommunityData: () => ({
    community: buildCommunity(),
    loading: false,
    error: '',
    currentUser: { id: 'member-1' },
    norms: [], config: null, settings: null, stats: null, loadingStats: false,
    communityTrust: null, loadingTrust: false, networkMetrics: null,
    communityRequests: [], loadingRequests: false, memberTrustScores: {}, communityCollectives: [],
    refetchCommunity: jest.fn(), refetchNorms: jest.fn(), refetchStats: jest.fn(),
    refetchCommunityTrust: jest.fn(), refetchNetworkMetrics: jest.fn(),
    refetchCommunityRequests: jest.fn(), refetchMemberTrustScores: jest.fn(),
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

function renderPage() {
  const CommunityDetailPage = require('@/pages/communities/[id]').default
  return render(<CommunityDetailPage />)
}

beforeEach(() => {
  communityDataOverride = {}
  mockRouter.query = { id: 'comm-1' }
  window.localStorage.setItem('token', 'fake-jwt')
})

// ── Deep-link resolver: every legacy alias maps into the four-tab model ──────────────────────────
describe('resolveCommunityTab (deep-link preservation)', () => {
  it('maps every legacy alias into the warm four-tab model', () => {
    // Home
    expect(resolveCommunityTab('overview')).toBe('home')
    expect(resolveCommunityTab('requests')).toBe('home')
    // How we're connected
    expect(resolveCommunityTab('trust')).toBe('connected')
    // Stewardship (governance / split / fusion + admin settings/providers + insights/export)
    expect(resolveCommunityTab('governance')).toBe('stewardship')
    expect(resolveCommunityTab('fission')).toBe('stewardship')
    expect(resolveCommunityTab('fusion')).toBe('stewardship')
    expect(resolveCommunityTab('settings')).toBe('stewardship')
    expect(resolveCommunityTab('config')).toBe('stewardship')
    expect(resolveCommunityTab('links')).toBe('stewardship')
    expect(resolveCommunityTab('providers')).toBe('stewardship')
    expect(resolveCommunityTab('stats')).toBe('stewardship')
    expect(resolveCommunityTab('insights')).toBe('stewardship')
    expect(resolveCommunityTab('export')).toBe('stewardship')
    // People
    expect(resolveCommunityTab('manage')).toBe('people')
    expect(resolveCommunityTab('pending')).toBe('people')
    expect(resolveCommunityTab('members')).toBe('people')
    expect(resolveCommunityTab('norms')).toBe('people')
    // Identity: canonical tabs resolve to themselves
    expect(resolveCommunityTab('home')).toBe('home')
    expect(resolveCommunityTab('people')).toBe('people')
    expect(resolveCommunityTab('connected')).toBe('connected')
    expect(resolveCommunityTab('stewardship')).toBe('stewardship')
    expect(resolveCommunityTab('activities')).toBe('activities')
  })

  it('falls back to Home for unknown tabs', () => {
    expect(resolveCommunityTab('nonsense')).toBe('home')
    expect(resolveCommunityTab(undefined)).toBe('home')
  })

  it('exposes exactly the canonical tab set', () => {
    expect(VALID_TABS).toEqual(['home', 'people', 'connected', 'stewardship', 'activities'])
  })
})

// ── Page IA: default Home for all roles, four warm tabs, no steward manager on Home ──────────────
describe('Community page information architecture', () => {
  it('lands a member on warm Home with the member feed (the previously admin-gated surface)', () => {
    communityDataOverride = { currentUser: { id: 'member-1' } }
    renderPage()
    expect(screen.getByTestId('unified-feed')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^Home$/i })).toBeInTheDocument()
  })

  it('lands an admin on warm Home too — NOT on the management surface', () => {
    communityDataOverride = { currentUser: { id: 'admin-1' } }
    renderPage()
    // Admin still sees the warm member feed on Home...
    expect(screen.getByTestId('unified-feed')).toBeInTheDocument()
    // ...but the steward-request manager is NOT on Home (it moved under Stewardship).
    expect(screen.queryByRole('heading', { name: /Steward requests/i })).not.toBeInTheDocument()
  })

  it('shows exactly the four warm tabs for a mutual_aid community', () => {
    renderPage()
    expect(screen.getByRole('button', { name: /^Home$/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^People$/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /How we're connected/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^Stewardship$/i })).toBeInTheDocument()
    // Activities is group-only — absent for mutual_aid.
    expect(screen.queryByRole('button', { name: /^Activities$/i })).not.toBeInTheDocument()
  })

  it('adds Activities as a fifth tab only for group communities', () => {
    communityDataOverride = { community: buildCommunity({ community_type: 'group' }) }
    renderPage()
    expect(screen.getByRole('button', { name: /^Activities$/i })).toBeInTheDocument()
  })
})

// ── Pulse rendering: real rows shown, zero rows suppressed ───────────────────────────────────────
describe('CommunityPulse', () => {
  it('renders rows with meaningful data', () => {
    render(
      <CommunityPulse
        pulse={{ helpedThisWeek: 3, openAsks: 5, timeSensitive: 2, recentJoins: 4, recentHelpers: [], windowDays: 7 }}
        loading={false}
      />,
    )
    expect(screen.getByText(/3/)).toBeInTheDocument()
    expect(screen.getByText(/neighbours helped|helped/i)).toBeInTheDocument()
    expect(screen.getByText(/5/)).toBeInTheDocument()
  })

  it('suppresses a zero row instead of showing "0 helped"', () => {
    render(
      <CommunityPulse
        pulse={{ helpedThisWeek: 0, openAsks: 5, timeSensitive: 0, recentJoins: 0, recentHelpers: [], windowDays: 7 }}
        loading={false}
      />,
    )
    expect(screen.queryByText(/0 neighbours helped|0 helped/i)).not.toBeInTheDocument()
    // The open-asks row with real data still renders.
    expect(screen.getByText(/5/)).toBeInTheDocument()
  })
})
