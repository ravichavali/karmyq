/**
 * Sprint 97 / BUG-097-001: the dashboard must not flash the false
 * "Join a community to see requests" empty state while the membership fetch
 * is still in flight. The membership load is async; the page must stay in its
 * loading state until getMyCommunities resolves, then render the feed.
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';

// Stable router reference — the dashboard mount effect depends on `router`, so a fresh
// object per render would re-fire the effect forever (real Next.js memoizes useRouter).
jest.mock('next/router', () => {
  const router = { push: jest.fn(), isReady: true, query: {} };
  return { useRouter: () => router };
});

jest.mock('next/link', () => {
  return ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  );
});

jest.mock('@/lib/api', () => ({
  communityService: { getMyCommunities: jest.fn() },
}));

jest.mock('@/contexts/ProviderContext', () => ({
  useProvider: () => ({ hasProviderProfile: false, isAvailable: false, providerServiceTypes: [] }),
}));

jest.mock('@/hooks/useOnboarding', () => ({
  useOnboarding: () => ({ shouldShow: false, markSeen: jest.fn() }),
}));

jest.mock('@/components/Feed/UnifiedFeed', () => () => <div data-testid="feed" />);
jest.mock('@/components/Layout', () => ({ children }: { children: React.ReactNode }) => <div>{children}</div>);
jest.mock('@/components/TabBar', () => () => <div data-testid="tabbar" />);
jest.mock('@/components/WelcomeModal', () => () => null);
jest.mock('@/components/SpeedDialFab', () => () => null);
jest.mock('@/components/RequestWizard', () => () => null);
jest.mock('@/components/OnboardingOverlay', () => () => null);

import Dashboard from '@/pages/dashboard';
import { communityService } from '@/lib/api';

const NO_COMMUNITY_HEADING = 'Join a community to see requests';

describe('Sprint 97 dashboard community loading', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    localStorage.setItem('token', 'token');
    localStorage.setItem('user', JSON.stringify({ id: 'user-1', name: 'Maria' }));
  });

  it('keeps loading instead of showing no-community state while memberships are still loading', async () => {
    let resolveCommunities!: (value: any) => void;
    (communityService.getMyCommunities as jest.Mock).mockReturnValue(
      new Promise((resolve) => {
        resolveCommunities = resolve;
      })
    );

    render(<Dashboard />);

    // While the membership fetch is unresolved: no false empty state, still loading.
    expect(screen.queryByText(NO_COMMUNITY_HEADING)).not.toBeInTheDocument();
    expect(screen.getByText('Loading your dashboard...')).toBeInTheDocument();

    resolveCommunities({ data: { communities: [{ id: 'c1', name: 'Berkeley Community Care' }] } });

    await waitFor(() => expect(screen.getByTestId('feed')).toBeInTheDocument());
    expect(screen.queryByText(NO_COMMUNITY_HEADING)).not.toBeInTheDocument();
  });

  it('shows the no-community state only after the fetch resolves empty', async () => {
    (communityService.getMyCommunities as jest.Mock).mockResolvedValue({
      data: { communities: [] },
    });

    render(<Dashboard />);

    await waitFor(() => expect(screen.getByText(NO_COMMUNITY_HEADING)).toBeInTheDocument());
  });
});
