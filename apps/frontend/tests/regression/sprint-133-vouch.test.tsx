import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';

jest.mock('@/lib/api', () => ({
  skillsService: { getUserSkills: jest.fn(), endorse: jest.fn(), withdrawEndorsement: jest.fn() },
  socialGraphApi: { get: jest.fn() },
}));
import MemberSkills from '@/components/skills/MemberSkills';
import { TrustCard } from '@/components/TrustCard';
import { skillsService, socialGraphApi } from '@/lib/api';

const svc = skillsService as unknown as Record<'getUserSkills' | 'endorse' | 'withdrawEndorsement', jest.Mock>;
const skill = (over: Record<string, unknown> = {}) => ({
  tag_id: 'tag-1', label: 'Carpentry', skill_slug: 'carpentry', endorsement_count: 0, endorsed_by_me: false, can_endorse: false, ...over,
});
const item = async (label = 'Carpentry') => (await screen.findByText(label)).closest('li') as HTMLElement;

beforeEach(() => {
  // Frontend Jest clears nothing between tests; reset so queued once-values cannot leak across tests.
  for (const fn of Object.values(svc)) fn.mockReset();
  (socialGraphApi.get as jest.Mock).mockReset();
  svc.endorse.mockResolvedValue({ data: { id: 'row-1', tag_id: 'tag-1', endorsee_id: 'caleb', created_at: '2026-10-13T00:00:00Z' } });
  svc.withdrawEndorsement.mockResolvedValue({ data: { withdrawn: true } });
});

it('shows no vouch control without a completed match (can_endorse false)', async () => {
  svc.getUserSkills.mockResolvedValue({ data: [skill({ endorsement_count: 2 })] });
  render(<MemberSkills userId="caleb" />);
  const li = await item();
  expect(within(li).getByText('2 vouches')).toBeInTheDocument();
  expect(within(li).queryByRole('button')).not.toBeInTheDocument();
});

it('vouch posts the tag id and shows the reloaded count and button', async () => {
  svc.getUserSkills
    .mockResolvedValueOnce({ data: [skill({ can_endorse: true })] })
    .mockResolvedValueOnce({ data: [skill({ can_endorse: true, endorsed_by_me: true, endorsement_count: 1 })] });
  render(<MemberSkills userId="caleb" />);
  const li = await item();
  expect(within(li).queryByText(/vouch(es)?$/)).toBeNull();
  fireEvent.click(within(li).getByRole('button', { name: 'Vouch for Carpentry' }));
  await waitFor(() => expect(svc.endorse).toHaveBeenCalledWith('tag-1'));
  expect(await within(li).findByRole('button', { name: 'Withdraw vouch for Carpentry' })).toBeInTheDocument();
  expect(within(li).getByText('1 vouch')).toBeInTheDocument();
});

it('withdraw calls DELETE for that tag and shows the reloaded count', async () => {
  svc.getUserSkills
    .mockResolvedValueOnce({ data: [skill({ can_endorse: true, endorsed_by_me: true, endorsement_count: 2 })] })
    .mockResolvedValueOnce({ data: [skill({ can_endorse: true, endorsement_count: 1 })] });
  render(<MemberSkills userId="caleb" />);
  const li = await item();
  fireEvent.click(within(li).getByRole('button', { name: 'Withdraw vouch for Carpentry' }));
  await waitFor(() => expect(svc.withdrawEndorsement).toHaveBeenCalledWith('tag-1'));
  expect(await within(li).findByRole('button', { name: 'Vouch for Carpentry' })).toBeInTheDocument();
  expect(within(li).getByText('1 vouch')).toBeInTheDocument();
});

it('shows the server count after a vouch, not a local +1 (a stale view of an already-active vouch is a 200 no-op)', async () => {
  svc.getUserSkills
    .mockResolvedValueOnce({ data: [skill({ can_endorse: true, endorsement_count: 1 })] })
    .mockResolvedValueOnce({ data: [skill({ can_endorse: true, endorsed_by_me: true, endorsement_count: 1 })] });
  render(<MemberSkills userId="caleb" />);
  const li = await item();
  fireEvent.click(within(li).getByRole('button', { name: 'Vouch for Carpentry' }));
  expect(await within(li).findByRole('button', { name: 'Withdraw vouch for Carpentry' })).toBeInTheDocument();
  expect(within(li).getByText('1 vouch')).toBeInTheDocument();
  expect(svc.getUserSkills).toHaveBeenCalledTimes(2);
});

it('a saved vouch whose reload fails falls back to the local estimate without an error', async () => {
  svc.getUserSkills
    .mockResolvedValueOnce({ data: [skill({ can_endorse: true, endorsement_count: 1 })] })
    .mockRejectedValueOnce(new Error('offline'));
  render(<MemberSkills userId="caleb" />);
  const li = await item();
  fireEvent.click(within(li).getByRole('button', { name: 'Vouch for Carpentry' }));
  expect(await within(li).findByText('2 vouches')).toBeInTheDocument();
  expect(within(li).getByRole('button', { name: 'Withdraw vouch for Carpentry' })).toBeInTheDocument();
  expect(screen.queryByRole('alert')).toBeNull();
});

it('a failed vouch keeps the previous state and says so', async () => {
  svc.getUserSkills.mockResolvedValue({ data: [skill({ can_endorse: true })] });
  svc.endorse.mockRejectedValue(new Error('nope'));
  render(<MemberSkills userId="caleb" />);
  const li = await item();
  fireEvent.click(within(li).getByRole('button', { name: 'Vouch for Carpentry' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Could not update your vouch');
  expect(within(li).getByRole('button', { name: 'Vouch for Carpentry' })).toBeEnabled();
  expect(within(li).queryByText(/vouch(es)?$/)).toBeNull();
});

it('the trust card for a match partner shows their skills with the vouch control', async () => {
  (socialGraphApi.get as jest.Mock).mockResolvedValue({ data: { targetUser: { id: 'caleb', name: 'Caleb' }, trustPath: [], degrees: null } });
  svc.getUserSkills.mockResolvedValue({ data: [skill({ can_endorse: true })] });
  render(<TrustCard userId="caleb" onClose={() => undefined} />);
  expect(await screen.findByRole('button', { name: 'Vouch for Carpentry' })).toBeInTheDocument();
  expect(svc.getUserSkills).toHaveBeenCalledWith('caleb');
});
