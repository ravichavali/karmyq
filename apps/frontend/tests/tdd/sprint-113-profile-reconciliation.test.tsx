/**
 * Sprint 113 / BUG-024 + BUG-026: the member's own profile must read its
 * reputation from the ONE canonical self contract — `getMyCommunitySummary`
 * (ADR-082 `GET /reputation/me/community-summary`) — not by separately
 * recombining `getMyKarma` + `getTrustScore`. The dual-source reads were the
 * cause of the same member showing different "trust"/"karma" numbers on the
 * profile vs. the community view.
 *
 * Proves: profile fetches the summary, renders ITS values, and no longer calls
 * the two legacy reads.
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';

// Stable router reference — the profile mount effect depends on `router`, so the global jest.setup
// mock (fresh object per call) would re-fire the effect forever. Real Next.js memoizes useRouter.
jest.mock('next/router', () => {
  const router = { push: jest.fn(), replace: jest.fn(), prefetch: jest.fn(), query: {}, pathname: '/profile', asPath: '/profile', events: { on: jest.fn(), off: jest.fn(), emit: jest.fn() } };
  return { useRouter: () => router };
});

jest.mock('@/components/Layout', () => ({ children }: { children: React.ReactNode }) => <div>{children}</div>);
jest.mock('@/components/BelongingSection', () => () => <div data-testid="belonging" />);
jest.mock('@/components/ProviderProfileTab', () => () => <div data-testid="provider-tab" />);
jest.mock('@/components/ProfileTagsSection', () => ({ ProfileTagsSection: () => <div data-testid="tags" /> }));
jest.mock('@/components/profile/MemorySection', () => () => <div data-testid="memory" />);
jest.mock('@/components/InvitationChain', () => ({
  __esModule: true,
  default: () => <div data-testid="invitation-chain" />,
  InvitationChainSkeleton: () => <div data-testid="invitation-skeleton" />,
}));
jest.mock('@/hooks/useInvitationChain', () => ({
  useInvitationChain: () => ({ chain: null, loading: false }),
}));

jest.mock('@/lib/api', () => ({
  api: { get: jest.fn().mockResolvedValue({ data: { data: [] } }) },
  communityService: {
    getMyCommunities: jest.fn().mockResolvedValue({ data: { communities: [{ id: 'comm-1', name: 'Berkeley' }] } }),
  },
  reputationService: {
    getMyCommunitySummary: jest.fn(),
    getMyKarma: jest.fn(),
    getTrustScore: jest.fn(),
    getGlobalEvolutionSetting: jest.fn().mockResolvedValue({ data: { global_evolution_enabled: true } }),
    getTrustConfig: jest.fn().mockResolvedValue({ data: {} }),
  },
  userSettingsService: {
    getPrivacySettings: jest.fn().mockResolvedValue({ data: { show_my_karma_to_me: true } }),
    updatePrivacySettings: jest.fn().mockResolvedValue({ data: {} }),
  },
  providerService: { getMyProviders: jest.fn().mockResolvedValue({ data: [] }) },
  collectiveService: { getMyCollectives: jest.fn().mockResolvedValue({ data: [] }) },
}));

import Profile from '@/pages/profile';
import { reputationService } from '@/lib/api';

// The canonical SelfCommunityReputation shape (ADR-082) — non-zero sentinels.
const SELF_SUMMARY = {
  data: {
    scope: { type: 'community', community_id: 'comm-1', community_name: 'Berkeley' },
    reputation: { score: 88, scale_min: 0, scale_max: 100, tier: 'trusted', calculated_at: '2026-06-25T00:00:00Z' },
    karma: { current: 137, trend: 'growing', half_life_days: 90, calculated_at: '2026-06-25T00:00:00Z' },
    activity: { recent_helps: 12, recent_requests: 5, window_days: 30 },
  },
};

describe('Sprint 113 — BUG-024/026 profile reconciles onto the canonical self summary', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    localStorage.setItem('token', 'token');
    localStorage.setItem('user', JSON.stringify({ id: 'user-1', name: 'Maria' }));
    (reputationService.getMyCommunitySummary as jest.Mock).mockResolvedValue(SELF_SUMMARY);
  });

  it('reads the canonical summary and never the two legacy reputation endpoints', async () => {
    render(<Profile />);

    await waitFor(() =>
      expect(reputationService.getMyCommunitySummary as jest.Mock).toHaveBeenCalledWith('comm-1')
    );

    expect(reputationService.getMyKarma).not.toHaveBeenCalled();
    expect(reputationService.getTrustScore).not.toHaveBeenCalled();
  });

  it('renders the summary values (current karma, reputation score, activity)', async () => {
    render(<Profile />);

    await waitFor(() => expect(screen.getByText('137')).toBeInTheDocument()); // current karma
    expect(screen.getByText('88')).toBeInTheDocument(); // reputation score
    expect(screen.getByText('12')).toBeInTheDocument(); // recent helps
    expect(screen.getByText('5')).toBeInTheDocument(); // recent requests
  });
});
