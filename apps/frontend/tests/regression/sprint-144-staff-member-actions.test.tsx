/**
 * Sprint 144 — staff member actions on the web.
 *
 * Reject moves from the admin-only DELETE (which 403'd for moderators) to the staff PUT
 * `{ status: 'inactive' }`; both PUT callers stop sending the ignored `admin_user_id` (the server's
 * D1 body check allows exactly one of role/status). A pending applicant gets **Cancel request**,
 * which reuses the existing self-DELETE (Sprint 143: pending → left, no token).
 */
import React from 'react'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { communityService } from '@/lib/api'
import ActiveTab from '@/components/community/tabs/ActiveTab'
import CommunityHero from '@/components/community/CommunityHero'
import CommunityDetailPage from '@/pages/communities/[id]'

const mockRouter = { query: { id: 'community-1' }, pathname: '/communities/[id]', push: jest.fn(), replace: jest.fn() }
jest.mock('next/router', () => ({ useRouter: () => mockRouter }))
jest.mock('@/lib/api', () => ({
  communityService: {
    joinCommunity: jest.fn(),
    leaveCommunity: jest.fn(),
    updateMember: jest.fn(),
    removeMember: jest.fn(),
  },
}))
jest.mock('@/hooks/usePlatformAdmin', () => ({ usePlatformAdmin: () => ({ platformAdmin: false }) }))
jest.mock('@/components/Layout', () => ({ __esModule: true, default: ({ children }: any) => <div>{children}</div> }))
jest.mock('@/components/ActivitiesTab', () => ({ __esModule: true, default: () => null }))
jest.mock('@/components/community/CommunityPulse', () => ({ __esModule: true, default: () => null }))
jest.mock('@/components/community/tabs/BrowseTab', () => ({ __esModule: true, default: () => null }))
jest.mock('@/components/community/tabs/TrustGraphTab', () => ({ __esModule: true, default: () => null }))
jest.mock('@/components/community/tabs/StewardshipTab', () => ({ __esModule: true, default: () => null }))
jest.mock('@/hooks/useCommunityPulse', () => ({ useCommunityPulse: () => ({ pulse: null, loading: false }) }))

const mockData = {
  community: {
    id: 'community-1', name: 'Neighbourhood Care', description: 'Help nearby', current_members: 4,
    max_members: 50, access_type: 'private', creator_id: 'admin-1', community_type: 'mutual_aid',
    members: [] as any[],
  },
  loading: false,
  error: null,
  currentUser: { id: 'applicant-1', name: 'Applicant', communities: [] } as any,
  norms: [], config: null, settings: null, stats: null, loadingStats: false,
  communityTrust: null, loadingTrust: false, networkMetrics: null,
  communityRequests: [], loadingRequests: false, communityCollectives: [],
  refetchCommunity: jest.fn(), refetchNorms: jest.fn(), refetchConfig: jest.fn(), refetchStats: jest.fn(),
  refetchCommunityTrust: jest.fn(), refetchNetworkMetrics: jest.fn(), refetchCommunityRequests: jest.fn(),
  refetchCommunityCollectives: jest.fn(),
}
jest.mock('@/hooks/useCommunityData', () => ({ useCommunityData: () => mockData }))

const api = communityService as unknown as Record<'joinCommunity' | 'leaveCommunity' | 'updateMember' | 'removeMember', jest.Mock>
let confirmSpy: jest.SpyInstance
let alertSpy: jest.SpyInstance

beforeEach(() => {
  jest.clearAllMocks()
  localStorage.clear()
  mockData.currentUser = { id: 'applicant-1', name: 'Applicant', communities: [] }
  mockData.community.members = []
  confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(true)
  alertSpy = jest.spyOn(window, 'alert').mockImplementation(() => {})
})
afterEach(() => { confirmSpy.mockRestore(); alertSpy.mockRestore() })

