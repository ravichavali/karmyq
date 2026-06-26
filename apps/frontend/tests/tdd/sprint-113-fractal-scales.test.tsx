/**
 * Sprint 113 PR B / Task 9 — the belonging fractal made legible as three explicit zoom levels.
 *
 *  - Scale 3 ("Across Communities") renders the new egocentric-hub layout: communities-as-nodes,
 *    always labelled, your communities emerald-anchored, node size = membership, organic vs fission
 *    edges. Replaces the busy hierarchical-edge-bundling radial.
 *  - The community Trust Graph sub-tabs carry distinct scale framing (Scale 1 My Network / Scale 2
 *    This Community) and a link up to Scale 3, so the two member graphs no longer read as duplicates.
 */

import { render, screen, fireEvent, within } from '@testing-library/react';
import CommunityHubGraph from '@/components/graphs/CommunityHubGraph';
import TrustGraphTab from '@/components/community/tabs/TrustGraphTab';
import type { GraphData } from '@/components/graphs/types';

// ReWarmingNudge fetches; stub it so the tab renders standalone.
jest.mock('@/components/relationships/ReWarmingNudge', () => () => <div data-testid="rewarm" />);
// BelongingGraph is the D3 surface; not under test in the framing assertions.
jest.mock('@/components/BelongingGraph', () => () => <div data-testid="belonging-graph" />);

const communitiesGraph: GraphData = {
  nodes: [
    { id: 'c1', name: 'Garden Co-op', member_count: 12, status: 'active', is_member: true },
    { id: 'c2', name: 'Tool Library', member_count: 40, status: 'active', is_member: false },
    { id: 'c3', name: 'Cycle Collective', member_count: 8, status: 'active', is_member: false },
  ],
  links: [
    { source: 'c1', target: 'c2', type: 'organic' },
    { source: 'c1', target: 'c3', type: 'fission' },
  ],
};

describe('Sprint 113 — Scale 3 egocentric-hub layout', () => {
  it('labels every community node and sizes nodes by membership', () => {
    const { container } = render(
      <CommunityHubGraph graphData={communitiesGraph} enableZoom />
    );
    // Every community is labelled, always (legibility over prettiness).
    expect(within(container).getByText('Garden Co-op')).toBeInTheDocument();
    expect(within(container).getByText('Tool Library')).toBeInTheDocument();
    expect(within(container).getByText('Cycle Collective')).toBeInTheDocument();

    // Node radius encodes membership: the 40-member community is the largest dot, the 8-member smallest.
    const r = (id: string) =>
      parseFloat(
        container.querySelector(`[data-node-id="${id}"] circle`)!.getAttribute('r')!
      );
    expect(r('c2')).toBeGreaterThan(r('c1'));
    expect(r('c1')).toBeGreaterThan(r('c3'));
  });

  it('draws an organic and a fission edge with distinct styling', () => {
    const { container } = render(<CommunityHubGraph graphData={communitiesGraph} />);
    const dashed = Array.from(container.querySelectorAll('line.hub-edge')).filter(
      l => l.getAttribute('stroke-dasharray')
    );
    expect(dashed.length).toBe(1); // exactly the fission lineage edge is dashed
  });

  it('renders zoom controls (single owner) when zoom is enabled', () => {
    render(<CommunityHubGraph graphData={communitiesGraph} enableZoom />);
    expect(screen.getByLabelText(/zoom in/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/reset zoom/i)).toBeInTheDocument();
  });

  it('shows a sparse state when there are fewer than two communities', () => {
    render(
      <CommunityHubGraph
        graphData={{ nodes: [{ id: 'c1', name: 'Solo', member_count: 3, is_member: true }], links: [] }}
       
      />
    );
    expect(screen.getByText(/join more communities/i)).toBeInTheDocument();
  });
});

describe('Sprint 113 — distinct scale framing on the community Trust Graph', () => {
  it('frames the two member graphs as Scale 1 / Scale 2 and links up to Scale 3', () => {
    render(<TrustGraphTab communityId="comm-1" currentUserId="me" />);

    // Scale 2 framing on the default (This Community) sub-tab.
    expect(screen.getByText(/Scale 2 · This Community/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'This Community' })).toBeInTheDocument();

    // The level-up link to Scale 3 (communities-as-nodes).
    const link = screen.getByRole('link', { name: /how communities connect/i });
    expect(link).toHaveAttribute('href', '/network?mode=communities');

    // Switching to My Network reframes as Scale 1 (so it no longer reads as a second "This Community").
    fireEvent.click(screen.getByRole('button', { name: 'My Network' }));
    expect(screen.getByText(/Scale 1 · My Network/i)).toBeInTheDocument();
  });
});
