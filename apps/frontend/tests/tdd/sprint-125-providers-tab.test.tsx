/**
 * Sprint 125 / ADR-095 — the community provider layer UI.
 *
 * Covers the four rows of the CLAUDE.md UI coverage table for this component: it renders, the
 * conditional (enabled vs not) shows and hides correctly, the API call carries the right payload,
 * and the data fetch both shows data and degrades gracefully.
 *
 * The case worth naming: the server returns `[]` BOTH when a community never enabled provider
 * services and when it enabled them but nobody qualifies yet. Those are different things to a
 * steward — one means "your switch is off", the other means "your bar is too high" — so the
 * component must not collapse them. Two of the tests below exist only to hold that apart.
 */

import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';

jest.mock('@/lib/api', () => ({
  providerService: { getCommunityProviders: jest.fn() },
}));

import ProvidersTab from '@/components/community/tabs/ProvidersTab';
import { providerService } from '@/lib/api';

const mockGet = providerService.getCommunityProviders as jest.Mock;
const COMMUNITY = 'c-1';

const provider = (over: Record<string, unknown> = {}) => ({
  id: 'p1',
  user_id: 'u1',
  service_type: 'ride',
  display_name: 'Ali Rickshaw',
  bio: 'Local rides, evenings',
  pricing_notes: '₹50 flat',
  location_notes: 'Riverside',
  user_name: 'Ali',
  avg_stars: 4.5,
  total_reviews: 12,
  trust_score: 80,
  ...over,
});

afterEach(() => mockGet.mockReset());

describe('ProvidersTab — the empty state is unambiguous', () => {
  it('an enabled community with no qualifying providers says so, never "not enabled"', async () => {
    // The caller does not render this component at all when the switch is off, so an empty list
    // here can only mean "nobody clears the bar". The copy must say that and nothing else.
    mockGet.mockResolvedValueOnce({ data: [] });

    render(<ProvidersTab communityId={COMMUNITY} />);

    await waitFor(() =>
      expect(screen.getByText(/No providers meet this community’s bar yet/i)).toBeInTheDocument()
    );
    expect(screen.queryByText(/has not enabled provider services/i)).not.toBeInTheDocument();
  });
});

describe('ProvidersTab — API payload', () => {
  it('calls getCommunityProviders with the community id', async () => {
    mockGet.mockResolvedValueOnce({ data: [] });

    render(<ProvidersTab communityId={COMMUNITY} />);

    await waitFor(() => expect(mockGet).toHaveBeenCalledWith(COMMUNITY));
  });

  it('reads res.data, not res.data.data (the interceptor already unwraps)', async () => {
    // The recurring bug this repo keeps re-introducing. If the component reached for
    // `res.data.data` this shape would render nothing.
    mockGet.mockResolvedValueOnce({ data: [provider()] });

    render(<ProvidersTab communityId={COMMUNITY} />);

    await waitFor(() => expect(screen.getByText('Ali Rickshaw')).toBeInTheDocument());
  });
});

describe('ProvidersTab — rendering provider data', () => {
  it('renders a provider with its service type, rating and details', async () => {
    mockGet.mockResolvedValueOnce({ data: [provider()] });

    render(<ProvidersTab communityId={COMMUNITY} />);

    await waitFor(() => expect(screen.getByText('Ali Rickshaw')).toBeInTheDocument());
    expect(screen.getByText(/Rides/)).toBeInTheDocument();
    expect(screen.getByText(/★ 4\.5/)).toBeInTheDocument();
    expect(screen.getByText(/12 reviews/)).toBeInTheDocument();
    expect(screen.getByText(/Local rides, evenings/)).toBeInTheDocument();
  });

  it('renders a genuine 0.0 average rather than hiding it', async () => {
    // `avg_stars` is checked with `!= null`, not truthiness — 0 stars is a real, meaningful value
    // and `||` would suppress it. Same class of bug as the feed weight null check.
    mockGet.mockResolvedValueOnce({ data: [provider({ avg_stars: 0, total_reviews: 3 })] });

    render(<ProvidersTab communityId={COMMUNITY} />);

    await waitFor(() => expect(screen.getByText(/★ 0\.0/)).toBeInTheDocument());
  });

  it('singularises a single review', async () => {
    mockGet.mockResolvedValueOnce({ data: [provider({ total_reviews: 1 })] });

    render(<ProvidersTab communityId={COMMUNITY} />);

    await waitFor(() => expect(screen.getByText(/1 review$/)).toBeInTheDocument());
  });

  it('omits the rating block entirely when the provider has no average', async () => {
    mockGet.mockResolvedValueOnce({ data: [provider({ avg_stars: null })] });

    render(<ProvidersTab communityId={COMMUNITY} />);

    await waitFor(() => expect(screen.getByText('Ali Rickshaw')).toBeInTheDocument());
    expect(screen.queryByText(/★/)).not.toBeInTheDocument();
  });
});

describe('ProvidersTab — graceful degradation', () => {
  it('shows a membership-specific message on 403', async () => {
    mockGet.mockRejectedValueOnce({ response: { status: 403 } });

    render(<ProvidersTab communityId={COMMUNITY} />);

    await waitFor(() =>
      expect(screen.getByText(/active member of this community/i)).toBeInTheDocument()
    );
  });

  it('shows a generic message on any other failure, and never crashes', async () => {
    mockGet.mockRejectedValueOnce(new Error('network down'));

    render(<ProvidersTab communityId={COMMUNITY} />);

    await waitFor(() =>
      expect(screen.getByText(/could not load this community’s providers/i)).toBeInTheDocument()
    );
  });

  it('retries the fetch when the user clicks Try again', async () => {
    mockGet
      .mockRejectedValueOnce(new Error('network down'))
      .mockResolvedValueOnce({ data: [provider()] });

    render(<ProvidersTab communityId={COMMUNITY} />);

    await waitFor(() => expect(screen.getByText(/Try again/i)).toBeInTheDocument());
    fireEvent.click(screen.getByText(/Try again/i));

    await waitFor(() => expect(screen.getByText('Ali Rickshaw')).toBeInTheDocument());
    expect(mockGet).toHaveBeenCalledTimes(2);
  });

  it('does not render an error state on a successful empty response', async () => {
    mockGet.mockResolvedValueOnce({ data: [] });

    render(<ProvidersTab communityId={COMMUNITY} />);

    await waitFor(() => expect(mockGet).toHaveBeenCalled());
    expect(screen.queryByText(/could not load/i)).not.toBeInTheDocument();
  });
});
