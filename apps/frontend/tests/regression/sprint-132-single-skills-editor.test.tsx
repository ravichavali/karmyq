import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';

// The profile effect depends on a stable router object, as the real Next router provides.
jest.mock('next/router', () => {
  const router = { push: jest.fn(), replace: jest.fn(), prefetch: jest.fn(), query: {},
    pathname: '/profile', asPath: '/profile', events: { on: jest.fn(), off: jest.fn(), emit: jest.fn() } };
  return { useRouter: () => router };
});
jest.mock('@/components/Layout', () => ({ children }: { children: React.ReactNode }) => <div>{children}</div>);
jest.mock('@/components/BelongingSection', () => () => <div />);
jest.mock('@/components/ProviderProfileTab', () => () => <div />);
jest.mock('@/components/profile/MemorySection', () => () => <div />);
jest.mock('@/components/InvitationChain', () => ({
  __esModule: true, default: () => <div />, InvitationChainSkeleton: () => <div />,
}));
jest.mock('@/hooks/useInvitationChain', () => ({ useInvitationChain: () => ({ chain: null, loading: false }) }));
jest.mock('@/lib/api', () => ({
  api: { get: jest.fn(), post: jest.fn(), delete: jest.fn(), put: jest.fn() },
  communityService: { getMyCommunities: jest.fn() },
  reputationService: {
    getMyCommunitySummary: jest.fn(), getGlobalEvolutionSetting: jest.fn(), getTrustConfig: jest.fn(),
  },
  userSettingsService: { getPrivacySettings: jest.fn(), updatePrivacySettings: jest.fn() },
  providerService: { getMyProviders: jest.fn() },
  collectiveService: { getMyCollectives: jest.fn() },
}));

import ProfilePage from '@/pages/profile';
import { ProfileTagsSection } from '@/components/ProfileTagsSection';
import { api, communityService, reputationService, userSettingsService, providerService, collectiveService } from '@/lib/api';

const get = api.get as jest.Mock;
const post = api.post as jest.Mock;

function tagResponse(skills: Array<{ id: string; tag_value: string; skill_slug: string | null }> = []) {
  // api.ts's response interceptor has already unwrapped the ADR-074 envelope.
  return { data: { skills, interests: [], needs: [] } };
}

beforeEach(() => {
  jest.clearAllMocks();
  localStorage.clear();
  localStorage.setItem('token', 'token');
  localStorage.setItem('user', JSON.stringify({ id: 'member-1', name: 'Member', email: 'member@example.test' }));
  get.mockImplementation((url: string) => {
    if (url === '/auth/profile/tags') return Promise.resolve(tagResponse());
    if (url.startsWith('/auth/profile/tags/suggestions')) return Promise.resolve({ data: [] });
    if (url === '/users/member-1/skills') return Promise.resolve({ data: [] });
    return Promise.resolve({ data: [] });
  });
  post.mockResolvedValue({ data: { id: 'tag-new', tag_value: 'carpentry', skill_slug: 'carpentry' } });
  (communityService.getMyCommunities as jest.Mock).mockResolvedValue({ data: { communities: [] } });
  (reputationService.getGlobalEvolutionSetting as jest.Mock).mockResolvedValue({ data: { global_evolution_enabled: true } });
  (reputationService.getTrustConfig as jest.Mock).mockResolvedValue({ data: {} });
  (userSettingsService.getPrivacySettings as jest.Mock).mockResolvedValue({ data: { show_my_karma_to_me: false } });
  (providerService.getMyProviders as jest.Mock).mockResolvedValue({ data: [] });
  (collectiveService.getMyCollectives as jest.Mock).mockResolvedValue({ data: [] });
});

