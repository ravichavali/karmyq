/**
 * Sprint 113 PR B / Task 9 — the /network explorer frames the active mode as an explicit scale and,
 * in ego mode, narrates how many people the current depth surfaces (depth-legibility readout) so a
 * small expansion under the sparse privacy scope is still visible.
 */

import { render, screen, waitFor } from '@testing-library/react';

jest.mock('next/router', () => {
  const router = {
    push: jest.fn(),
    replace: jest.fn(),
    prefetch: jest.fn(),
    query: { mode: 'ego' },
    isReady: true,
    pathname: '/network',
    asPath: '/network?mode=ego',
    events: { on: jest.fn(), off: jest.fn(), emit: jest.fn() },
  };
  return { useRouter: () => router };
});

jest.mock('@/components/Layout', () => ({ children }: { children: React.ReactNode }) => <div>{children}</div>);
jest.mock('@/components/BelongingGraph', () => () => <div data-testid="belonging-graph" />);

jest.mock('@/lib/api', () => ({
  communityService: {
    getMyCommunities: jest.fn().mockResolvedValue({ data: { communities: [], count: 0, total: 0 } }),
  },
  socialGraphService: {
    // me + two first-degree people at depth 1 → "Showing 2 people within 1 hop".
    getNeighborhood: jest.fn().mockResolvedValue({
      data: {
        nodes: [
          { user_id: 'me', name: 'Maria', is_current_user: true },
          { user_id: 'a', name: 'Ann' },
          { user_id: 'b', name: 'Ben' },
        ],
        links: [
          { source: 'me', target: 'a', relationship_state: 'strong' },
          { source: 'me', target: 'b', relationship_state: 'warm' },
        ],
      },
    }),
    getFullCommunityGraph: jest.fn().mockResolvedValue({ data: { nodes: [], links: [] } }),
    getCommunityGraph: jest.fn().mockResolvedValue({ data: { nodes: [], links: [] } }),
  },
}));

import NetworkPage from '@/pages/network';

describe('Sprint 113 — /network explorer scale framing + depth readout', () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('token', 'token');
    localStorage.setItem('user', JSON.stringify({ id: 'me', name: 'Maria' }));
  });

  it('frames ego mode as Scale 1 · My Network and shows the depth readout', async () => {
    render(<NetworkPage />);

    expect(await screen.findByText(/Scale 1 · My Network/i)).toBeInTheDocument();

    // The readout makes a small, privacy-scoped expansion legible: "Showing 2 people within 1 hop".
    const readout = await waitFor(() => screen.getByTestId('depth-readout'));
    expect(readout).toHaveTextContent(/Showing\s*2\s*people within\s*1\s*hop/i);
  });
});
