/**
 * Sprint 113 / BUG-027: every belonging-graph surface lost its zoom affordance. Restore visible zoom
 * controls with a SINGLE owner per surface, gated by `enableZoom`, so no surface double-mounts.
 *
 * Sprint 115 (ADR-083): person modes no longer route through the HEB radial, so the single-owner zoom
 * contract is asserted against each renderer that now owns a mode — EgoOrbitGraph, CommunityRingGraph,
 * CommunityHubGraph — plus TrustGraphHEB for fission. Every case proves exactly one zoom in/out/reset
 * cluster and a real d3.zoom scale change (the svg's __zoom transform).
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import EgoOrbitGraph from '@/components/graphs/EgoOrbitGraph';
import CommunityRingGraph from '@/components/graphs/CommunityRingGraph';
import CommunityHubGraph from '@/components/graphs/CommunityHubGraph';
import TrustGraphHEB from '@/components/graphs/TrustGraphHEB';
import type { GraphData } from '@/components/graphs/types';

const personGraph: GraphData = {
  nodes: [
    { id: 'me', name: 'Maria', isCurrentUser: true },
    { id: 'b', name: 'Bob' },
    { id: 'c', name: 'Cara' },
  ],
  links: [
    { source: 'me', target: 'b', decayTier: 'strong' },
    { source: 'b', target: 'c', decayTier: 'warm' },
  ],
};

const communitiesGraph: GraphData = {
  nodes: [
    { id: 'c1', name: 'Garden Co-op', trust_score: 0, karma: 0, member_count: 12, status: 'active', is_member: true },
    { id: 'c2', name: 'Tool Library', trust_score: 0, karma: 0, member_count: 30, status: 'active', is_member: false },
  ],
  links: [{ source: 'c1', target: 'c2', raw_weight: 3, effective_weight: 3, type: 'organic' }],
};

const fissionGraph: GraphData = {
  nodes: [
    { id: 'me', name: 'Me', isCurrentUser: true },
    { id: 'y', name: 'Connected' },
  ],
  links: [{ source: 'me', target: 'y', raw_weight: 1, effective_weight: 1 }],
};

type Case = [name: string, enabled: () => React.ReactElement, disabled: () => React.ReactElement];

const cases: Case[] = [
  [
    'EgoOrbitGraph (ego)',
    () => <EgoOrbitGraph graphData={personGraph} currentUserId="me" enableZoom />,
    () => <EgoOrbitGraph graphData={personGraph} currentUserId="me" />,
  ],
  [
    'CommunityRingGraph (this community)',
    () => <CommunityRingGraph graphData={personGraph} currentUserId="me" enableZoom />,
    () => <CommunityRingGraph graphData={personGraph} currentUserId="me" />,
  ],
  [
    'CommunityHubGraph (across communities)',
    () => <CommunityHubGraph graphData={communitiesGraph} enableZoom />,
    () => <CommunityHubGraph graphData={communitiesGraph} />,
  ],
  [
    'TrustGraphHEB (fission)',
    () => (
      <TrustGraphHEB
        graphData={fissionGraph}
        currentUserId="me"
        mode="fission"
        groupMap={{ me: 'group_a', y: 'group_a' }}
        enableZoom
      />
    ),
    () => (
      <TrustGraphHEB
        graphData={fissionGraph}
        currentUserId="me"
        mode="fission"
        groupMap={{ me: 'group_a', y: 'group_a' }}
      />
    ),
  ],
];

describe.each(cases)('Sprint 113/115 single-owner zoom — %s', (_name, enabled, disabled) => {
  it('renders exactly one zoom in/out/reset cluster and drives the d3 zoom scale', () => {
    const { container } = render(enabled());

    expect(screen.getAllByLabelText(/zoom in/i)).toHaveLength(1);
    expect(screen.getAllByLabelText(/zoom out/i)).toHaveLength(1);
    expect(screen.getAllByLabelText(/reset zoom/i)).toHaveLength(1);

    const svg = container.querySelector('svg') as SVGSVGElement & { __zoom: { k: number } };
    const before = svg.__zoom?.k ?? 1;
    fireEvent.click(screen.getByLabelText(/zoom in/i));
    expect(svg.__zoom.k).toBeGreaterThan(before);
    fireEvent.click(screen.getByLabelText(/reset zoom/i));
    expect(svg.__zoom.k).toBeCloseTo(before);
  });

  it('omits zoom controls when zoom is disabled', () => {
    render(disabled());
    expect(screen.queryByLabelText(/zoom in/i)).not.toBeInTheDocument();
  });
});