describe('Sprint 132 single skills editor', () => {
  it('renders one Skills editor on the profile with no legacy picker options or endpoint call', async () => {
    render(<ProfilePage />);
    await screen.findByRole('heading', { name: 'Skills', exact: true });
    expect(screen.getAllByRole('heading', { name: 'Skills', exact: true })).toHaveLength(1);
    expect(screen.queryByText('My Skills')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '+ Add Skill' })).not.toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'driving' })).not.toBeInTheDocument();
    expect(get).not.toHaveBeenCalledWith('/users/member-1/skills');
  });

  it('posts a new skill tag to the one editor with the exact payload', async () => {
    render(<ProfileTagsSection />);
    const skillHeading = screen.getByRole('heading', { name: 'Skills' });
    const skillSection = skillHeading.parentElement!.parentElement!;
    fireEvent.click(within(skillSection).getByRole('button', { name: '+ Add' }));
    const input = screen.getByPlaceholderText(/Carpentry, Spanish tutoring/);
    fireEvent.change(input, { target: { value: 'carpentry' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    await waitFor(() => expect(post).toHaveBeenCalledTimes(1));
    expect(post).toHaveBeenCalledWith('/auth/profile/tags', {
      tag_type: 'skill', tag_value: 'carpentry',
    });
    await screen.findByText('carpentry');
  });

  it('shows vocabulary matches only for tags with a skill_slug', async () => {
    get.mockImplementation((url: string) => url === '/auth/profile/tags'
      ? Promise.resolve(tagResponse([
          { id: 'matched', tag_value: 'Spanish tutoring', skill_slug: 'tutoring' },
          { id: 'unmatched', tag_value: 'Underwater basket', skill_slug: null },
        ]))
      : Promise.resolve({ data: [] }));
    render(<ProfileTagsSection />);
    const matchedTag = (await screen.findByText('Spanish tutoring')).closest('span')!;
    const unmatchedTag = screen.getByText('Underwater basket').closest('span')!;
    expect(within(matchedTag).getByText(/matched to/i)).toHaveTextContent(/tutoring/i);
    expect(within(unmatchedTag).queryByText(/matched to/i)).not.toBeInTheDocument();
  });

  it('finds a vocabulary suggestion beyond the initial six as the member types', async () => {
    const labels = ['Art', 'Baking', 'Bookkeeping', 'Carpentry', 'Childcare', 'Cleaning', 'Coding', 'Driving'];
    get.mockImplementation((url: string) => url === '/auth/profile/tags'
      ? Promise.resolve(tagResponse())
      : Promise.resolve({ data: url.endsWith('tag_type=skill') ? labels : [] }));
    render(<ProfileTagsSection />);
    const skillHeading = screen.getByRole('heading', { name: 'Skills' });
    const skillSection = skillHeading.parentElement!.parentElement!;
    fireEvent.click(within(skillSection).getByRole('button', { name: '+ Add' }));
    await within(skillSection).findByRole('button', { name: 'Art' });
    expect(within(skillSection).queryByRole('button', { name: 'Driving' })).not.toBeInTheDocument();
    fireEvent.change(screen.getByPlaceholderText(/Carpentry, Spanish tutoring/), { target: { value: 'driv' } });
    expect(within(skillSection).getByRole('button', { name: 'Driving' })).toBeInTheDocument();
  });

  it('still renders a usable Skills editor when fetching tags fails', async () => {
    get.mockImplementation((url: string) => url === '/auth/profile/tags'
      ? Promise.reject(new Error('temporary network failure'))
      : Promise.resolve({ data: [] }));
    render(<ProfileTagsSection />);
    const skillHeading = screen.getByRole('heading', { name: 'Skills' });
    const skillSection = skillHeading.parentElement!.parentElement!;
    fireEvent.click(within(skillSection).getByRole('button', { name: '+ Add' }));
    const input = screen.getByPlaceholderText(/Carpentry, Spanish tutoring/);
    fireEvent.change(input, { target: { value: 'carpentry' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    await waitFor(() => expect(post).toHaveBeenCalledTimes(1));
    await screen.findByText('carpentry');
  });
});
