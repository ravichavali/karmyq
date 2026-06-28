/**
 * Sprint 113 / BUG-027: every belonging-graph surface lost its zoom affordance.
 * Restore visible zoom controls with a SINGLE owner — mounted inside the one
 * renderer (TrustGraphHEB), gated by `enableZoom`, so no surface double-mounts.
 *
 * Proves: controls render when zoom is enabled, are absent when disabled, and
 * clicking them drives the real d3.zoom behavior (the svg's __zoom transform).
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import CommunityRingGraph from '@/components/graphs/CommunityRingGraph';
import TrustGraphHEB from '@/components/graphs/TrustGraphHEB';

const graphData = {
  nodes: [
    { id: 'me', name: 'Maria', isCurrentUser: true },
    { id: 'b', name: 'Bob' },
    { id: 'c', name: 'Cara' },
  ],
  links: [
    { source: 'me', target: 'b', decayTier: 'strong' },
    { source: 'b', target: 'c', decayTier: 'warm' },
  ],
} as any;

describe('Sprint 113 — BUG-027 graph zoom controls (single owner)', () => {
  it('renders zoom in/out/reset controls when zoom is enabled', () => {
    render(<TrustGraphHEB graphData={graphData} currentUserId="me" mode="community" enableZoom />);
    expect(screen.getByLabelText(/zoom in/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/zoom out/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/reset zoom/i)).toBeInTheDocument();
  });

  it('does not render controls when zoom is disabled', () => {
    render(<TrustGraphHEB graphData={graphData} currentUserId="me" mode="community" />);
    expect(screen.queryByLabelText(/zoom in/i)).not.toBeInTheDocument();
  });

  it('zooming in increases the svg zoom scale (drives the d3 zoom behavior)', () => {
    const { container } = render(
      <TrustGraphHEB graphData={graphData} currentUserId="me" mode="community" enableZoom />
    );
    const svg = container.querySelector('svg') as any;
    const before = svg.__zoom?.k ?? 1;
    fireEvent.click(screen.getByLabelText(/zoom in/i));
    expect(svg.__zoom.k).toBeGreaterThan(before);
  });

  it('reset returns the zoom scale to its initial value', () => {
    const { container } = render(
      <TrustGraphHEB graphData={graphData} currentUserId="me" mode="community" enableZoom />
    );
    const svg = container.querySelector('svg') as any;
    fireEvent.click(screen.getByLabelText(/zoom in/i));
    expect(svg.__zoom.k).toBeGreaterThan(1);
    fireEvent.click(screen.getByLabelText(/reset zoom/i));
    expect(svg.__zoom.k).toBeCloseTo(1);
  });

  it('keeps the direct community ring on the same single-owner zoom contract', () => {
    const { container } = render(
      <CommunityRingGraph graphData={graphData} currentUserId="me" enableZoom />
    );
    const svg = container.querySelector('svg') as any;
    const before = svg.__zoom.k;

    expect(screen.getAllByLabelText(/zoom in/i)).toHaveLength(1);
    fireEvent.click(screen.getByLabelText(/zoom in/i));
    expect(svg.__zoom.k).toBeGreaterThan(before);
  });
});
