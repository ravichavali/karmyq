/**
 * Sprint 113 PR B — My Network prominence.
 *
 * Two claims:
 *  1. My Network is reachable from the primary desktop nav (Layout `kq-topnav`), linking `/network`.
 *  2. On the Home feed (`view="home"`), the My Network preview renders AFTER the offered/suggested
 *     preview slot and BEFORE the filter chips (the slot at UnifiedFeed L249→L251). Home has no
 *     DecisionBand (BUG-015), so the preview is anchored by document order, not the band.
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

  it('renders the My Network Home preview before the filter chips', async () => {
    render(<UnifiedFeed view="home" />);

    // Wait for the feed fetch to resolve (loading skeleton clears).
    const preview = await waitFor(() => screen.getByRole('link', { name: /my network/i }));
    expect(preview).toHaveAttribute('href', '/network');

    // The filter chips always render an "All" type chip; the preview must come before them.
    const allChip = screen.getByRole('button', { name: 'All' });
    expect(
      preview.compareDocumentPosition(allChip) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
  });
});
