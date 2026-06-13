/**
 * Sprint 97 / BUG-097-003 — after widening the feed with "Show more open requests"
 * (minScore → 0), the bottom of the feed must clearly state that everyone / no more open asks
 * are shown. The terminal note must NOT appear before the user clicks Show more.
 *
 * Before the fix, the terminal "That's everyone for now" copy only existed in the zero-card
 * empty states; when the widened feed still returned cards, the feed just ended silently.
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

jest.mock('next/router', () => {
  const router = { pathname: '/dashboard', query: {}, push: jest.fn() };
  return { useRouter: () => router };
});

jest.mock('@/lib/api', () => ({
  requestService: { getCuratedRequests: jest.fn() },
}));

// Stub the heavy card children — this test is about the terminal note, not card internals.
jest.mock('@/components/Feed/RequestCard', () => ({ data }: { data: { request_id: string } }) => (
  <div data-testid="request-card">{data.request_id}</div>
));
jest.mock('@/components/Feed/DecisionBand', () => () => null);
jest.mock('@/components/BrowseModeControl', () => ({
  __esModule: true,
  default: () => null,
}));

import UnifiedFeed from '@/components/Feed/UnifiedFeed';
import { requestService } from '@/lib/api';

const oneRequestResponse = {
  data: {
    items: [
      { kind: 'request', data: { request_id: 'r1', request_type: 'generic', urgency: 'medium' } },
    ],
    count: 1,
  },
};

describe('Sprint 97 feed terminal state after Show more', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    localStorage.setItem('user', JSON.stringify({ id: 'user-1' }));
    // Both the initial (minScore=30) and widened (minScore=0) fetch return the same single card.
    (requestService.getCuratedRequests as jest.Mock).mockResolvedValue(oneRequestResponse);
  });

  it('shows a finite terminal note only after Show more open requests is clicked', async () => {
    const user = userEvent.setup();
    render(<UnifiedFeed noCommunities={false} />);

    // Card renders; before clicking Show more there is no terminal note.
    await waitFor(() => expect(screen.getByTestId('request-card')).toBeInTheDocument());
    expect(screen.queryByText(/that's everyone/i)).not.toBeInTheDocument();

    const showMore = screen.getByRole('button', { name: /show more open requests/i });
    await user.click(showMore);

    // After widening, the bottom of the feed clearly states everyone is shown.
    expect(await screen.findByText(/that's everyone/i)).toBeInTheDocument();
    // And the Show more button is gone (we're already showing everything).
    expect(screen.queryByRole('button', { name: /show more open requests/i })).not.toBeInTheDocument();
  });
});
