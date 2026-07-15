/**
 * Sprint 119 — the community DETAIL page's join button gets the same first-join arrival the
 * communities index got in S118 (ADR-085): a member's FIRST public join routes to /welcome with
 * arrival context. Gates: no memberships yet AND never onboarded (user-scoped key AND legacy
 * global key both absent). The onboarded key is never pre-set here — /welcome owns it.
 */
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'

const mockRouter = {
  query: { id: 'comm-1' } as Record<string, unknown>,
  pathname: '/communities/[id]',
  push: jest.fn(),
  replace: jest.fn(),
}
jest.mock('next/router', () => ({ useRouter: () => mockRouter }))

jest.mock('@/lib/api', () => ({
  communityService: {
    joinCommunity: jest.fn(),
  },
}))

const COMMUNITY = {
  id: 'comm-1',
  name: 'Berkeley Community Care',
  description: 'Neighbours helping neighbours',
  location: 'Berkeley',
  category: 'Neighborhood',
  current_members: 12,
  max_members: 50,
  access_type: 'public' as const,
  creator_name: 'Ada Admin',
  created_at: '2026-01-01',
  members: [],
}

const mockCommunityData = {
  community: COMMUNITY,
  loading: false,
  error: null,
  currentUser: { id: 'user-1', name: 'Nova New', communities: [] as unknown[] },
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
}

jest.mock('@/hooks/useCommunityData', () => ({
  useCommunityData: () => mockCommunityData,
}))
jest.mock('@/hooks/useCommunityPulse', () => ({
  useCommunityPulse: () => ({ pulse: null, loading: false }),
}))

jest.mock('@/components/Layout', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))
jest.mock('@/components/ActivitiesTab', () => ({ __esModule: true, default: () => null }))
jest.mock('@/components/community/CommunityPulse', () => ({ __esModule: true, default: () => null }))
jest.mock('@/components/community/tabs/BrowseTab', () => ({ __esModule: true, default: () => null }))
jest.mock('@/components/community/tabs/ActiveTab', () => ({ __esModule: true, default: () => null }))
jest.mock('@/components/community/tabs/TrustGraphTab', () => ({ __esModule: true, default: () => null }))
jest.mock('@/components/community/tabs/StewardshipTab', () => ({ __esModule: true, default: () => null }))

const { communityService } = require('@/lib/api')

import React from 'react'
import CommunityDetailPage from '../../src/pages/communities/[id]'

const ARRIVAL_KEY = 'karmyq_arrival'
const USER_ONBOARDED_KEY = 'karmyq_onboarded:user-1'

async function clickJoin() {
  render(<CommunityDetailPage />)
  const joinButton = await screen.findByRole('button', { name: /join community/i })
  await act(async () => {
    fireEvent.click(joinButton)
  })
}

describe('Sprint 119: community detail page first-join arrival', () => {
  let alertSpy: jest.SpyInstance

  beforeEach(() => {
    jest.clearAllMocks()
    localStorage.clear()
    sessionStorage.clear()
    localStorage.setItem('token', 'not-a-decodable-jwt')
    localStorage.setItem('user', JSON.stringify({ id: 'user-1', name: 'Nova New', communities: [] }))
    mockCommunityData.currentUser = { id: 'user-1', name: 'Nova New', communities: [] }
    communityService.joinCommunity.mockResolvedValue({ data: { token: undefined } })
    alertSpy = jest.spyOn(window, 'alert').mockImplementation(() => {})
  })

  afterEach(() => {
    alertSpy.mockRestore()
  })

  it('routes the first public join to /welcome with arrival context and does NOT pre-set any onboarded key', async () => {
    await clickJoin()

    await waitFor(() => expect(mockRouter.push).toHaveBeenCalledWith('/welcome'))

    const arrival = JSON.parse(sessionStorage.getItem(ARRIVAL_KEY) || '{}')
    expect(arrival).toMatchObject({
      path: 'open',
      userId: 'user-1',
      communityId: 'comm-1',
      communityName: 'Berkeley Community Care',
    })
    expect(localStorage.getItem('karmyq_onboarded')).toBeNull()
    expect(localStorage.getItem(USER_ONBOARDED_KEY)).toBeNull()
  })

  it('keeps current behavior when the USER-SCOPED onboarded key is present', async () => {
    localStorage.setItem(USER_ONBOARDED_KEY, '1')

    await clickJoin()

    await waitFor(() => expect(mockCommunityData.refetchCommunity).toHaveBeenCalled())
    expect(mockRouter.push).not.toHaveBeenCalledWith('/welcome')
    expect(sessionStorage.getItem(ARRIVAL_KEY)).toBeNull()
  })

  it('keeps current behavior when the LEGACY global onboarded key is present', async () => {
    localStorage.setItem('karmyq_onboarded', '1')

    await clickJoin()

    await waitFor(() => expect(mockCommunityData.refetchCommunity).toHaveBeenCalled())
    expect(mockRouter.push).not.toHaveBeenCalledWith('/welcome')
    expect(sessionStorage.getItem(ARRIVAL_KEY)).toBeNull()
  })

  it('keeps current behavior when the member already belongs to a community', async () => {
    mockCommunityData.currentUser = {
      id: 'user-1',
      name: 'Nova New',
      communities: [{ id: 'comm-0', name: 'Elsewhere', role: 'member' }],
    }

    await clickJoin()

    await waitFor(() => expect(mockCommunityData.refetchCommunity).toHaveBeenCalled())
    expect(mockRouter.push).not.toHaveBeenCalledWith('/welcome')
    expect(sessionStorage.getItem(ARRIVAL_KEY)).toBeNull()
  })

  it('a failed join writes no arrival context and does not route', async () => {
    communityService.joinCommunity.mockRejectedValue({
      response: { data: { message: 'nope' } },
    })

    await clickJoin()

    expect(mockRouter.push).not.toHaveBeenCalledWith('/welcome')
    expect(sessionStorage.getItem(ARRIVAL_KEY)).toBeNull()
    expect(mockCommunityData.refetchCommunity).not.toHaveBeenCalled()
  })
})
