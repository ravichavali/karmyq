import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import RightSidebar from '../../src/components/RightSidebar';

jest.mock('../../src/lib/api', () => ({
  reputationService: {
    getLeaderboard: jest.fn(),
  },
}));

const { reputationService } = require('../../src/lib/api');

const leaderboard = [
  { user_id: 'u1', name: 'Alice', total_karma: 120, requests_completed: 8 },
  { user_id: 'u2', name: 'Bob', total_karma: 95, requests_completed: 6 },
  { user_id: 'u3', name: 'Carol', total_karma: 70, requests_completed: 4 },
];

describe('RightSidebar', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders top helpers from leaderboard API', async () => {
    reputationService.getLeaderboard.mockResolvedValue({
      data: leaderboard,
    });

    render(<RightSidebar communityId="comm-1" />);

    await waitFor(() => {
      expect(screen.getByTestId('top-helpers-panel')).toBeInTheDocument();
      expect(screen.getByText('Alice')).toBeInTheDocument();
      expect(screen.getByText('Bob')).toBeInTheDocument();
      expect(screen.getByText('Carol')).toBeInTheDocument();
    });
  });

  it('shows karma totals for each helper', async () => {
    reputationService.getLeaderboard.mockResolvedValue({
      data: leaderboard,
    });

    render(<RightSidebar communityId="comm-1" />);

    await waitFor(() => {
      expect(screen.getByText('120')).toBeInTheDocument();
      expect(screen.getByText('95')).toBeInTheDocument();
    });
  });

  it('hides top helpers panel when leaderboard is empty', async () => {
    reputationService.getLeaderboard.mockResolvedValue({
      data: [],
    });

    render(<RightSidebar communityId="comm-1" />);

    await waitFor(() => {
      expect(screen.queryByTestId('top-helpers-panel')).not.toBeInTheDocument();
    });
  });

  it('calls getLeaderboard with communityId and limit 3', async () => {
    reputationService.getLeaderboard.mockResolvedValue({ data: [] });

    render(<RightSidebar communityId="comm-42" />);

    await waitFor(() => {
      expect(reputationService.getLeaderboard).toHaveBeenCalledWith('comm-42', { limit: 3 });
    });
  });

  it('does not fetch when communityId is missing', () => {
    render(<RightSidebar />);
    expect(reputationService.getLeaderboard).not.toHaveBeenCalled();
  });
});
