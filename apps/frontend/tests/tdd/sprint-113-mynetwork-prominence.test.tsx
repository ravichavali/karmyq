/**
 * Sprint 113 PR B — My Network prominence.
 *
 * S114 keeps My Network reachable from the primary desktop nav and retires the duplicate Home feed
 * preview. Home has no DecisionBand (BUG-015); My Network now enters through top nav and `/network`.
 */

import { render, screen, waitFor, within } from '@testing-library/react';

// Layout hides the topbar on auth pages ('/', '/login', '/register'); the global jest.setup mock
// defaults pathname to '/', so pin a non-auth route so the nav actually renders.
jest.mock('next/router', () => ({
  useRouter: () => ({
    pathname: '/dashboard',
    push: jest.fn(),
    replace: jest.fn(),
    prefetch: jest.fn(),
    query: {},
    asPath: '/dashboard',
    isReady: true,
    back: jest.fn(),
    events: { on: jest.fn(), off: jest.fn(), emit: jest.fn() },
  }),
}));

// NotificationBell needs a NotificationProvider; stub it out — not under test here.
jest.mock('@/components/NotificationBell', () => () => <div data-testid="notification-bell" />);

// Layout reads the provider context; stub it so the nav renders without the real provider tree.
jest.mock('@/contexts/ProviderContext', () => ({
  useProvider: () => ({
    hasProviderProfile: false,
    providerProfiles: [],
    isAvailable: false,
    setAvailability: jest.fn(),
  }),
}));

// UnifiedFeed fetches the curated feed on mount — return an empty Home feed (no requests/panels).
jest.mock('@/lib/api', () => ({
  requestService: {
    getCuratedRequests: jest.fn().mockResolvedValue({
      data: { items: [], count: 0, offeredAwaiting: 0 },
    }),
  },
}));

import Layout from '@/components/Layout';
import UnifiedFeed from '@/components/Feed/UnifiedFeed';

describe('Sprint 113 — My Network prominence', () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('token', 'token');
    localStorage.setItem('user', JSON.stringify({ id: 'maria-1', name: 'Maria' }));
  });

  it('exposes a My Network link in the primary desktop nav', () => {
    const { container } = render(
      <Layout>
        <div>content</div>
      </Layout>
    );
    const topnav = container.querySelector('.kq-topnav') as HTMLElement;
    expect(topnav).toBeInTheDocument();
    const link = within(topnav).getByRole('link', { name: /my network/i });
    expect(link).toHaveAttribute('href', '/network');
  });

  it('does not render a duplicate My Network Home preview', async () => {
    render(<UnifiedFeed view="home" />);

    // Wait for the feed fetch to resolve (loading skeleton clears).
    await waitFor(() => screen.getByRole('button', { name: 'All' }));
    expect(screen.queryByRole('link', { name: /my network/i })).not.toBeInTheDocument();
  });
});
