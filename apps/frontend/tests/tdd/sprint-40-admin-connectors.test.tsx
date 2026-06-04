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
        status: 'proposed',
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
      await waitFor(() => {
        expect(screen.getByText('Suggested by your community admin')).toBeTruthy();
      });
    });

    it('hides label when admin_proposed=false or undefined', async () => {
      setupLocalStorage();
      const regularMatch = {
        id: 'match-regular-1',
        request_id: 'req-regular',
        responder_id: 'user-me',
        requester_id: 'user-carol',
        status: 'proposed',
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
      await waitFor(() => {
        expect(screen.queryByText('Suggested by your community admin')).toBeNull();
      });
    });
  });

  // ─── ProviderDashboardCard: availability toggle ───────────────────────────────

  describe('ProviderDashboardCard availability toggle', () => {
    const { useProvider } = require('../../src/contexts/ProviderContext');
    const { providerService } = require('../../src/lib/api');
    const ProviderDashboardCard = require('../../src/components/ProviderDashboardCard').default;

    const MOCK_PROFILE = {
      id: 'profile-1',
      user_id: 'user-me',
      service_type: 'rides',
      display_name: 'Test Provider',
      is_active: true,
      completion_rate: '90',
      response_rate: '0.95',
    };

    beforeEach(() => {
      (useProvider as jest.Mock).mockReturnValue({
        hasProviderProfile: true,
        providerProfiles: [MOCK_PROFILE],
        providerServiceTypes: ['rides'],
        providerMode: 'provider',
        setProviderMode: jest.fn(),
        loading: false,
      });
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-expect-error: jest mock typing resolves to never in strict mode
      (providerService.updateAvailability as jest.Mock).mockResolvedValue({ data: {} });
    });

    it('renders Available button when isAvailable=true', () => {
      render(
        <ProviderDashboardCard
          activeCommitments={2}
          providerId="profile-1"
          isAvailable={true}
        />
      );
      expect(screen.getByRole('button', { name: /available/i })).toBeTruthy();
      expect(screen.getByText('Available')).toBeTruthy();
    });

    it('renders Unavailable button when isAvailable=false', () => {
      render(
        <ProviderDashboardCard
          activeCommitments={0}
          providerId="profile-1"
          isAvailable={false}
        />
      );
      expect(screen.getByText('Unavailable')).toBeTruthy();
    });

    it('calls updateAvailability with flipped value on click', async () => {
      render(
        <ProviderDashboardCard
          activeCommitments={0}
          providerId="profile-1"
          isAvailable={true}
        />
      );
      const btn = screen.getByRole('button', { name: /available/i });
      fireEvent.click(btn);

      await waitFor(() => {
        expect(providerService.updateAvailability).toHaveBeenCalledWith('profile-1', false);
      });
    });

    it('does not render toggle when providerId is undefined', () => {
      render(
        <ProviderDashboardCard
          activeCommitments={0}
          isAvailable={true}
        />
      );
      // Availability section should not be present
      expect(screen.queryByText('Availability')).toBeNull();
    });
  });
});
