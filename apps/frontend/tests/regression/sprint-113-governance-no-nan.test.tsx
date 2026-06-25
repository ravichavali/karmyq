/**
 * Sprint 113 / BUG-025: governance & stewardship surfaces must never render
 * "NaN" for member reputation. After ADR-082 (Reputation Disclosure Boundary)
 * the governance-state contract projects each member row to identity + a coarse
 * eligibility reason only — `trust_score`/`karma` no longer leave the API
 * boundary. The old UI did `Math.round(rh.trust_score)` /
 * `Math.round(m.trust_score)` / `Math.round(m.karma)`, which on the now-omitted
 * fields renders "trust NaN · NaN karma".
 *
 * This proves the UI presence-guards those fields (omit-or-coarse, never `|| 0`).
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';

jest.mock('@/lib/api', () => ({
  communityService: { getGovernanceState: jest.fn() },
}));

import GovernanceTab from '@/components/GovernanceTab';
import { communityService } from '@/lib/api';

// The ADR-082-shaped governance state: identity + structure + coarse eligibility,
// NO member trust_score / karma anywhere.
const ADR082_GOVERNANCE_STATE = {
  data: {
    settings: {
      eligibility_threshold: 50,
      quorum_size: 3,
      template: 'small-collective',
    },
    maturity: { status: 'mature', avg_trust_score: 42.5, threshold: 50 },
    eligible_members: [
      {
        user_id: 'u1',
        name: 'Maria',
        eligible: true,
        eligibility_reason: 'established_community_relationships',
      },
    ],
    nominations: [],
    role_holders: [{ user_id: 'u2', name: 'Sam', role: 'moderator' }],
  },
};

describe('Sprint 113 — BUG-025 governance renders no NaN', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (communityService.getGovernanceState as jest.Mock).mockResolvedValue(
      ADR082_GOVERNANCE_STATE
    );
  });

  it('renders no "NaN" anywhere when member reputation fields are omitted', async () => {
    const { container } = render(
      <GovernanceTab communityId="c1" currentUserId="u9" />
    );

    await waitFor(() => expect(screen.getByText('Sam')).toBeInTheDocument());

    expect(container.textContent).not.toContain('NaN');
  });

  it('shows role holders by identity + role without a trust number', async () => {
    render(<GovernanceTab communityId="c1" currentUserId="u9" />);

    await waitFor(() => expect(screen.getByText('Sam')).toBeInTheDocument());

    // role label present, but no leaked numeric trust for the role holder
    expect(screen.getByText('moderator')).toBeInTheDocument();
    expect(screen.queryByText(/trust\s+\d/)).not.toBeInTheDocument();
  });

  it('shows eligible members with a coarse eligibility label, no exact trust/karma', async () => {
    render(<GovernanceTab communityId="c1" currentUserId="u9" />);

    await waitFor(() => expect(screen.getByText('Maria')).toBeInTheDocument());

    // a qualitative eligibility cue is shown instead of exact numbers
    expect(
      screen.getByText(/Eligible · established community relationships/i)
    ).toBeInTheDocument();
    expect(screen.queryByText(/\d+\s*karma/)).not.toBeInTheDocument();
  });
});
