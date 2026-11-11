/**
 * Sprint 40 TDD Tests: Admin Connector Tools + Provider Toggle + Geo Fix
 *
 * Tests:
 * - RequestCard shows "Community Pick" badge when is_boosted=true and not expired (Sprint 86: migrated from FeedItem)
 * - RequestCard hides badge when is_boosted=false
 * - RequestCard hides badge when boosted_expires_at is in the past
 * - CommitmentsTab shows "Suggested by your community admin" when admin_proposed=true
 * - CommitmentsTab hides label when admin_proposed=false or undefined
 * - ProviderDashboardCard renders Available button when isAvailable=true
 * - ProviderDashboardCard renders Unavailable button when isAvailable=false
 * - ProviderDashboardCard calls updateAvailability with flipped value on click
 * - ProviderDashboardCard does not render toggle when providerId is undefined
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, jest, beforeEach } from '@jest/globals';

// ─── Shared mocks ─────────────────────────────────────────────────────────────

jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

jest.mock('../../src/hooks/useTrustPath', () => ({
  useTrustPath: jest.fn(() => ({ trustPath: null, loading: false, error: null })),
}));

jest.mock('../../src/components/TrustCard', () => ({
  TrustCard: ({ onClose }: { userId: string; onClose: () => void }) => (
    <div data-testid="trust-card"><button onClick={onClose}>Close</button></div>
  ),
}));

jest.mock('../../src/components/KarmaBadge', () => ({
  __esModule: true,
  default: () => <span data-testid="karma-badge" />,
}));

jest.mock('../../src/components/TrustPathBadge', () => ({
  __esModule: true,
  default: () => <span data-testid="trust-path-badge" />,
  TrustPathBadgeSkeleton: () => <span data-testid="trust-path-skeleton" />,
}));

jest.mock('../../src/components/Feed/RequestPayloadRenderer', () => ({
  __esModule: true,
  default: () => <div data-testid="payload-renderer" />,
}));

jest.mock('../../src/lib/api', () => ({
  requestService: {
    getMatches: jest.fn(),
    getRequests: jest.fn(),
    acceptMatch: jest.fn(),
    rejectMatch: jest.fn(),
    completeMatch: jest.fn(),
    // Sprint 140 repair: CommitmentsTab has since gained the Sprint 106 decision band (curated home feed) and the
    // Sprint 107 offered-awaiting panel. Both mount-time reads resolve empty here so the tab renders its matches.
    getCuratedRequests: jest.fn(() => Promise.resolve({ data: { items: [] } })),
    getOfferedAwaiting: jest.fn(() => Promise.resolve({ data: { count: 0, items: [] } })),
  },
  providerService: {
    updateAvailability: jest.fn(),
  },
}));

jest.mock('../../src/contexts/ProviderContext', () => ({
  useProvider: jest.fn(),
}));

jest.mock('../../src/components/EmptyState', () => ({
  __esModule: true,
  default: ({ heading }: { heading: string }) => <div data-testid="empty">{heading}</div>,
}));

jest.mock('../../src/components/ExpandableConversation', () => ({
  __esModule: true,
  default: () => <div data-testid="conversation" />,
}));

jest.mock('../../src/utils/commitmentSort', () => ({
  sortByActionPriority: (arr: any[]) => arr,
}));

// ─── RequestCard: Community Pick badge (migrated from the retired FeedItem, Sprint 86) ─────────

const RequestCard = require('../../src/components/Feed/RequestCard').default;

const FUTURE_DATE = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(); // 7 days from now
const PAST_DATE = new Date(Date.now() - 60 * 1000).toISOString(); // 1 minute ago

function makeRequestCardData(overrides: Record<string, unknown> = {}) {
  return {
    request_id: 'req-boost',
    requester_id: 'user-1',
    community_id: 'comm-1',
    community_name: 'Test Community',
    title: 'Need help with groceries',
    description: 'Can someone pick up some groceries?',
    author_name: 'Alice',
    urgency: 'medium',
    status: 'open',
    match_score: null,
    match_reason: '',
    ...overrides,
  };
}

describe('Sprint 40: Admin Connector Tools', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('RequestCard Community Pick badge', () => {
    it('shows "Community Pick" badge when is_boosted=true and not expired', () => {
      render(<RequestCard data={makeRequestCardData({ is_boosted: true, boosted_expires_at: FUTURE_DATE })} />);
      expect(screen.getByText(/Community Pick/)).toBeTruthy();
    });

    it('hides badge when is_boosted=false', () => {
      render(<RequestCard data={makeRequestCardData({ is_boosted: false, boosted_expires_at: FUTURE_DATE })} />);
      expect(screen.queryByText(/Community Pick/)).toBeNull();
    });

    it('hides badge when boosted_expires_at is in the past', () => {
      render(<RequestCard data={makeRequestCardData({ is_boosted: true, boosted_expires_at: PAST_DATE })} />);
      expect(screen.queryByText(/Community Pick/)).toBeNull();
    });
  });

  // ─── CommitmentsTab: admin_proposed label ────────────────────────────────────

  describe('CommitmentsTab admin_proposed label', () => {
    const { requestService } = require('../../src/lib/api');
    const CommitmentsTab = require('../../src/components/CommitmentsTab').default;

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

    it('shows "Suggested by your community admin" when admin_proposed=true', async () => {
      setupLocalStorage();
      const adminMatch = {
        id: 'match-admin-1',
        request_id: 'req-admin',
        responder_id: 'user-me',
        requester_id: 'user-bob',
        // Sprint 108: a PROPOSED responder match renders in the decision band, not as a helping card, so the
        // card-level label is exercised on an accepted (matched) admin-proposed match (Sprint 140 repair).
        status: 'matched',
        updated_at: new Date().toISOString(),
        request_title: 'Help with move',
        requester_name: 'Bob',
        responder_name: 'Me',
        admin_proposed: true,
      };
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-expect-error: jest mock typing resolves to never in strict mode
      (requestService.getMatches as jest.Mock).mockResolvedValue({ data: { matches: [adminMatch] } });
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-expect-error: jest mock typing resolves to never in strict mode
      (requestService.getRequests as jest.Mock).mockResolvedValue({ data: { requests: [] } });

      render(<CommitmentsTab />);
      expect(await screen.findByText('Help with move')).toBeTruthy();
      expect(screen.getByText('Suggested by your community admin')).toBeTruthy();
    });

    it('hides label when admin_proposed=false or undefined', async () => {
      setupLocalStorage();
      const regularMatch = {
        id: 'match-regular-1',
        request_id: 'req-regular',
        responder_id: 'user-me',
        requester_id: 'user-carol',
        status: 'matched',
        updated_at: new Date().toISOString(),
        request_title: 'Help with groceries',
        requester_name: 'Carol',
        responder_name: 'Me',
        admin_proposed: false,
      };
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-expect-error: jest mock typing resolves to never in strict mode
      (requestService.getMatches as jest.Mock).mockResolvedValue({ data: { matches: [regularMatch] } });
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-expect-error: jest mock typing resolves to never in strict mode
      (requestService.getRequests as jest.Mock).mockResolvedValue({ data: { requests: [] } });

      render(<CommitmentsTab />);
      // Non-vacuous: the card itself renders, it just carries no admin label.
      expect(await screen.findByText('Help with groceries')).toBeTruthy();
      expect(screen.queryByText('Suggested by your community admin')).toBeNull();
    });
  });

  // ─── ProviderDashboardCard: availability toggle ───────────────────────────────

  describe('ProviderDashboardCard availability toggle', () => {
    const { useProvider } = require('../../src/contexts/ProviderContext');
    const { providerService } = require('../../src/lib/api');
    const ProviderDashboardCard = require('../../src/components/ProviderDashboardCard').default;

    // Availability now comes from the ProviderContext profile (`is_available`, surfaced by the API in
    // 7abff6c1), not an `isAvailable` prop, and a click also updates the context (Sprint 140 repair).
    const MOCK_PROFILE = {
      id: 'profile-1',
      user_id: 'user-me',
      service_type: 'rides',
      display_name: 'Test Provider',
      is_active: true,
      completion_rate: '90',
      response_rate: '0.95',
    };
    const updateProviderAvailability = jest.fn();
    const withProfile = (isAvailable: boolean) =>
      (useProvider as jest.Mock).mockReturnValue({
        hasProviderProfile: true,
        providerProfiles: [{ ...MOCK_PROFILE, is_available: isAvailable }],
        providerServiceTypes: ['rides'],
        providerMode: 'provider',
        setProviderMode: jest.fn(),
        updateProviderAvailability,
        loading: false,
      });

    beforeEach(() => {
      updateProviderAvailability.mockReset();
      (providerService.updateAvailability as jest.Mock).mockReset();
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-expect-error: jest mock typing resolves to never in strict mode
      (providerService.updateAvailability as jest.Mock).mockResolvedValue({ data: {} });
    });

    it('renders the Available button when the profile is available', () => {
      withProfile(true);
      render(<ProviderDashboardCard activeCommitments={2} providerId="profile-1" />);
      expect(screen.getByRole('button', { name: 'Available' })).toBeTruthy();
      expect(screen.queryByText('Unavailable')).toBeNull();
    });

    it('renders the Unavailable button when the profile is not available', () => {
      withProfile(false);
      render(<ProviderDashboardCard activeCommitments={0} providerId="profile-1" />);
      expect(screen.getByRole('button', { name: 'Unavailable' })).toBeTruthy();
    });

    it('a click saves the flipped value, then updates the provider context', async () => {
      withProfile(true);
      render(<ProviderDashboardCard activeCommitments={0} providerId="profile-1" />);
      fireEvent.click(screen.getByRole('button', { name: 'Available' }));

      await waitFor(() => {
        expect(updateProviderAvailability).toHaveBeenCalledWith('profile-1', false);
      });
      expect(providerService.updateAvailability).toHaveBeenCalledTimes(1);
      expect(providerService.updateAvailability).toHaveBeenCalledWith('profile-1', false);
    });

    it('a failed save leaves the provider context unchanged', async () => {
      withProfile(true);
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-expect-error: jest mock typing resolves to never in strict mode
      (providerService.updateAvailability as jest.Mock).mockRejectedValue(new Error('down'));
      render(<ProviderDashboardCard activeCommitments={0} providerId="profile-1" />);
      fireEvent.click(screen.getByRole('button', { name: 'Available' }));

      await waitFor(() => expect(providerService.updateAvailability).toHaveBeenCalledWith('profile-1', false));
      expect(updateProviderAvailability).not.toHaveBeenCalled();
    });

    it('does not render toggle when providerId is undefined', () => {
      withProfile(true);
      render(<ProviderDashboardCard activeCommitments={0} />);
      // Availability section should not be present
      expect(screen.queryByText('Availability')).toBeNull();
    });
  });
});
