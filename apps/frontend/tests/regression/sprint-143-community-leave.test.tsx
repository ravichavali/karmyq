import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import CommunityDetailPage from '@/pages/communities/[id]';
import { communityService } from '@/lib/api';

const mockRouter = { query: { id: 'community-1' }, pathname: '/communities/[id]', push: jest.fn(), replace: jest.fn() };
jest.mock('next/router', () => ({ useRouter: () => mockRouter }));
jest.mock('@/lib/api', () => ({ communityService: { joinCommunity: jest.fn(), leaveCommunity: jest.fn() } }));
jest.mock('@/hooks/usePlatformAdmin', () => ({ usePlatformAdmin: () => ({ platformAdmin: false }) }));
jest.mock('@/components/Layout', () => ({ __esModule: true, default: ({ children }: any) => <div>{children}</div> }));
jest.mock('@/components/ActivitiesTab', () => ({ __esModule: true, default: () => null }));
jest.mock('@/components/community/CommunityPulse', () => ({ __esModule: true, default: () => null }));
jest.mock('@/components/community/tabs/BrowseTab', () => ({ __esModule: true, default: () => null }));
jest.mock('@/components/community/tabs/ActiveTab', () => ({ __esModule: true, default: () => null }));
jest.mock('@/components/community/tabs/TrustGraphTab', () => ({ __esModule: true, default: () => null }));
jest.mock('@/components/community/tabs/StewardshipTab', () => ({ __esModule: true, default: () => null }));
jest.mock('@/hooks/useCommunityPulse', () => ({ useCommunityPulse: () => ({ pulse: null, loading: false }) }));

const mockData = {
  community: {
    id: 'community-1', name: 'Neighbourhood Care', description: 'Help nearby', current_members: 4,
    max_members: 50, access_type: 'public', creator_id: 'admin-1', community_type: 'mutual_aid',
    members: [] as any[],
  },
  loading: false,
  error: null,
  currentUser: { id: 'member-1', name: 'Member', communities: [{ id: 'community-1', role: 'member' }] } as any,
  norms: [], config: null, settings: null, stats: null, loadingStats: false,
  communityTrust: null, loadingTrust: false, networkMetrics: null,
  communityRequests: [], loadingRequests: false, communityCollectives: [],
  refetchCommunity: jest.fn(), refetchNorms: jest.fn(), refetchConfig: jest.fn(), refetchStats: jest.fn(),
  refetchCommunityTrust: jest.fn(), refetchNetworkMetrics: jest.fn(), refetchCommunityRequests: jest.fn(),
  refetchCommunityCollectives: jest.fn(),
};
jest.mock('@/hooks/useCommunityData', () => ({ useCommunityData: () => mockData }));

const leave = communityService.leaveCommunity as jest.Mock;
const join = communityService.joinCommunity as jest.Mock;
let confirmSpy: jest.SpyInstance;
let alertSpy: jest.SpyInstance;

function membership(status?: string) {
  mockData.community.members = status ? [{ user_id: 'member-1', user_name: 'Member', role: 'member', status }] : [];
}
function tokenWithCommunities(communities: unknown[]) {
  return `header.${Buffer.from(JSON.stringify({ communities })).toString('base64url')}.signature`;
}

beforeEach(() => {
  jest.clearAllMocks();
  localStorage.clear();
  localStorage.setItem('token', 'old-token');
  localStorage.setItem('user', JSON.stringify(mockData.currentUser));
  mockData.currentUser = { id: 'member-1', name: 'Member', communities: [{ id: 'community-1', role: 'member' }] };
  membership('active');
  confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(true);
  alertSpy = jest.spyOn(window, 'alert').mockImplementation(() => {});
});

afterEach(() => { confirmSpy.mockRestore(); alertSpy.mockRestore(); });

it.each([
  ['active', null, true],
  ['pending', null, false],
  [undefined, null, false],
  ['active', 'logged-out', false],
])('shows Leave only for an active authenticated member: %s %s', async (status, loggedOut, visible) => {
  membership(status);
  if (loggedOut) mockData.currentUser = null;
  render(<CommunityDetailPage />);
  await screen.findByText('Neighbourhood Care');
  expect(Boolean(screen.queryByRole('button', { name: 'Leave community' }))).toBe(visible);
});

it('confirms leave, calls the exact self-delete API, persists the refreshed token and refetches', async () => {
  const token = tokenWithCommunities([]);
  leave.mockResolvedValue({ data: { token } });
  render(<CommunityDetailPage />);
  fireEvent.click(await screen.findByRole('button', { name: 'Leave community' }));
  await act(async () => {});
  await waitFor(() => expect(leave).toHaveBeenCalledWith('community-1', 'member-1'));
  await waitFor(() => expect(mockData.refetchCommunity).toHaveBeenCalled());
  expect(localStorage.getItem('token')).toBe(token);
  expect(JSON.parse(localStorage.getItem('user')!).communities).toEqual([]);
});

it('cancels leave without calling the API', async () => {
  confirmSpy.mockReturnValue(false);
  render(<CommunityDetailPage />);
  fireEvent.click(await screen.findByRole('button', { name: 'Leave community' }));
  expect(leave).not.toHaveBeenCalled();
  expect(mockData.refetchCommunity).not.toHaveBeenCalled();
});

it('shows the last-admin refusal message', async () => {
  leave.mockRejectedValue({ response: { status: 400, data: { message: 'Cannot remove the last admin. Assign another admin first.' } } });
  render(<CommunityDetailPage />);
  fireEvent.click(await screen.findByRole('button', { name: 'Leave community' }));
  await waitFor(() => expect(alertSpy).toHaveBeenCalledWith('Cannot remove the last admin. Assign another admin first.'));
});

it('shows the staff-only rejoin refusal for a removed member', async () => {
  membership();
  join.mockRejectedValue({ response: { status: 409, data: { error: 'MEMBERSHIP_RESTORE_REQUIRES_STAFF', message: 'Only community staff can restore this membership' } } });
  render(<CommunityDetailPage />);
  fireEvent.click(await screen.findByRole('button', { name: 'Join Community' }));
  await waitFor(() => expect(alertSpy).toHaveBeenCalledWith('Only community staff can restore this membership'));
});
