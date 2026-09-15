/**
 * Sprint 130 PR A — stop asking for reputation we can't be given (ADR-082).
 *
 * - BUG-044: /communities asked for the community-trust aggregate of every DISCOVERY card, and a
 *   caller only ever gets an aggregate for a community they belong to, so the badge could never
 *   render there. Trust is now fetched for the joined ids only and badged on "Your Communities".
 * - BUG-043: the real DiscoveryToggle wrote its initial `geography` to storage on mount, before the
 *   page read storage, so a saved "By Interest" was lost on every load. The first list fetch now
 *   waits for the resolved mode, and the toggle persists only a user's choice.
 * - BUG-042: the People tab fetched every member's trust score, which is self-only and denied
 *   for everyone else. The per-member fan-out and its score pill are gone.
 *
 * Fixtures follow the page's real filters: joined ids come from `user.communities`, and the grid is
 * `communities` minus joined (Sprint 129's badge test mocked a card the grid filters out).
 */
import { render, screen, waitFor, act, within, renderHook, fireEvent } from '@testing-library/react'

const mockRouter = {
  query: {} as Record<string, unknown>,
  pathname: '/communities',
  push: jest.fn(),
  replace: jest.fn(),
}
jest.mock('next/router', () => ({ useRouter: () => mockRouter }))

jest.mock('@/lib/api', () => ({
  communityService: {
    getCommunities: jest.fn(),
    getCommunityTags: jest.fn(),
    getCommunity: jest.fn(),
    getNorms: jest.fn(),
    getConfig: jest.fn(),
    getSettings: jest.fn(),
    joinCommunity: jest.fn(),
  },
  requestService: {},
  collectiveService: {},
  reputationService: { getCommunityTrust: jest.fn(), getTrustScore: jest.fn() },
}))
jest.mock('@/components/Layout', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))
jest.mock('@/components/OnboardingOverlay', () => ({ __esModule: true, default: () => null }))
jest.mock('@/hooks/useOnboarding', () => ({
  useOnboarding: () => ({ shouldShow: false, markSeen: jest.fn() }),
}))
// Deliberately NOT mocking @/components/DiscoveryToggle: the mock hid the mount-time overwrite.
// The community detail page runs with its REAL useCommunityData and ActiveTab; only the unrelated
// tabs and surfaces are stubbed.
jest.mock('@/hooks/useCommunityPulse', () => ({
  useCommunityPulse: () => ({ pulse: null, loading: false }),
}))
jest.mock('@/components/ActivitiesTab', () => ({ __esModule: true, default: () => null }))
jest.mock('@/components/community/CommunityHero', () => ({ __esModule: true, default: () => null }))
jest.mock('@/components/community/CommunityPulse', () => ({ __esModule: true, default: () => null }))
jest.mock('@/components/community/tabs/BrowseTab', () => ({ __esModule: true, default: () => null }))
jest.mock('@/components/community/tabs/TrustGraphTab', () => ({ __esModule: true, default: () => null }))
jest.mock('@/components/community/tabs/StewardshipTab', () => ({ __esModule: true, default: () => null }))
jest.mock('@/components/community/tabs/ProvidersTab', () => ({ __esModule: true, default: () => null }))

const { communityService, reputationService } = require('@/lib/api')

import React from 'react'
import CommunitiesPage from '../../src/pages/communities/index'
import CommunityDetailPage from '../../src/pages/communities/[id]'
import ActiveTab from '../../src/components/community/tabs/ActiveTab'
import { useCommunityData } from '../../src/hooks/useCommunityData'

const MODE_KEY = 'community_discovery_mode'

const card = (id: string, name: string) => ({
  id,
  name,
  description: 'Neighbours helping neighbours',
  location: 'Berkeley',
  category: 'Neighborhood',
  current_members: 12,
  max_members: 50,
  access_type: 'public' as const,
  creator_name: 'Ada Admin',
  created_at: '2026-01-01',
  inner_circle_count: 1,
  active_community_count: 1,
  extended_network_count: 1,
})

const J1 = card('comm-j1', 'Maplewood Mutual Aid')
const J2 = { id: 'comm-j2', name: 'Riverside Helpers' }
const D1 = card('comm-d1', 'Oakland Tool Library')
const D2 = card('comm-d2', 'Alameda Food Share')

const USER = {
  id: 'user-1',
  name: 'Maria',
  communities: [
    { id: J1.id, name: J1.name, role: 'member' },
    { id: J2.id, name: J2.name, role: 'member' },
  ],
}

const SCORES: Record<string, number> = { [J1.id]: 62, [D1.id]: 48 }

let consoleError: jest.SpyInstance
const originalGeolocation = Object.getOwnPropertyDescriptor(window.navigator, 'geolocation')

function setGeolocation(value: unknown) {
  Object.defineProperty(window.navigator, 'geolocation', { value, configurable: true })
}

/** Let every pending effect, promise and state update settle. */
async function settle() {
  for (let i = 0; i < 5; i++) {
    await act(async () => { await Promise.resolve() })
  }
}

