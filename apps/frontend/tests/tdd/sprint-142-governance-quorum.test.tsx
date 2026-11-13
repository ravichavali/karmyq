import React from 'react';
import { act,fireEvent,render,screen,waitFor } from '@testing-library/react';
import GovernanceTab from '@/components/GovernanceTab';
import { communityService } from '@/lib/api';

jest.mock('@/lib/api', () => ({ communityService: {
  getGovernanceState: jest.fn(),nominateForRole: jest.fn(),ratifyNomination: jest.fn(),
} }));

function state() {
  return {
    can_nominate: true,
    settings: { template: 'small-collective',eligibility_threshold: 50,quorum_policy: { version: 1,percentage: 20,minimum: 3 } },
    maturity: { status: 'mature',avg_trust_score: 60,threshold: 50 },
    eligible_members: [
      { user_id: 'admin',name: 'Ada',eligible: true,eligibility_reason: 'established_community_relationships' },
      { user_id: 'mod',name: 'Morgan',eligible: true,eligibility_reason: 'established_community_relationships' },
      { user_id: 'member',name: 'Nia',eligible: true,eligibility_reason: 'established_community_relationships' },
    ],
    role_holders: [{ user_id: 'admin',name: 'Ada',role: 'admin' },{ user_id: 'mod',name: 'Morgan',role: 'moderator' }],
    nominations: [{ id: 'nom',nominated_user: { user_id: 'member',name: 'Nia' },role: 'moderator',
      nominator: { user_id: 'admin',name: 'Ada' },ratification_count: 2,required_ratifications: 4,electorate_size: 16,
      quorum_policy_version: 1,ratifiers: [{ user_id: 'admin',name: 'Ada' },{ user_id: 'other',name: 'Ari' }],
      viewer: { can_ratify: true,reason: 'eligible' } }],
  };
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((yes,no) => { resolve=yes; reject=no; });
  return { promise,resolve,reject };
}
const get = communityService.getGovernanceState as jest.Mock;
const nominate = communityService.nominateForRole as jest.Mock;
const ratify = communityService.ratifyNomination as jest.Mock;
const ready = () => screen.findByText('20% of eligible voters · at least 3');
beforeEach(() => {
  jest.resetAllMocks();
  get.mockResolvedValue({ data: state() });
  nominate.mockResolvedValue({ data: {} }); ratify.mockResolvedValue({ data: {} });
});

it('renders fixed policy/progress from the production-unwrapped response', async () => {
  render(<GovernanceTab communityId="c1" currentUserId="viewer" />);
  await ready();
  expect(get).toHaveBeenCalledWith('c1');
  expect(screen.getByText('2 of 4 ratifications')).toBeInTheDocument();
  expect(screen.getByText('4 fixed when nominated from 16 eligible voters.')).toBeInTheDocument();
});

it.each([
  ['nominee','Your nomination'],['already_ratified','Already ratified'],['not_in_electorate','You joined after this nomination opened.'],
])('uses server eligibility to hide voting for %s', async (reason,copy) => {
  const data=state(); data.nominations[0].viewer={ can_ratify: false,reason };
  get.mockResolvedValue({ data });
  render(<GovernanceTab communityId="c1" currentUserId="viewer" />);
  await ready();
  expect(screen.queryByRole('button',{ name: 'Ratify' })).not.toBeInTheDocument();
  expect(screen.getByText(copy)).toBeInTheDocument();
});

it('blocks nominations when the server says the community is too small', async () => {
  const data=state(); data.can_nominate=false; get.mockResolvedValue({ data });
  render(<GovernanceTab communityId="c1" currentUserId="viewer" />);
  await ready();
  expect(screen.queryAllByRole('button',{ name: /^Nominate / })).toHaveLength(0);
  expect(screen.getByText('At least three other active members are needed to open a nomination.')).toBeInTheDocument();
});

