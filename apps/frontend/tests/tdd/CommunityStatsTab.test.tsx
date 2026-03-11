/**
 * Tests for the Community Stats Tab rendering logic (ADR-040)
 *
 * Strategy: The [id].tsx community page is very large and has many
 * complex dependencies. We extract and unit-test the rendering logic
 * using small functional components that replicate what the page
 * renders. This is the same pattern used throughout this project.
 */

import React from 'react';
import { render, screen } from '@testing-library/react';

// ---------------------------------------------------------------------------
// Inline helper components that replicate the rendering logic from [id].tsx
// ---------------------------------------------------------------------------

interface CommunityTrustData {
  score?: number;
  previous_score?: number;
  member_quality_score?: number | null;
  bonding_score?: number | null;
  bridging_score?: number | null;
  active_member_count?: number;
  last_calculated?: string;
}

function CommunityTrustPanel({ data }: { data: CommunityTrustData }) {
  const score: number = data.score ?? 0;
  const prev: number | undefined = data.previous_score;
  const delta = prev !== undefined ? score - prev : 0;
  const trendStr = delta > 0 ? `↑ +${delta} since last week` : delta < 0 ? `↓ ${delta} since last week` : '';

  return (
    <div>
      <div data-testid="trust-score">{score} / 100</div>
      <div data-testid="member-quality">{data.member_quality_score ?? 0} / 40</div>
      <div data-testid="bonding-score">{data.bonding_score ?? 0} / 30</div>
      <div data-testid="bridging-score">{data.bridging_score ?? 0} / 30</div>
      {trendStr && <div data-testid="trend-arrow">{trendStr}</div>}
    </div>
  );
}

interface NetworkMetrics {
  score?: number;
  label?: string;
  reciprocity?: number;
  density?: number;
  clustering?: number;
  avgPathLength?: number;
  uniqueEdges?: number;
  computedAt?: string;
}

function NetworkCohesionPanel({ metrics }: { metrics: NetworkMetrics }) {
  const cohesionScore: number = metrics.score ?? 0;
  const cohesionLabel =
    cohesionScore >= 80 ? 'Highly Cohesive' :
    cohesionScore >= 60 ? 'Cohesive' :
    cohesionScore >= 40 ? 'Developing' :
    cohesionScore >= 20 ? 'Emerging' : 'Fragile';

  return (
    <div>
      <div data-testid="cohesion-score">{cohesionScore} / 100</div>
      <div data-testid="cohesion-label">{metrics.label ?? cohesionLabel}</div>
      <div data-testid="reciprocity">
        {metrics.reciprocity !== undefined ? `${Math.round(metrics.reciprocity * 100)}%` : '—'}
      </div>
      <div data-testid="density">
        {metrics.density !== undefined ? `${Math.round(metrics.density * 100)}%` : '—'}
      </div>
      <div data-testid="clustering">
        {metrics.clustering !== undefined ? metrics.clustering.toFixed(2) : '—'}
      </div>
      <div data-testid="avg-path-length">
        {metrics.avgPathLength !== undefined ? `${metrics.avgPathLength.toFixed(1)}°` : '—'}
      </div>
    </div>
  );
}

interface MemberScoreProps {
  userId: string;
  trustScores: Record<string, number | null | undefined>;
}

function MemberTrustScore({ userId, trustScores }: MemberScoreProps) {
  const score = trustScores[userId];
  return (
    <span data-testid={`trust-score-${userId}`}>
      {score !== null && score !== undefined ? `★ ${score}` : '—'}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('CommunityStatsTab – ADR-040 trust breakdown', () => {
  it('renders member_quality_score, bonding_score, bridging_score when data available', () => {
    render(
      <CommunityTrustPanel
        data={{
          score: 72,
          member_quality_score: 28,
          bonding_score: 22,
          bridging_score: 18,
        }}
      />
    );

    expect(screen.getByTestId('member-quality').textContent).toBe('28 / 40');
    expect(screen.getByTestId('bonding-score').textContent).toBe('22 / 30');
    expect(screen.getByTestId('bridging-score').textContent).toBe('18 / 30');
  });

  it('shows "—" for member with null trust score', () => {
    const trustScores: Record<string, number | null | undefined> = {
      'user-no-score': null,
      'user-with-score': 75,
    };

    render(
      <>
        <MemberTrustScore userId="user-no-score" trustScores={trustScores} />
        <MemberTrustScore userId="user-with-score" trustScores={trustScores} />
      </>
    );

    expect(screen.getByTestId('trust-score-user-no-score').textContent).toBe('—');
    expect(screen.getByTestId('trust-score-user-with-score').textContent).toBe('★ 75');
  });

  it('shows trend arrow when previous_score is present', () => {
    render(
      <CommunityTrustPanel
        data={{
          score: 78,
          previous_score: 72,
        }}
      />
    );

    const trend = screen.getByTestId('trend-arrow');
    expect(trend).toBeInTheDocument();
    expect(trend.textContent).toMatch(/↑/);
    expect(trend.textContent).toMatch(/\+6/);
  });

  it('shows downward trend arrow when score decreased', () => {
    render(
      <CommunityTrustPanel
        data={{
          score: 65,
          previous_score: 70,
        }}
      />
    );

    const trend = screen.getByTestId('trend-arrow');
    expect(trend.textContent).toMatch(/↓/);
  });

  it('renders network cohesion panel with all four metrics', () => {
    render(
      <NetworkCohesionPanel
        metrics={{
          score: 74,
          label: 'Cohesive',
          reciprocity: 0.8,
          density: 0.35,
          clustering: 0.62,
          avgPathLength: 2.4,
        }}
      />
    );

    expect(screen.getByTestId('reciprocity').textContent).toBe('80%');
    expect(screen.getByTestId('density').textContent).toBe('35%');
    expect(screen.getByTestId('clustering').textContent).toBe('0.62');
    expect(screen.getByTestId('avg-path-length').textContent).toBe('2.4°');
  });

  it('shows "Cohesive" label for score >= 60', () => {
    render(
      <NetworkCohesionPanel
        metrics={{ score: 65 }}
      />
    );

    expect(screen.getByTestId('cohesion-label').textContent).toBe('Cohesive');
  });

  it('shows "Fragile" label for score < 20', () => {
    render(
      <NetworkCohesionPanel
        metrics={{ score: 10 }}
      />
    );

    expect(screen.getByTestId('cohesion-label').textContent).toBe('Fragile');
  });

  it('handles failed network metrics fetch gracefully (no metrics data)', () => {
    // When networkMetrics is null/undefined the panel should not render at all.
    // In the page, this is guarded by `{networkMetrics && (() => { ... })()}`.
    // We test the boundary: rendering with undefined metrics shows safe fallbacks.
    const NullSafeNetworkPanel = ({ metrics }: { metrics: NetworkMetrics | null }) => {
      if (!metrics) return <div data-testid="cohesion-absent">no data</div>;
      return <NetworkCohesionPanel metrics={metrics} />;
    };

    render(<NullSafeNetworkPanel metrics={null} />);

    expect(screen.getByTestId('cohesion-absent')).toBeInTheDocument();
    expect(screen.queryByTestId('cohesion-score')).toBeNull();
  });
});