beforeEach(() => {
  jest.clearAllMocks()
  localStorage.clear()
  mockRouter.query = {}
  localStorage.setItem('token', 'not-a-decodable-jwt')
  localStorage.setItem('user', JSON.stringify(USER))
  communityService.getCommunityTags.mockResolvedValue({ data: { tags: [] } })
  communityService.getCommunities.mockResolvedValue({
    data: { communities: [J1, D1, D2], fallback: false },
  })
  reputationService.getCommunityTrust.mockImplementation((id: string) =>
    Promise.resolve({ data: SCORES[id] != null ? { community_id: id, score: SCORES[id] } : null }),
  )
  setGeolocation(undefined)
  consoleError = jest.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  consoleError.mockRestore()
  if (originalGeolocation) {
    Object.defineProperty(window.navigator, 'geolocation', originalGeolocation)
  } else {
    delete (window.navigator as any).geolocation
  }
})

describe('BUG-044: trust is fetched for joined communities and badged on their chips', () => {
  it('asks only for the joined ids and badges the scored chip', async () => {
    render(<CommunitiesPage />)

    const chips = await screen.findByTestId('your-communities')
    await waitFor(() =>
      expect(within(chips).getByRole('link', { name: /Maplewood Mutual Aid/ })).toHaveTextContent('★ 62% trust'),
    )
    await screen.findByText(D1.name)
    await settle()

    expect(reputationService.getCommunityTrust.mock.calls.map((c: string[]) => c[0]).sort())
      .toEqual([J1.id, J2.id].sort())
    expect(within(chips).getByRole('link', { name: /Riverside Helpers/ })).not.toHaveTextContent('% trust')
    expect(within(chips).getAllByText(/% trust/)).toHaveLength(1)
    // No discovery card carries a badge: the only badge on the page is the chip's.
    expect(screen.getAllByText(/% trust/)).toHaveLength(1)
    expect(consoleError).not.toHaveBeenCalled()
  })

  it('a slow request from before a join cannot wipe the newly joined chip badge', async () => {
    // Round one (before the join) is held open; round two (after the join) answers at once.
    const heldRoundOne: Array<() => void> = []
    let joined = false
    reputationService.getCommunityTrust.mockImplementation((id: string) => {
      const answer = { data: SCORES[id] != null ? { community_id: id, score: SCORES[id] } : null }
      if (joined) return Promise.resolve(answer)
      return new Promise(resolve => heldRoundOne.push(() => resolve(answer)))
    })
    const payload = { communities: [...USER.communities, { id: D1.id, name: D1.name, role: 'member' }] }
    const token = `h.${Buffer.from(JSON.stringify(payload)).toString('base64url')}.s`
    communityService.joinCommunity.mockImplementation(() => {
      joined = true
      return Promise.resolve({ data: { token } })
    })

    render(<CommunitiesPage />)
    await screen.findByText(D1.name)
    await settle()
    expect(heldRoundOne).toHaveLength(2)

    await act(async () => { fireEvent.click(screen.getAllByRole('button', { name: 'Join Community' })[0]) })
    const chips = screen.getByTestId('your-communities')
    await waitFor(() =>
      expect(within(chips).getByRole('link', { name: /Oakland Tool Library/ })).toHaveTextContent('★ 48% trust'),
    )

    // The stale round now lands, and must not overwrite the newer scores.
    await act(async () => { heldRoundOne.forEach(release => release()) })
    await settle()
    expect(within(chips).getByRole('link', { name: /Oakland Tool Library/ })).toHaveTextContent('★ 48% trust')
    expect(within(chips).getByRole('link', { name: /Maplewood Mutual Aid/ })).toHaveTextContent('★ 62% trust')
  })

  it('asks for nothing when the member has joined no community', async () => {
    localStorage.setItem('user', JSON.stringify({ ...USER, communities: [] }))
    render(<CommunitiesPage />)

    await screen.findByText(D1.name)
    await settle()

    expect(reputationService.getCommunityTrust).not.toHaveBeenCalled()
    expect(screen.queryByText(/% trust/)).toBeNull()
  })
})

