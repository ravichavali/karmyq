import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import GovernanceTab from '@/components/GovernanceTab';
import { communityService } from '@/lib/api';

jest.mock('@/lib/api', () => ({ communityService: {
  getGovernanceState: jest.fn(),
  nominateForRole: jest.fn(),
  ratifyNomination: jest.fn(),
  withdrawNomination: jest.fn(),
  declineNomination: jest.fn(),
} }));

const get = communityService.getGovernanceState as jest.Mock;
const withdraw = communityService.withdrawNomination as jest.Mock;
const decline = communityService.declineNomination as jest.Mock;
const expiresAt = '2026-12-15T12:00:00.000Z';

function state(viewer = { can_ratify: false, reason: 'already_ratified', can_withdraw: false, can_decline: false }) {
  return {
    can_nominate: true,
    settings: { eligibility_threshold: 50, template: 'small-collective', quorum_policy: { version: 1, percentage: 20, minimum: 3 } },
    maturity: { status: 'mature', avg_trust_score: 60 },
    eligible_members: [],
    role_holders: [],
    nominations: [{
      id: 'nomination-1',
      nominated_user: { user_id: 'nominee', name: 'Nia' },
      nominator: { user_id: 'nominator', name: 'Ada' },
      role: 'moderator',
      ratification_count: 1,
      required_ratifications: 3,
      electorate_size: 4,
      ratifiers: [{ user_id: 'voter', name: 'Vera' }],
      expires_at: expiresAt,
      nominee_eligible: true,
      viewer,
    }],
  };
}

async function renderTab(data = state()) {
  get.mockResolvedValue({ data });
  render(<GovernanceTab communityId="community-1" currentUserId="viewer" />);
  await screen.findByText('Pending Nominations');
}

beforeEach(() => {
  jest.resetAllMocks();
  withdraw.mockResolvedValue({ data: {} });
  decline.mockResolvedValue({ data: {} });
});

it.each([
  [{ can_ratify: false, reason: 'already_ratified', can_withdraw: true, can_decline: false }, 'Withdraw nomination', 'Decline'],
  [{ can_ratify: false, reason: 'nominee', can_withdraw: false, can_decline: true }, 'Decline', 'Withdraw nomination'],
  [{ can_ratify: false, reason: 'already_ratified', can_withdraw: false, can_decline: false }, null, null],
])('gates close controls from the server viewer flags', async (viewer, visible, hidden) => {
  await renderTab(state(viewer));
  if (visible) expect(screen.getByRole('button', { name: visible })).toBeInTheDocument();
  else {
    expect(screen.queryByRole('button', { name: 'Withdraw nomination' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Decline' })).not.toBeInTheDocument();
  }
  if (hidden) expect(screen.queryByRole('button', { name: hidden })).not.toBeInTheDocument();
});

it.each([
  ['withdraw', 'Withdraw nomination', 'Confirm withdrawal'],
  ['decline', 'Decline', 'Confirm decline'],
] as const)('confirms %s, calls the exact API and refreshes', async (action, label, confirmation) => {
  const viewer = action === 'withdraw'
    ? { can_ratify: false, reason: 'already_ratified', can_withdraw: true, can_decline: false }
    : { can_ratify: false, reason: 'nominee', can_withdraw: false, can_decline: true };
  await renderTab(state(viewer));
  fireEvent.click(screen.getByRole('button', { name: label }));
  expect(action === 'withdraw' ? withdraw : decline).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: confirmation }));
  const api = action === 'withdraw' ? withdraw : decline;
  await waitFor(() => expect(api).toHaveBeenCalledWith('community-1', 'nomination-1'));
  await waitFor(() => expect(get).toHaveBeenCalledTimes(2));
});

it('cancels an inline close confirmation without calling either API', async () => {
  await renderTab(state({ can_ratify: false, reason: 'already_ratified', can_withdraw: true, can_decline: false }));
  fireEvent.click(screen.getByRole('button', { name: 'Withdraw nomination' }));
  fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
  expect(withdraw).not.toHaveBeenCalled();
  expect(decline).not.toHaveBeenCalled();
  expect(screen.getByRole('button', { name: 'Withdraw nomination' })).toBeInTheDocument();
});

it('shows a close conflict in the alert and refreshes', async () => {
  withdraw.mockRejectedValue({ response: { status: 409, data: { message: 'This nomination has expired.' } } });
  await renderTab(state({ can_ratify: false, reason: 'already_ratified', can_withdraw: true, can_decline: false }));
  fireEvent.click(screen.getByRole('button', { name: 'Withdraw nomination' }));
  fireEvent.click(screen.getByRole('button', { name: 'Confirm withdrawal' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('This nomination has expired.');
  await waitFor(() => expect(get).toHaveBeenCalledTimes(2));
});

it('renders the exact closing date', async () => {
  await renderTab();
  expect(screen.getByText(`Closes ${new Date(expiresAt).toLocaleDateString()}`)).toBeInTheDocument();
});

it('shows the ineligible notice and never offers finalization', async () => {
  const data = state({ can_ratify: false, reason: 'nominee_ineligible', can_withdraw: true, can_decline: false });
  data.nominations[0].nominee_eligible = false;
  await renderTab(data);
  expect(screen.getByText(`This nomination can't be finalized while the nominee isn't eligible. It closes on ${new Date(expiresAt).toLocaleDateString()}.`)).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Finalize decision' })).not.toBeInTheDocument();
});

it('uses the corrected not-in-electorate explanation', async () => {
  await renderTab(state({ can_ratify: false, reason: 'not_in_electorate', can_withdraw: false, can_decline: false }));
  expect(screen.getByText('You were not an active member when this nomination opened.')).toBeInTheDocument();
});
