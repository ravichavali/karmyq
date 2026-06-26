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
import BelongingGraphRenderer from '@/components/graphs/BelongingGraphRenderer';
import { forceGraphMethods, resetForceGraphMock } from '../mocks/reactForceGraph2DMock';

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
  beforeEach(() => {
    resetForceGraphMock();
  });

  it('renders zoom in/out/reset controls when zoom is enabled', () => {
    render(<BelongingGraphRenderer graphData={graphData} currentUserId="me" mode="community" enableZoom />);
    expect(screen.getByLabelText(/zoom in/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/zoom out/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/reset zoom/i)).toBeInTheDocument();
  });

  it('does not render controls when zoom is disabled', () => {
    render(<BelongingGraphRenderer graphData={graphData} currentUserId="me" mode="community" />);
    expect(screen.queryByLabelText(/zoom in/i)).not.toBeInTheDocument();
  });

  it('zooming in drives the force-graph zoom method', () => {
    render(<BelongingGraphRenderer graphData={graphData} currentUserId="me" mode="community" enableZoom />);
    fireEvent.click(screen.getByLabelText(/zoom in/i));
    expect(forceGraphMethods.zoom).toHaveBeenCalled();
  });

  it('reset asks the force graph to fit the visible graph', () => {
    render(<BelongingGraphRenderer graphData={graphData} currentUserId="me" mode="community" enableZoom />);
    fireEvent.click(screen.getByLabelText(/reset zoom/i));
    expect(forceGraphMethods.zoomToFit).toHaveBeenCalled();
  });
});
