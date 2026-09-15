/**
 * Sprint 129 PR C — BUG-031: community-trust denial is an empty state, not a 404.
 *
 * reputation-service now answers a denied aggregate (unknown community, non-member, undersized
 * cohort — indistinguishably) with `200 { success: true, data: null }`. The api client's interceptor
 * unwraps the envelope, so a consumer sees `response.data === null` for a denial and
 * `response.data === <score row>` when permitted.
 *
 * Both call sites must treat null as "no badge / no panel" without logging, and the /communities
 * page must actually SHOW the badge when a score exists (on the joined chips since Sprint 130) — it used to read `response.data.data.score`,
 * which is always undefined after the unwrap, so the badge never rendered for anyone.
 */
import { render, screen, waitFor, act, renderHook, within } from '@testing-library/react'

jest.mock('@/lib/api', () => ({
  communityService: {
    getCommunities: jest.fn(),
    getCommunityTags: jest.fn(),
    getCommunity: jest.fn(),
    getNorms: jest.fn(),
    getConfig: jest.fn(),
    getSettings: jest.fn(),
  },
  // Imported by useCommunityData but never called on the trust path.
  requestService: {},
  collectiveService: {},
  reputationService: { getCommunityTrust: jest.fn() },
}))
jest.mock('@/components/Layout', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))
jest.mock('@/components/OnboardingOverlay', () => ({ __esModule: true, default: () => null }))
jest.mock('@/hooks/useOnboarding', () => ({
  useOnboarding: () => ({ shouldShow: false, markSeen: jest.fn() }),
}))
jest.mock('@/components/DiscoveryToggle', () => ({
  __esModule: true,
  default: () => null,
  // Trust-badge cases only; the real toggle's mode handling is covered by sprint-130-reputation-fanout.
  readDiscoveryMode: () => 'geography',
}))

const { communityService, reputationService } = require('@/lib/api')

import CommunitiesPage from '../../src/pages/communities/index'
import { useCommunityData } from '../../src/hooks/useCommunityData'

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

const PERMITTED = card('comm-permitted', 'Maplewood Mutual Aid')
const DENIED = card('comm-denied', 'Riverside Helpers')
const DISCOVERY = card('comm-discovery', 'Oakland Tool Library')
const SCORE_ROW = { community_id: PERMITTED.id, score: 62, member_quality_score: 30, bonding_score: 20 }

let consoleError: jest.SpyInstance

beforeEach(() => {
  jest.clearAllMocks()
  localStorage.clear()
  localStorage.setItem('token', 'not-a-decodable-jwt')
  localStorage.setItem('user', JSON.stringify({ id: 'user-1', name: 'Maria', communities: [] }))
  communityService.getCommunityTags.mockResolvedValue({ data: { tags: [] } })
  communityService.getCommunities.mockResolvedValue({
    data: { communities: [PERMITTED, DENIED], fallback: false },
  })
  // Post-interceptor shapes: the row when permitted, null when denied.
  reputationService.getCommunityTrust.mockImplementation((id: string) =>
    Promise.resolve({ data: id === PERMITTED.id ? SCORE_ROW : null }),
  )
  consoleError = jest.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => consoleError.mockRestore())

describe('/communities trust badges', () => {
  // Sprint 130 (BUG-044): the badge moved to the "Your Communities" chips. The original cases mocked
  // a score for a discovery card, which a member can never be given, so the fixture was unreachable.
  // Both communities are now JOINED (they come from user.communities) and the grid holds a third.
  beforeEach(() => {
    localStorage.setItem('user', JSON.stringify({
      id: 'user-1',
      name: 'Maria',
      communities: [
        { id: PERMITTED.id, name: PERMITTED.name, role: 'member' },
        { id: DENIED.id, name: DENIED.name, role: 'member' },
      ],
    }))
    communityService.getCommunities.mockResolvedValue({
      data: { communities: [PERMITTED, DENIED, DISCOVERY], fallback: false },
    })
  })

  it('shows the badge on a joined chip with a score and none on a denied one', async () => {
    render(<CommunitiesPage />)

    const chips = await screen.findByTestId('your-communities')
    expect(await within(chips).findByText('★ 62% trust')).toBeInTheDocument()
    expect(within(chips).getByRole('link', { name: /Riverside Helpers/ })).not.toHaveTextContent('% trust')
    expect(screen.getAllByText(/% trust/)).toHaveLength(1)
  })

  it('asks once per joined community and logs nothing for a denied aggregate', async () => {
    render(<CommunitiesPage />)

    await screen.findByText('★ 62% trust')
    await screen.findByText(DISCOVERY.name)
    expect(reputationService.getCommunityTrust.mock.calls.map((c: string[]) => c[0]).sort())
      .toEqual([DENIED.id, PERMITTED.id].sort())
    expect(consoleError).not.toHaveBeenCalled()
  })

  it('renders no badge when every aggregate is denied', async () => {
    reputationService.getCommunityTrust.mockResolvedValue({ data: null })
    render(<CommunitiesPage />)

    await screen.findByText(DISCOVERY.name)
    // Wait for both fetches to settle before asserting that nothing rendered.
    await waitFor(() => expect(reputationService.getCommunityTrust).toHaveBeenCalledTimes(2))
    await act(async () => { await Promise.resolve() })
    expect(screen.queryByText(/% trust/)).toBeNull()
    expect(consoleError).not.toHaveBeenCalled()
  })
})

describe('useCommunityData community trust', () => {
  it('exposes a denied aggregate as null, so the steward trust panel stays hidden', async () => {
    const { result } = renderHook(() => useCommunityData(DENIED.id))
    await act(async () => { await result.current.refetchCommunityTrust() })

    expect(reputationService.getCommunityTrust).toHaveBeenCalledWith(DENIED.id)
    expect(result.current.communityTrust).toBeNull()
    expect(result.current.loadingTrust).toBe(false)
  })

  it('exposes a permitted aggregate as the score row itself', async () => {
    const { result } = renderHook(() => useCommunityData(PERMITTED.id))
    await act(async () => { await result.current.refetchCommunityTrust() })

    expect(result.current.communityTrust).toEqual(SCORE_ROW)
  })
})
