import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
jest.mock('next/router', () => {
  const router = { push: jest.fn(), replace: jest.fn(), query: {}, pathname: '/profile' };
  return { useRouter: () => router };
});
jest.mock('@/components/Layout', () => ({ children }: { children: React.ReactNode }) => <div>{children}</div>);
jest.mock('@/components/BelongingSection', () => () => null);
jest.mock('@/components/ProviderProfileTab', () => () => null);
jest.mock('@/components/profile/MemorySection', () => () => null);
jest.mock('@/components/InvitationChain', () => ({ __esModule: true, default: () => null, InvitationChainSkeleton: () => null }));
jest.mock('@/hooks/useInvitationChain', () => ({ useInvitationChain: () => ({ chain: null, loading: false }) }));
jest.mock('@/lib/api', () => ({
  api: { get: jest.fn(), post: jest.fn(), delete: jest.fn(), put: jest.fn(), patch: jest.fn() },
  communityService: { getMyCommunities: jest.fn() },
  reputationService: { getGlobalEvolutionSetting: jest.fn(), getTrustConfig: jest.fn() },
  providerService: { getMyProviders: jest.fn() }, collectiveService: { getMyCollectives: jest.fn() },
  userSettingsService: { getPrivacySettings: jest.fn(), updatePrivacySettings: jest.fn() },
  skillsService: { getUserSkills: jest.fn(), getCommunitySkillDirectory: jest.fn(), searchCommunitySkills: jest.fn() },
}));
import Profile from '@/pages/profile';
import FindASkillPanel from '@/components/skills/FindASkillPanel';
import MemberSkills from '@/components/skills/MemberSkills';
import { api, communityService, reputationService, userSettingsService, providerService, collectiveService } from '@/lib/api';

function renderPanel(isMember = true) {
  return render(<FindASkillPanel communityId="community-1" isMember={isMember} />);
}
const skills = () => require('@/lib/api').skillsService;

beforeEach(() => {
  jest.clearAllMocks();
  localStorage.clear();
  localStorage.setItem('token', 'token');
  localStorage.setItem('user', JSON.stringify({ id: 'member-1', name: 'Member', email: 'member@example.test' }));
  (api.get as jest.Mock).mockImplementation((url: string) => Promise.resolve({ data: url === '/auth/profile/tags' ? { skills: [], interests: [], needs: [] } : [] }));
  (communityService.getMyCommunities as jest.Mock).mockResolvedValue({ data: { communities: [] } });
  (reputationService.getGlobalEvolutionSetting as jest.Mock).mockResolvedValue({ data: { global_evolution_enabled: true } });
  (userSettingsService.getPrivacySettings as jest.Mock).mockResolvedValue({ data: { show_my_karma_to_me: false, share_skills_with_communities: true } });
  (userSettingsService.updatePrivacySettings as jest.Mock).mockResolvedValue({ data: { share_skills_with_communities: false } });
  (providerService.getMyProviders as jest.Mock).mockResolvedValue({ data: [] });
  (collectiveService.getMyCollectives as jest.Mock).mockResolvedValue({ data: [] });
  skills().getCommunitySkillDirectory.mockResolvedValue({ data: [{ skill_key: 'carpentry', label: 'Carpentry', member_count: 2 }] });
  skills().searchCommunitySkills.mockResolvedValue({ data: [{ user_id: 'caleb', name: 'Caleb', skills: [{ tag_id: 'tag-1', label: 'Carpentry' }] }] });
  skills().getUserSkills.mockResolvedValue({ data: [{ tag_id: 'tag-1', label: 'Carpentry', skill_slug: 'carpentry' }] });
});

it('lets a member with no communities disable sharing with only the skills field', async () => {
  render(<Profile />);
  const toggle = await screen.findByRole('checkbox', { name: 'Show my skills to people in my communities' });
  await waitFor(() => expect(toggle).not.toBeDisabled());
  expect(toggle).toBeChecked();
  fireEvent.click(toggle);
  await waitFor(() => expect(userSettingsService.updatePrivacySettings).toHaveBeenCalledWith({ share_skills_with_communities: false }));
  expect(toggle).not.toBeChecked();
});

it('loads an existing opt-out even without any current communities', async () => {
  (userSettingsService.getPrivacySettings as jest.Mock).mockResolvedValue({ data: { share_skills_with_communities: false, show_my_karma_to_me: false } });
  render(<Profile />);
  const toggle = await screen.findByRole('checkbox', { name: 'Show my skills to people in my communities' });
  await waitFor(() => expect(toggle).not.toBeChecked());
});

