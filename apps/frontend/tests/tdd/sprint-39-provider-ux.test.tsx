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
  it('returns null in provider mode', () => {
    const { container } = render(
      <SpeedDialFab
        activeTab="browse"
        onGetHelp={() => {}}
        onGetService={() => {}}
        isProviderMode={true}
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders + button in member mode on browse tab', () => {
    render(
      <SpeedDialFab
        activeTab="browse"
        onGetHelp={() => {}}
        onGetService={() => {}}
        isProviderMode={false}
      />
    );
    expect(screen.getByRole('button', { name: /open actions/i })).toBeTruthy();
  });

  it('returns null for profile tab regardless of mode', () => {
    const { container } = render(
      <SpeedDialFab
        activeTab="profile"
        onGetHelp={() => {}}
        onGetService={() => {}}
        isProviderMode={false}
      />
    );
    expect(container.firstChild).toBeNull();
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

  it('returns null when in member mode (hasProviderProfile=true but providerMode=member)', () => {
    (useProvider as jest.Mock).mockReturnValue({
      hasProviderProfile: true,
      providerMode: 'member',
    });
    const { container } = render(<ProviderNotificationBell />);
    expect(container.firstChild).toBeNull();
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

  it('shows "Withdraw Offer" button (not Accept) for helping+proposed', async () => {
    render(<CommitmentsTab />);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /withdraw offer/i })).toBeTruthy();
    });
    expect(screen.queryByRole('button', { name: /^accept$/i })).toBeNull();
  });

  it('calls rejectMatch when Withdraw is clicked', async () => {
    (requestService.rejectMatch as jest.Mock).mockResolvedValue({ data: {} });
    render(<CommitmentsTab />);
    await waitFor(() => screen.getByRole('button', { name: /withdraw offer/i }));

    fireEvent.click(screen.getByRole('button', { name: /withdraw offer/i }));

    await waitFor(() => {
      expect(requestService.rejectMatch).toHaveBeenCalledWith('match-helping-1', 'user-me');
    });
  });

  it('makes requester name clickable (opens TrustCard)', async () => {
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
      expect(requestService.acceptMatch).toHaveBeenCalledWith('match-req-1', 'user-me');
    });
  });

  it('calls rejectMatch with correct args on Decline', async () => {
    (requestService.rejectMatch as jest.Mock).mockResolvedValue({ data: {} });
    render(<CommitmentsTab />);
    await waitFor(() => screen.getByRole('button', { name: /^decline$/i }));

    fireEvent.click(screen.getByRole('button', { name: /^decline$/i }));

    await waitFor(() => {
      expect(requestService.rejectMatch).toHaveBeenCalledWith('match-req-1', 'user-me');
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