describe('Sprint 144 ActiveTab staff actions use the staff PUT', () => {
  const staffCommunity: any = {
    id: 'comm-1', name: 'C', creator_id: 'admin-1', current_members: 2,
    members: [
      { id: 'm1', user_id: 'admin-1', user_name: 'Ada Admin', role: 'admin', status: 'active', joined_at: '2026-01-01' },
      { id: 'm2', user_id: 'member-1', user_name: 'Mem Ber', role: 'member', status: 'active', joined_at: '2026-01-02' },
      { id: 'm3', user_id: 'pend-1', user_name: 'Pat Pending', role: 'member', status: 'pending', joined_at: '2026-01-03' },
    ],
  }
  const refetch = jest.fn()
  const renderAs = (isAdmin: boolean) => render(
    <ActiveTab
      community={staffCommunity} norms={[]} currentUser={{ id: isAdmin ? 'admin-1' : 'mod-1' }}
      isAdmin={isAdmin} isAdminOrMod isMember communityId="comm-1"
      refetchCommunity={refetch} refetchNorms={jest.fn()}
    />,
  )

  it.each([true, false])('rejects through the PUT with exactly { status: inactive } (admin=%s), never the DELETE', async (isAdmin) => {
    api.updateMember.mockResolvedValue({})
    renderAs(isAdmin)
    fireEvent.click(screen.getByRole('button', { name: 'Reject' }))
    await waitFor(() => expect(api.updateMember).toHaveBeenCalledWith('comm-1', 'pend-1', { status: 'inactive' }))
    expect(api.removeMember).not.toHaveBeenCalled()
    await waitFor(() => expect(refetch).toHaveBeenCalled())
  })

  it('approves with exactly { status: active }', async () => {
    api.updateMember.mockResolvedValue({})
    renderAs(false)
    fireEvent.click(screen.getByRole('button', { name: 'Approve' }))
    await waitFor(() => expect(api.updateMember).toHaveBeenCalledWith('comm-1', 'pend-1', { status: 'active' }))
  })

  it('changes a role with exactly { role }', async () => {
    api.updateMember.mockResolvedValue({})
    renderAs(true)
    const memberRow = screen.getByText('Mem Ber').closest('tr')!
    fireEvent.change(memberRow.querySelector('select')!, { target: { value: 'moderator' } })
    await waitFor(() => expect(api.updateMember).toHaveBeenCalledWith('comm-1', 'member-1', { role: 'moderator' }))
  })

  it.each([
    ['the server message', { response: { data: { message: 'Moderators can only approve or reject join requests' } } },
      'Moderators can only approve or reject join requests'],
    ['the fallback text', new Error('network'), 'Failed to reject member'],
  ])('shows %s when a reject fails', async (_label, failure, shown) => {
    api.updateMember.mockRejectedValue(failure)
    renderAs(false)
    fireEvent.click(screen.getByRole('button', { name: 'Reject' }))
    await waitFor(() => expect(alertSpy).toHaveBeenCalledWith(shown))
  })
})

describe('Sprint 144 CommunityHero Cancel request', () => {
  const heroCommunity: any = { id: 'c1', name: 'Hero Co', current_members: 3, max_members: 50, access_type: 'private', members: [] }
  const hero = (props: Partial<React.ComponentProps<typeof CommunityHero>>) => render(
    <CommunityHero community={heroCommunity} isMember={false} isPending={false} isAdmin={false}
      joiningCommunity={false} onJoin={jest.fn()} {...props} />,
  )

  it('shows Cancel request in the pending badge when a handler is given, and calls it', () => {
    const onCancelRequest = jest.fn()
    hero({ isPending: true, onCancelRequest })
    expect(screen.getByText(/Join Request Pending/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Cancel request' }))
    expect(onCancelRequest).toHaveBeenCalledTimes(1)
  })

  it('disables Cancel request while a membership call is in flight', () => {
    hero({ isPending: true, onCancelRequest: jest.fn(), joiningCommunity: true })
    expect(screen.getByRole('button', { name: /Cancel/ })).toBeDisabled()
  })

  it.each([
    ['a pending applicant without a handler', { isPending: true }],
    ['a member', { isMember: true, onCancelRequest: jest.fn() }],
    ['a visitor', { onCancelRequest: jest.fn() }],
  ])('hides Cancel request for %s', (_label, props) => {
    hero(props as any)
    expect(screen.queryByRole('button', { name: 'Cancel request' })).not.toBeInTheDocument()
  })
})

describe('Sprint 144 community page cancels a pending join request', () => {
  const pending = () => {
    mockData.community.members = [{ user_id: 'applicant-1', user_name: 'Applicant', role: 'member', status: 'pending' }]
  }

  it('confirms, calls the self-DELETE for the current user and refetches', async () => {
    pending()
    api.leaveCommunity.mockResolvedValue({ data: {} })
    render(<CommunityDetailPage />)
    fireEvent.click(await screen.findByRole('button', { name: 'Cancel request' }))
    await act(async () => {})
    expect(confirmSpy).toHaveBeenCalledWith('Cancel your join request?')
    await waitFor(() => expect(api.leaveCommunity).toHaveBeenCalledWith('community-1', 'applicant-1'))
    await waitFor(() => expect(mockData.refetchCommunity).toHaveBeenCalled())
    expect(localStorage.getItem('token')).toBeNull()
  })

  it('makes no call when the confirmation is declined', async () => {
    pending()
    confirmSpy.mockReturnValue(false)
    render(<CommunityDetailPage />)
    fireEvent.click(await screen.findByRole('button', { name: 'Cancel request' }))
    expect(api.leaveCommunity).not.toHaveBeenCalled()
    expect(mockData.refetchCommunity).not.toHaveBeenCalled()
  })

  it.each([
    ['the server message', { response: { data: { message: 'Only active or pending memberships can be left directly' } } },
      'Only active or pending memberships can be left directly'],
    ['the fallback text', new Error('network'), 'Failed to cancel join request'],
  ])('shows %s when cancelling fails', async (_label, failure, shown) => {
    pending()
    api.leaveCommunity.mockRejectedValue(failure)
    render(<CommunityDetailPage />)
    fireEvent.click(await screen.findByRole('button', { name: 'Cancel request' }))
    await waitFor(() => expect(alertSpy).toHaveBeenCalledWith(shown))
  })

  it('offers no Cancel request to a visitor or an active member', async () => {
    render(<CommunityDetailPage />)
    await screen.findByText('Neighbourhood Care')
    expect(screen.queryByRole('button', { name: 'Cancel request' })).not.toBeInTheDocument()
  })
})
