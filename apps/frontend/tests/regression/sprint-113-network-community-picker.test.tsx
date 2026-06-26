/**
 * Sprint 113 / BUG: `/network?mode=community` crashed ("Something went wrong")
 * with `h.map is not a function`. The community picker (rendered only in
 * mode=community) does `memberships.map(...)`, but `getMyCommunities` returns
 * `res.data = { communities: [...], count, total }` — an OBJECT, not an array.
 * The page stored that object in `memberships`, so `.map` threw.
 *
 * Proves the picker extracts the `communities` array and renders its options
 * (and never stores a non-array) for the `{ communities: [...] }` payload shape.
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';

// Stable router in mode=community (the explorer mount effects depend on `router`).
jest.mock('next/router', () => {
  const router = {
    push: jest.fn(),
    replace: jest.fn(),
    prefetch: jest.fn(),
    query: { mode: 'community' },
    isReady: true,
    pathname: '/network',
    asPath: '/network?mode=community',
    events: { on: jest.fn(), off: jest.fn(), emit: jest.fn() },
  };
  return { useRouter: () => router };
});

jest.mock('@/components/Layout', () => ({ children }: { children: React.ReactNode }) => <div>{children}</div>);
jest.mock('@/components/BelongingGraph', () => () => <div data-testid="belonging-graph" />);

jest.mock('@/lib/api', () => ({
  communityService: {
    // The real shape: the unwrapped payload is an OBJECT with a `communities` array.
    getMyCommunities: jest.fn().mockResolvedValue({
      data: { communities: [{ id: 'c1', name: 'Berkeley Community Care' }], count: 1, total: 1 },
    }),
  },
  socialGraphService: {
    getNeighborhood: jest.fn().mockResolvedValue({ data: { nodes: [], links: [] } }),
    getFullCommunityGraph: jest.fn().mockResolvedValue({ data: { nodes: [], links: [] } }),
    getCommunityGraph: jest.fn().mockResolvedValue({ data: { nodes: [], links: [] } }),
  },
}));

import NetworkPage from '@/pages/network';

describe('Sprint 113 — /network?mode=community community picker handles the {communities} payload', () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('token', 'token');
    localStorage.setItem('user', JSON.stringify({ id: 'maria-1', name: 'Maria' }));
  });

  it('renders the community option without crashing (no h.map is not a function)', async () => {
    render(<NetworkPage />);

    // The picker option only appears if `memberships` was stored as the array.
    await waitFor(() =>
      expect(screen.getByRole('option', { name: 'Berkeley Community Care' })).toBeInTheDocument()
    );
  });
});
