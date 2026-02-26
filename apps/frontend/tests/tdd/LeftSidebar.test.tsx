import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import LeftSidebar from '../../src/components/LeftSidebar';

jest.mock('next/router', () => ({
  useRouter: () => ({ push: jest.fn() }),
}));

jest.mock('../../src/lib/api', () => ({
  reputationService: {
    getKarma: jest.fn(),
    getTrustScore: jest.fn(),
  },
}));

const { reputationService } = require('../../src/lib/api');

const user = { id: 'user-1', name: 'Alice' };
const communities = [{ id: 'comm-1', name: 'Neighbors' }];

describe('LeftSidebar', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('shows karma points fetched from API', async () => {
    reputationService.getKarma.mockResolvedValue({
      data: { total_karma: 42, rank: undefined },
    });
    reputationService.getTrustScore.mockResolvedValue({
      data: { score: 65 },
    });

    render(<LeftSidebar user={user} communities={communities} />);

    await waitFor(() => {
      expect(screen.getByText('42')).toBeInTheDocument();
    });
  });

  it('shows trust score fetched from API', async () => {
    reputationService.getKarma.mockResolvedValue({
      data: { total_karma: 10 },
    });
    reputationService.getTrustScore.mockResolvedValue({
      data: { score: 75 },
    });

    render(<LeftSidebar user={user} communities={communities} />);

    await waitFor(() => {
      // Score 75 → "Reliable" label (60–79 band) + "75/100" numeric indicator
      expect(screen.getByText('75/100')).toBeInTheDocument();
      // "Reliable" appears in both the header sub-title and the score section
      expect(screen.getAllByText('Reliable').length).toBeGreaterThan(0);
    });
  });

  it('shows 0 karma and trust score when API fails', async () => {
    reputationService.getKarma.mockRejectedValue(new Error('Network error'));
    reputationService.getTrustScore.mockRejectedValue(new Error('Network error'));

    render(<LeftSidebar user={user} communities={communities} />);

    // Falls back to initial state (null karmaData shows 0 via || 0)
    await waitFor(() => {
      expect(screen.getAllByText('0').length).toBeGreaterThan(0);
    });
  });

  it('calls getKarma and getTrustScore with user id', async () => {
    reputationService.getKarma.mockResolvedValue({ data: {} });
    reputationService.getTrustScore.mockResolvedValue({ data: {} });

    render(<LeftSidebar user={user} communities={communities} activeCommunityId="comm-1" />);

    await waitFor(() => {
      expect(reputationService.getKarma).toHaveBeenCalledWith('user-1', 'comm-1');
      expect(reputationService.getTrustScore).toHaveBeenCalledWith('user-1', 'comm-1');
    });
  });

  it('does not fetch when user id is missing', () => {
    render(<LeftSidebar user={{}} communities={communities} />);
    expect(reputationService.getKarma).not.toHaveBeenCalled();
  });
});
