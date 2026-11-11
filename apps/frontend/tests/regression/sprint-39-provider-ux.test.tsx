/**
 * Sprint 39 TDD Tests: Provider Mode UX Hardening + Accept Offers
 *
 * Tests:
 * - SpeedDialFab returns null in provider mode
 * - SpeedDialFab renders in member mode (browse tab)
 * - ProviderNotificationBell hidden in member mode
 * - CommitmentsTab shows Withdraw (not Accept/Decline) for helping+proposed
 * - CommitmentsTab shows Accept+Decline for requested+proposed
 * - Accept button calls requestService.acceptMatch with correct args
 * - Decline button calls requestService.rejectMatch with correct args
 * - Clicking requester name opens TrustCard
 *
 * Sprint 140 repair — three later, deliberate changes made parts of this file stale:
 * - f814a860 ("only dashboard cards change"): the member/provider toggle no longer hides the create action or the
 *   provider notification bell, so the provider-mode-hides cases now assert they stay visible.
 * - Sprint 120 PR C: SpeedDialFab has no isProviderMode prop and only the browse/helping/asks tabs exist.
 * - Sprint 106/107/108: CommitmentsTab also loads the decision band and the offered-awaiting band, and a
 *   self-offered PROPOSED match is no longer a helping card (BUG-022): it is a link in "Offers awaiting requester",
 *   and withdrawing happens on the request page (covered by sprint-101-request-detail-action).
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, jest, beforeEach } from '@jest/globals';

// ─── Mocks ────────────────────────────────────────────────────────────────────

jest.mock('../../src/lib/api', () => ({
  requestService: {
    getMatches: jest.fn(),
    getRequests: jest.fn(),
    acceptMatch: jest.fn(),
    rejectMatch: jest.fn(),
    completeMatch: jest.fn(),
    getCuratedRequests: jest.fn(() => Promise.resolve({ data: { items: [] } })),
    getOfferedAwaiting: jest.fn(() => Promise.resolve({ data: { count: 0, items: [] } })),
  },
}));

jest.mock('../../src/contexts/ProviderContext', () => ({
  useProvider: jest.fn(),
}));

jest.mock('../../src/contexts/NotificationContext', () => ({
  useNotifications: jest.fn(),
}));

jest.mock('next/router', () => ({
  useRouter: () => ({ pathname: '/dashboard', push: jest.fn(), back: jest.fn() }),
}));

// Stub child components used by CommitmentsTab
jest.mock('../../src/components/EmptyState', () => ({
  __esModule: true,
  default: ({ heading }: { heading: string }) => <div data-testid="empty">{heading}</div>,
}));

jest.mock('../../src/components/ExpandableConversation', () => ({
  __esModule: true,
  default: () => <div data-testid="conversation" />,
}));

jest.mock('../../src/components/TrustCard', () => ({
  TrustCard: ({ userId, onClose }: { userId: string; onClose: () => void }) => (
    <div data-testid="trust-card" data-userid={userId}>
      <button onClick={onClose}>Close</button>
    </div>
  ),
}));

jest.mock('../../src/utils/commitmentSort', () => ({
  sortByActionPriority: (arr: any[]) => arr,
}));

// ─── SpeedDialFab tests ───────────────────────────────────────────────────────

const SpeedDialFab = require('../../src/components/SpeedDialFab').default;

describe('SpeedDialFab', () => {
  it('is not hidden by provider mode any more: it takes no mode at all and renders on browse', () => {
    const { container } = render(
      <SpeedDialFab activeTab="browse" onGetHelp={() => {}} onGetService={() => {}} />
    );
    expect(container.firstChild).not.toBeNull();
    // One trigger per layout: the docked mobile bar and the md+ corner FAB.
    expect(screen.getAllByRole('button', { name: 'Ask for help or a service' })).toHaveLength(2);
  });

  it('on the browse tab the trigger expands to Get Help and Get Service', () => {
    const onGetHelp = jest.fn();
    const onGetService = jest.fn();
    render(<SpeedDialFab activeTab="browse" onGetHelp={onGetHelp} onGetService={onGetService} />);
    fireEvent.click(screen.getAllByRole('button', { name: 'Ask for help or a service' })[0]);
    fireEvent.click(screen.getAllByRole('button', { name: /Get Service/ })[0]);
    expect(onGetService).toHaveBeenCalledTimes(1);
    expect(onGetHelp).not.toHaveBeenCalled();
  });

  it.each([['helping'], ['asks']])('on the %s tab it is a single Get Help action with no expansion', (tab) => {
    const onGetHelp = jest.fn();
    render(<SpeedDialFab activeTab={tab} onGetHelp={onGetHelp} onGetService={() => {}} />);
    fireEvent.click(screen.getAllByRole('button', { name: 'Get Help' })[0]);
    expect(onGetHelp).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('button', { name: /Get Service/ })).toBeNull();
  });
});

// ─── ProviderNotificationBell tests ──────────────────────────────────────────

const ProviderNotificationBell = require('../../src/components/ProviderNotificationBell').default;
const { useProvider } = require('../../src/contexts/ProviderContext');
const { useNotifications } = require('../../src/contexts/NotificationContext');

describe('ProviderNotificationBell', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useNotifications as jest.Mock).mockReturnValue({
      providerNotifications: [],
      providerUnreadCount: 0,
    });
  });

  it('still renders in member mode (hasProviderProfile=true, providerMode=member): the toggle only changes dashboard cards', () => {
    (useProvider as jest.Mock).mockReturnValue({
      hasProviderProfile: true,
      providerMode: 'member',
    });
    render(<ProviderNotificationBell />);
    expect(screen.getByRole('button', { name: 'Provider notifications' })).toBeTruthy();
  });

  it('returns null when user has no provider profile', () => {
    (useProvider as jest.Mock).mockReturnValue({
      hasProviderProfile: false,
      providerMode: 'provider',
    });
    const { container } = render(<ProviderNotificationBell />);
    expect(container.firstChild).toBeNull();
  });

  it('renders when hasProviderProfile=true AND providerMode=provider', () => {
    (useProvider as jest.Mock).mockReturnValue({
      hasProviderProfile: true,
      providerMode: 'provider',
    });
    const { container } = render(<ProviderNotificationBell />);
    expect(container.firstChild).not.toBeNull();
  });
});

// ─── CommitmentsTab tests ─────────────────────────────────────────────────────

const CommitmentsTab = require('../../src/components/CommitmentsTab').default;
const { requestService } = require('../../src/lib/api');

const HELPING_PROPOSED_MATCH = {
  id: 'match-helping-1',
  request_id: 'req-1',
  responder_id: 'user-me',
  requester_id: 'user-alice',
  status: 'proposed',
  updated_at: new Date().toISOString(),
  request_title: 'Need a ride',
  requester_name: 'Alice',
  responder_name: 'Me',
};

const REQUESTED_PROPOSED_MATCH = {
  id: 'match-req-1',
  request_id: 'req-mine',
  responder_id: 'user-bob',
  requester_id: 'user-me',
  status: 'proposed',
  updated_at: new Date().toISOString(),
  request_title: 'Help moving',
  requester_name: 'Me',
  responder_name: 'Bob',
};

function setupLocalStorage(userId = 'user-me') {
  Object.defineProperty(window, 'localStorage', {
    value: {
      getItem: (key: string) => {
        if (key === 'user') return JSON.stringify({ id: userId, name: 'Me' });
        return null;
      },
      setItem: jest.fn(),
      removeItem: jest.fn(),
    },
    writable: true,
  });
}

describe('CommitmentsTab — I\'m Helping (proposed)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setupLocalStorage();
    // "Me" is helper; my request IDs are empty so this match goes to helping
    (requestService.getMatches as jest.Mock).mockResolvedValue({
      data: { matches: [HELPING_PROPOSED_MATCH] },
    });
    (requestService.getRequests as jest.Mock).mockResolvedValue({
      data: { requests: [] }, // no requests I made
    });
  });

  it('a self-offered proposed match is not a helping card: it is listed under "Offers awaiting requester"', async () => {
    (requestService.getOfferedAwaiting as jest.Mock).mockResolvedValue({
      data: { count: 1, items: [{ match_id: 'match-helping-1', request_id: 'req-1', title: 'Need a ride', community_name: 'Maplewood' }] },
    });
    render(<CommitmentsTab />);
    const link = await screen.findByRole('link', { name: /Need a ride/ });
    expect(link.getAttribute('href')).toBe('/requests/req-1');
    expect(screen.getByText('Offers awaiting requester')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /^accept$/i })).toBeNull();
  });

  it('offers no inline withdraw on the tab, so it never calls rejectMatch (withdraw lives on the request page)', async () => {
    (requestService.getOfferedAwaiting as jest.Mock).mockResolvedValue({
      data: { count: 1, items: [{ match_id: 'match-helping-1', request_id: 'req-1', title: 'Need a ride', community_name: null }] },
    });
    render(<CommitmentsTab />);
    await screen.findByRole('link', { name: /Need a ride/ });
    expect(screen.queryByRole('button', { name: /withdraw/i })).toBeNull();
    // The proposed match was dropped from the helping cards: their "Awaiting Acceptance" section renders nothing.
    expect(screen.queryByText(/Awaiting Acceptance/)).toBeNull();
    expect(requestService.rejectMatch).not.toHaveBeenCalled();
  });

  it('makes requester name clickable on an in-progress helping card (opens TrustCard)', async () => {
    (requestService.getMatches as jest.Mock).mockResolvedValue({
      data: { matches: [{ ...HELPING_PROPOSED_MATCH, status: 'matched' }] },
    });
    render(<CommitmentsTab />);
    await waitFor(() => screen.getByRole('button', { name: 'Alice' }));

    fireEvent.click(screen.getByRole('button', { name: 'Alice' }));

    expect(screen.getByTestId('trust-card')).toBeTruthy();
    expect(screen.getByTestId('trust-card').getAttribute('data-userid')).toBe('user-alice');
  });
});

describe('CommitmentsTab — I Asked For Help (proposed)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setupLocalStorage();
    // "Me" is requester; req-mine belongs to me
    (requestService.getMatches as jest.Mock).mockResolvedValue({
      data: { matches: [REQUESTED_PROPOSED_MATCH] },
    });
    (requestService.getRequests as jest.Mock).mockResolvedValue({
      data: { requests: [{ id: 'req-mine' }] },
    });
  });

  it('shows Accept and Decline buttons for requested+proposed', async () => {
    render(<CommitmentsTab />);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /^accept$/i })).toBeTruthy();
      expect(screen.getByRole('button', { name: /^decline$/i })).toBeTruthy();
    });
  });

  it('calls acceptMatch with correct args on Accept', async () => {
    (requestService.acceptMatch as jest.Mock).mockResolvedValue({ data: {} });
    render(<CommitmentsTab />);
    await waitFor(() => screen.getByRole('button', { name: /^accept$/i }));

    fireEvent.click(screen.getByRole('button', { name: /^accept$/i }));

    await waitFor(() => {
      // ADR-064: identity comes from the JWT server-side, so no user_id arg is sent.
      expect(requestService.acceptMatch).toHaveBeenCalledWith('match-req-1');
    });
  });

  it('calls rejectMatch with correct args on Decline', async () => {
    (requestService.rejectMatch as jest.Mock).mockResolvedValue({ data: {} });
    render(<CommitmentsTab />);
    await waitFor(() => screen.getByRole('button', { name: /^decline$/i }));

    fireEvent.click(screen.getByRole('button', { name: /^decline$/i }));

    await waitFor(() => {
      // ADR-064: identity comes from the JWT server-side, so no user_id arg is sent.
      expect(requestService.rejectMatch).toHaveBeenCalledWith('match-req-1');
    });
  });

  it('makes responder name clickable (opens TrustCard)', async () => {
    render(<CommitmentsTab />);
    await waitFor(() => screen.getByRole('button', { name: 'Bob' }));

    fireEvent.click(screen.getByRole('button', { name: 'Bob' }));

    expect(screen.getByTestId('trust-card')).toBeTruthy();
    expect(screen.getByTestId('trust-card').getAttribute('data-userid')).toBe('user-bob');
  });
});