describe('BUG-043: the saved discovery mode survives mount, and the list is fetched once', () => {
  const selected = (name: RegExp) => screen.getByRole('button', { name }).getAttribute('aria-pressed')

  it('saved interests: storage is kept, By Interest is selected, one unfiltered fetch', async () => {
    localStorage.setItem(MODE_KEY, 'interests')
    render(<CommunitiesPage />)

    await screen.findByText(D1.name)
    await settle()

    expect(localStorage.getItem(MODE_KEY)).toBe('interests')
    expect(selected(/By Interest/)).toBe('true')
    expect(selected(/Near Me/)).toBe('false')
    expect(communityService.getCommunities).toHaveBeenCalledTimes(1)
    // Tags start empty, so the builder sends neither mode nor tags (index.tsx builder).
    const params = communityService.getCommunities.mock.calls[0][0]
    expect(params).not.toHaveProperty('mode')
    expect(params).not.toHaveProperty('tags')
    expect(consoleError).not.toHaveBeenCalled()
  })

  it('saved geography with a position: one fetch carrying the coordinates', async () => {
    localStorage.setItem(MODE_KEY, 'geography')
    setGeolocation({
      getCurrentPosition: (ok: PositionCallback) =>
        ok({ coords: { latitude: 37.87, longitude: -122.27 } } as GeolocationPosition),
    })
    render(<CommunitiesPage />)

    await screen.findByText(D1.name)
    await settle()

    expect(communityService.getCommunities).toHaveBeenCalledTimes(1)
    expect(communityService.getCommunities.mock.calls[0][0]).toMatchObject({
      mode: 'geography',
      lat: 37.87,
      lng: -122.27,
    })
    expect(localStorage.getItem(MODE_KEY)).toBe('geography')
  })

  it('geography without geolocation: one unfiltered fetch', async () => {
    render(<CommunitiesPage />)

    await screen.findByText(D1.name)
    await settle()

    expect(communityService.getCommunities).toHaveBeenCalledTimes(1)
    expect(communityService.getCommunities.mock.calls[0][0]).not.toHaveProperty('mode')
    // Nothing was chosen, so nothing is persisted.
    expect(localStorage.getItem(MODE_KEY)).toBeNull()
  })

  it('geography with location denied: one unfiltered fetch', async () => {
    localStorage.setItem(MODE_KEY, 'geography')
    setGeolocation({
      getCurrentPosition: (_ok: PositionCallback, denied: PositionErrorCallback) =>
        denied({ code: 1, message: 'denied' } as GeolocationPositionError),
    })
    render(<CommunitiesPage />)

    await screen.findByText(D1.name)
    await settle()

    expect(communityService.getCommunities).toHaveBeenCalledTimes(1)
    expect(communityService.getCommunities.mock.calls[0][0]).not.toHaveProperty('mode')
  })

  it('a user choice is persisted', async () => {
    render(<CommunitiesPage />)
    await screen.findByText(D1.name)
    await settle()

    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /By Interest/ })) })
    await settle()

    expect(localStorage.getItem(MODE_KEY)).toBe('interests')
    expect(selected(/By Interest/)).toBe('true')
  })
})

describe('BUG-042: the People tab asks for no member reputation', () => {
  const COMMUNITY = {
    id: 'comm-1',
    name: 'Berkeley Community Care',
    description: 'Neighbours helping neighbours',
    current_members: 2,
    max_members: 50,
    access_type: 'public' as const,
    creator_id: 'user-9',
    creator_name: 'Ada Admin',
    status: 'active',
    members: [
      { id: 'm1', user_id: 'user-1', user_name: 'Maria Reyes', user_email: 'm@example.com', role: 'member', status: 'active', joined_at: '2026-01-01' },
      { id: 'm2', user_id: 'user-2', user_name: 'Sam Lee', user_email: 's@example.com', role: 'admin', status: 'active', joined_at: '2026-01-02' },
    ],
  }

  it('ActiveTab renders members without any score pill', () => {
    render(
      <ActiveTab
        community={COMMUNITY as any}
        norms={[]}
        currentUser={{ id: 'user-1' }}
        isAdmin={false}
        isAdminOrMod={false}
        isMember
        communityId={COMMUNITY.id}
        refetchCommunity={jest.fn()}
        refetchNorms={jest.fn()}
      />,
    )

    expect(screen.getByText('Maria Reyes')).toBeInTheDocument()
    expect(screen.getByText('Sam Lee')).toBeInTheDocument()
    expect(screen.queryByText(/★/)).toBeNull()
  })

  beforeEach(() => {
    communityService.getCommunity.mockResolvedValue({ data: COMMUNITY })
    communityService.getNorms.mockResolvedValue({ data: { norms: [] } })
    communityService.getConfig.mockResolvedValue({ data: { config: null } })
    communityService.getSettings.mockResolvedValue({ data: null })
  })

  it('opening the People tab on the real page reads no trust score', async () => {
    // Open the tab once the community has loaded, as a member does. On a cold ?tab=people load the
    // old fan-out saw no members yet and returned early, which would make this assertion vacuous.
    mockRouter.query = { id: COMMUNITY.id }
    const { rerender } = render(<CommunityDetailPage />)
    await waitFor(() => expect(communityService.getCommunity).toHaveBeenCalledWith(COMMUNITY.id))
    await settle()

    mockRouter.query = { id: COMMUNITY.id, tab: 'people' }
    rerender(<CommunityDetailPage />)

    expect(await screen.findByText('Sam Lee')).toBeInTheDocument()
    await settle()

    expect(reputationService.getTrustScore).not.toHaveBeenCalled()
    expect(screen.queryByText(/★/)).toBeNull()
  })

  it('useCommunityData exposes no member-score fetch and never reads a trust score', async () => {
    const { result } = renderHook(() => useCommunityData(COMMUNITY.id))
    await waitFor(() => expect(result.current.community).toEqual(COMMUNITY))
    await settle()

    expect(result.current).not.toHaveProperty('refetchMemberTrustScores')
    expect(result.current).not.toHaveProperty('memberTrustScores')
    expect(reputationService.getTrustScore).not.toHaveBeenCalled()
  })
})
