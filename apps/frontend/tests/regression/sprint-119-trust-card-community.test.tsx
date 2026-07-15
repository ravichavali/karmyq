/**
 * Sprint 119 / BUG-029 (TrustCard end): a community-membership connection names the community,
 * never draws a person route. Drawing "You → Them" avatars under "2 degrees away" claimed a
 * direct bond the data doesn't contain (the review-caught sibling of the TrustPathBadge fix).
 */
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { TrustCard } from '../../src/components/TrustCard';

jest.mock('@/lib/api', () => ({
  socialGraphApi: {
    get: jest.fn(),
  },
}));

const { socialGraphApi } = require('@/lib/api');

const BASE = {
  targetUser: { id: 'user-2', name: 'Ben Okafor' },
  invitationPath: null,
  degrees: 2,
};

describe('Sprint 119 — TrustCard community connection is truthful', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('names the community and renders NO person-chain for path_type community', async () => {
    socialGraphApi.get.mockResolvedValue({
      data: {
        ...BASE,
        trustPath: [
          { id: 'user-1', name: 'Maria Reyes' },
          { id: 'user-2', name: 'Ben Okafor' },
        ],
        path_type: 'community',
        community_name: 'Southeast PDX Helpers',
      },
    });

    const { container } = render(<TrustCard userId="user-2" onClose={() => {}} />);

    expect(await screen.findByText('Fellow members of Southeast PDX Helpers')).toBeInTheDocument();
    // No person-chain: no "Connection path" section, no chain arrows, no avatar route.
    expect(screen.queryByText('Connection path')).toBeNull();
    expect(screen.queryByText('→')).toBeNull();
    // The viewer endpoint must not render anywhere (the target's name stays in the header only).
    expect(screen.queryByText('Maria Reyes')).toBeNull();
    expect(container.textContent).toContain('Connected through community membership');
  });

  it('falls back to "Fellow community members" when the name is absent', async () => {
    socialGraphApi.get.mockResolvedValue({
      data: {
        ...BASE,
        trustPath: [
          { id: 'user-1', name: 'Maria Reyes' },
          { id: 'user-2', name: 'Ben Okafor' },
        ],
        path_type: 'community',
      },
    });

    render(<TrustCard userId="user-2" onClose={() => {}} />);

    expect(await screen.findByText('Fellow community members')).toBeInTheDocument();
    expect(screen.queryByText(/undefined/)).toBeNull();
    expect(screen.queryByText('Connection path')).toBeNull();
  });

  it('still draws the person-chain for a real exchange path', async () => {
    socialGraphApi.get.mockResolvedValue({
      data: {
        ...BASE,
        trustPath: [
          { id: 'user-1', name: 'Maria Reyes' },
          { id: 'user-3', name: 'Priya Shah' },
          { id: 'user-2', name: 'Ben Okafor' },
        ],
        path_type: 'exchange',
      },
    });

    render(<TrustCard userId="user-2" onClose={() => {}} />);

    await waitFor(() => expect(screen.getByText('Connection path')).toBeInTheDocument());
    expect(screen.getByText('Priya Shah')).toBeInTheDocument();
    expect(screen.getByText('Connected through shared exchanges')).toBeInTheDocument();
  });
});
