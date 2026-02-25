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
      data: { data: { total_karma: 42, rank: undefined } },
    });
    reputationService.getTrustScore.mockResolvedValue({
      data: { data: { score: 65 } },
    });

    render(<LeftSidebar user={user} communities={communities} />);

    await waitFor(() => {
      expect(screen.getByText('42')).toBeInTheDocument();
    });
  });

  it('shows trust score fetched from API', async () => {
    reputationService.getKarma.mockResolvedValue({
      data: { data: { total_karma: 10 } },
    });
    reputationService.getTrustScore.mockResolvedValue({
      data: { data: { score: 75 } },
    });

    render(<LeftSidebar user={user} communities={communities} />);

    await waitFor(() => {
      expect(screen.getByText('75')).toBeInTheDocument();
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
    reputationService.getKarma.mockResolvedValue({ data: { data: {} } });
    reputationService.getTrustScore.mockResolvedValue({ data: { data: {} } });

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