it('keeps the saved value and shows an error if updating sharing fails', async () => {
  (userSettingsService.updatePrivacySettings as jest.Mock).mockRejectedValue(new Error('offline'));
  render(<Profile />);
  const toggle = await screen.findByRole('checkbox', { name: 'Show my skills to people in my communities' });
  await waitFor(() => expect(toggle).not.toBeDisabled());
  fireEvent.click(toggle);
  await screen.findByText('Failed to update skill sharing');
  expect(toggle).toBeChecked();
});

it('shows unavailable privacy settings without an enabled toggle, then retries the saved opt-out', async () => {
  (userSettingsService.getPrivacySettings as jest.Mock).mockRejectedValueOnce(new Error('offline'))
    .mockResolvedValue({ data: { show_my_karma_to_me: false, share_skills_with_communities: false } });
  render(<Profile />);
  await screen.findByText('Privacy settings are unavailable. Please try again.');
  expect(screen.queryByRole('checkbox', { name: 'Show my skills to people in my communities' })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Retry privacy settings' }));
  const toggle = await screen.findByRole('checkbox', { name: 'Show my skills to people in my communities' });
  await waitFor(() => expect(toggle).not.toBeDisabled());
  expect(toggle).not.toBeChecked();
  expect(userSettingsService.updatePrivacySettings).not.toHaveBeenCalled();
});

it('loads the saved privacy setting even if community loading fails', async () => {
  (communityService.getMyCommunities as jest.Mock).mockRejectedValue(new Error('community offline'));
  (userSettingsService.getPrivacySettings as jest.Mock).mockResolvedValue({ data: { show_my_karma_to_me: false, share_skills_with_communities: false } });
  render(<Profile />);
  const toggle = await screen.findByRole('checkbox', { name: 'Show my skills to people in my communities' });
  await waitFor(() => expect(toggle).not.toBeDisabled());
  expect(toggle).not.toBeChecked();
});

it('renders directory chips with member counts and searches the selected exact skill', async () => {
  renderPanel();
  fireEvent.click(await screen.findByRole('button', { name: /Carpentry.*2/ }));
  await screen.findByText('Caleb');
  expect(skills().searchCommunitySkills).toHaveBeenCalledWith('community-1', 'carpentry');
});

it('searches the entered skill and renders matching members', async () => {
  renderPanel();
  fireEvent.change(screen.getByRole('textbox', { name: 'Skill' }), { target: { value: 'Carpentry' } });
  fireEvent.click(screen.getByRole('button', { name: 'Search' }));
  await screen.findByText('Caleb');
  expect(skills().searchCommunitySkills).toHaveBeenCalledWith('community-1', 'Carpentry');
});

it('hides the panel for non-members and never fetches their directory', () => {
  renderPanel(false);
  expect(screen.queryByRole('heading', { name: 'Find a skill' })).not.toBeInTheDocument();
  expect(skills().getCommunitySkillDirectory).not.toHaveBeenCalled();
});

it('shows a graceful empty state if the directory fetch fails', async () => {
  skills().getCommunitySkillDirectory.mockRejectedValue(new Error('offline'));
  renderPanel();
  await screen.findByText('Skills are unavailable right now. Please try again later.');
});

it('opens the selected member’s skills through the People panel', async () => {
  renderPanel();
  fireEvent.click(await screen.findByRole('button', { name: /Carpentry.*2/ }));
  fireEvent.click(await screen.findByRole('button', { name: 'View skills' }));
  const list = await screen.findByRole('list', { name: 'Member skills' });
  expect(list).toHaveTextContent('Carpentry');
  expect(skills().getUserSkills).toHaveBeenCalledWith('caleb');
});

it.each([[], null])('handles empty or inaccessible member skills: %j', async response => {
  skills().getUserSkills.mockImplementation(() => response === null ? Promise.reject(new Error('404')) : Promise.resolve({ data: response }));
  render(<MemberSkills userId="caleb" />);
  await screen.findByText('No shared skills to show.');
});

it('discards an old member’s delayed skills after the selected member changes', async () => {
  let resolveOld!: (value: any) => void;
  skills().getUserSkills.mockImplementation((id: string) => id === 'old'
    ? new Promise(resolve => { resolveOld = resolve })
    : Promise.resolve({ data: [{ tag_id: 'new-tag', label: 'Gardening', skill_slug: 'gardening' }] }));
  const view = render(<MemberSkills userId="old" />);
  view.rerender(<MemberSkills userId="new" />);
  await screen.findByText('Gardening');
  resolveOld({ data: [{ tag_id: 'old-tag', label: 'Secret old skill', skill_slug: null }] });
  await waitFor(() => expect(screen.queryByText('Secret old skill')).not.toBeInTheDocument());
});