it('hides same/lower-role nominations and offers only admin elevation for a moderator', async () => {
  render(<GovernanceTab communityId="c1" currentUserId="viewer" />); await ready();
  expect(screen.queryByRole('button',{ name: 'Nominate Ada' })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button',{ name: 'Nominate Morgan' }));
  expect(screen.getByRole('combobox',{ name: 'Role for Morgan' })).toHaveValue('admin');
  expect(screen.queryByRole('option',{ name: 'Moderator' })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button',{ name: 'Submit nomination for Morgan' }));
  await waitFor(() => expect(nominate).toHaveBeenCalledWith('c1','mod','admin'));
});

it('sends the selected member/role and refreshes after nomination', async () => {
  render(<GovernanceTab communityId="c1" currentUserId="viewer" />); await ready();
  fireEvent.click(screen.getByRole('button',{ name: 'Nominate Nia' }));
  fireEvent.change(screen.getByRole('combobox',{ name: 'Role for Nia' }),{ target: { value: 'admin' } });
  fireEvent.click(screen.getByRole('button',{ name: 'Submit nomination for Nia' }));
  await waitFor(() => expect(nominate).toHaveBeenCalledWith('c1','member','admin'));
  await waitFor(() => expect(get).toHaveBeenCalledTimes(2));
});

it('refreshes nomination choices after a stale-role refusal and submits the visible higher role', async () => {
  const updated=state(); updated.role_holders.push({ user_id: 'member',name: 'Nia',role: 'moderator' });
  get.mockResolvedValueOnce({ data: state() }).mockResolvedValue({ data: updated });
  nominate.mockRejectedValueOnce({ response: { data: { message: 'Role changed. Please retry.' } } }).mockResolvedValue({ data: {} });
  render(<GovernanceTab communityId="c1" currentUserId="viewer" />); await ready();
  fireEvent.click(screen.getByRole('button',{ name: 'Nominate Nia' }));
  fireEvent.click(screen.getByRole('button',{ name: 'Submit nomination for Nia' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Role changed. Please retry.');
  const select=screen.getByRole('combobox',{ name: 'Role for Nia' });
  expect(select).toHaveValue('admin');
  fireEvent.click(screen.getByRole('button',{ name: 'Submit nomination for Nia' }));
  await waitFor(() => expect(nominate).toHaveBeenLastCalledWith('c1','member','admin'));
});

it('submits one vote while busy and refreshes after success', async () => {
  const pending=deferred<any>(); ratify.mockReturnValue(pending.promise);
  render(<GovernanceTab communityId="c1" currentUserId="viewer" />); await ready();
  const button=screen.getByRole('button',{ name: 'Ratify' });
  fireEvent.click(button); fireEvent.click(button);
  expect(button).toBeDisabled(); expect(ratify).toHaveBeenCalledTimes(1);
  expect(ratify).toHaveBeenCalledWith('c1','nom');
  await act(async () => { pending.resolve({ data: {} }); });
  await waitFor(() => expect(get).toHaveBeenCalledTimes(2));
});

it('shows a stale-vote refusal inline and refreshes the decision rather than claiming success', async () => {
  const updated=state(); updated.nominations=[];
  get.mockResolvedValueOnce({ data: state() }).mockResolvedValue({ data: updated });
  ratify.mockRejectedValue({ response: { data: { message: 'This nomination is closed.' } } });
  render(<GovernanceTab communityId="c1" currentUserId="viewer" />); await ready();
  fireEvent.click(screen.getByRole('button',{ name: 'Ratify' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('This nomination is closed.');
  await waitFor(() => expect(screen.queryByRole('button',{ name: 'Ratify' })).not.toBeInTheDocument());
});

it('offers retry after a fetch error', async () => {
  get.mockRejectedValueOnce(new Error('offline'));
  render(<GovernanceTab communityId="c1" currentUserId="viewer" />);
  expect(await screen.findByRole('alert')).toHaveTextContent('Failed to load governance data');
  fireEvent.click(screen.getByRole('button',{ name: 'Retry' })); await ready();
});

it('ignores an old community fetch that settles after switching communities', async () => {
  const old=deferred<any>(); const current=deferred<any>();
  get.mockReturnValueOnce(old.promise).mockReturnValueOnce(current.promise);
  const { rerender }=render(<GovernanceTab communityId="c1" currentUserId="viewer" />);
  rerender(<GovernanceTab communityId="c2" currentUserId="viewer" />);
  const data=state(); data.settings.template='current-community';
  await act(async () => { current.resolve({ data }); }); await ready();
  await act(async () => { old.reject(new Error('old community error')); });
  expect(screen.getByText(/current-community/)).toBeInTheDocument();
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});

it('ignores an old action failure after switching communities', async () => {
  const pending=deferred<any>(); ratify.mockReturnValue(pending.promise);
  const { rerender }=render(<GovernanceTab communityId="c1" currentUserId="viewer" />); await ready();
  fireEvent.click(screen.getByRole('button',{ name: 'Ratify' }));
  const data=state(); data.settings.template='current-community'; get.mockResolvedValue({ data });
  rerender(<GovernanceTab communityId="c2" currentUserId="viewer" />); await ready();
  await act(async () => { pending.reject({ response: { data: { message: 'Old request failed' } } }); });
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  expect(screen.getByText(/current-community/)).toBeInTheDocument();
  expect(get.mock.calls.map(c => c[0])).toEqual(['c1','c2']);
});
