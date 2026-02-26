import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import UpcomingPanel from '../../src/components/UpcomingPanel';

// FulfillmentPanel does external URL building — mock it to keep tests simple
jest.mock('../../src/components/FulfillmentPanel', () => ({
  __esModule: true,
  default: ({ requestType }: { requestType: string }) => (
    <div data-testid="fulfillment-panel">{requestType}</div>
  ),
}));

const mockSubmitFeedback = jest.fn().mockResolvedValue({});
jest.mock('../../src/lib/api', () => ({
  reputationService: {
    submitFeedback: (...args: any[]) => mockSubmitFeedback(...args),
  },
}));

const makeMatch = (overrides: Partial<{
  id: string;
  request_id: string;
  responder_id: string;
  status: string;
  created_at: string;
  responder_name: string;
  requester_name: string;
  request_title: string;
  request_type: string;
  payload: Record<string, any>;
  scheduled_at: string;
}> = {}) => ({
  id: 'match-1',
  request_id: 'req-1',
  responder_id: 'helper-user',
  requester_id: 'requester-user',
  status: 'matched',
  created_at: '2026-02-24T10:00:00Z',
  responder_name: 'Alice',
  requester_name: 'Bob',
  request_title: 'Ride to airport',
  request_type: 'ride',
  payload: { origin: { address: 'Home' }, destination: { lat: 37, lng: -122, address: 'SFO' } },
  ...overrides,
});

describe('UpcomingPanel', () => {
  beforeEach(() => {
    // Reset localStorage to avoid collapsed state bleeding between tests
    localStorage.clear();
  });

  it('renders nothing when there are no matches', () => {
    const { container } = render(
      <UpcomingPanel matches={[]} currentUserId="user-1" onComplete={jest.fn()} />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders the panel when matches exist', () => {
    render(
      <UpcomingPanel
        matches={[makeMatch()]}
        currentUserId="helper-user"
        onComplete={jest.fn()}
      />
    );
    expect(screen.getByTestId('upcoming-panel')).toBeInTheDocument();
    expect(screen.getByText(/Upcoming Commitments/i)).toBeInTheDocument();
  });

  it('shows match count badge', () => {
    render(
      <UpcomingPanel
        matches={[makeMatch({ id: 'm1' }), makeMatch({ id: 'm2', request_id: 'req-2' })]}
        currentUserId="helper-user"
        onComplete={jest.fn()}
      />
    );
    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('shows request title and other party name', () => {
    render(
      <UpcomingPanel
        matches={[makeMatch()]}
        currentUserId="helper-user"
        onComplete={jest.fn()}
      />
    );
    expect(screen.getByText('Ride to airport')).toBeInTheDocument();
    expect(screen.getByText(/Bob/i)).toBeInTheDocument();
  });

  it('labels the user as "You are helping" when they are the helper', () => {
    render(
      <UpcomingPanel
        matches={[makeMatch({ responder_id: 'helper-user' })]}
        currentUserId="helper-user"
        onComplete={jest.fn()}
      />
    );
    expect(screen.getByText(/You are helping/i)).toBeInTheDocument();
  });

  it('labels the user as "Being helped by" when they are the requester', () => {
    render(
      <UpcomingPanel
        matches={[makeMatch({ responder_id: 'someone-else', requester_name: 'Alice' })]}
        currentUserId="requester-user"
        onComplete={jest.fn()}
      />
    );
    expect(screen.getByText(/Being helped by/i)).toBeInTheDocument();
  });

  it('collapses and expands on toggle', () => {
    render(
      <UpcomingPanel
        matches={[makeMatch()]}
        currentUserId="helper-user"
        onComplete={jest.fn()}
      />
    );
    const items = screen.getByTestId('upcoming-panel-items');
    expect(items).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('upcoming-panel-toggle'));
    expect(screen.queryByTestId('upcoming-panel-items')).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('upcoming-panel-toggle'));
    expect(screen.getByTestId('upcoming-panel-items')).toBeInTheDocument();
  });

  it('calls onComplete with match id after confirmation delay', () => {
    jest.useFakeTimers();
    const onComplete = jest.fn();
    render(
      <UpcomingPanel
        matches={[makeMatch({ id: 'match-42' })]}
        currentUserId="helper-user"
        onComplete={onComplete}
      />
    );
    fireEvent.click(screen.getByText(/✓ Done/i));
    expect(onComplete).not.toHaveBeenCalled(); // not yet
    act(() => jest.advanceTimersByTime(1200));
    expect(onComplete).toHaveBeenCalledWith('match-42');
    jest.useRealTimers();
  });

  it('shows karma confirmation inline after Done is clicked', () => {
    jest.useFakeTimers();
    render(
      <UpcomingPanel
        matches={[makeMatch({ responder_id: 'helper-user' })]}
        currentUserId="helper-user"
        onComplete={jest.fn()}
      />
    );
    fireEvent.click(screen.getByText(/✓ Done/i));
    expect(screen.getByTestId('karma-confirmation')).toHaveTextContent('Karma awarded!');
    jest.useRealTimers();
  });

  it('shows karma confirmation when user is the requester', () => {
    jest.useFakeTimers();
    render(
      <UpcomingPanel
        matches={[makeMatch({ responder_id: 'someone-else' })]}
        currentUserId="requester-user"
        onComplete={jest.fn()}
      />
    );
    fireEvent.click(screen.getByText(/✓ Done/i));
    expect(screen.getByTestId('karma-confirmation')).toHaveTextContent('Karma awarded!');
    jest.useRealTimers();
  });

  it('hides Done button while karma confirmation is showing', () => {
    jest.useFakeTimers();
    render(
      <UpcomingPanel
        matches={[makeMatch()]}
        currentUserId="helper-user"
        onComplete={jest.fn()}
      />
    );
    fireEvent.click(screen.getByText(/✓ Done/i));
    expect(screen.queryByText(/✓ Done/i)).not.toBeInTheDocument();
    jest.useRealTimers();
  });

  it('renders FulfillmentPanel when request_type and payload are present', () => {
    render(
      <UpcomingPanel
        matches={[makeMatch({ request_type: 'ride', payload: { origin: {}, destination: {} } })]}
        currentUserId="helper-user"
        onComplete={jest.fn()}
      />
    );
    expect(screen.getByTestId('fulfillment-panel')).toBeInTheDocument();
  });

  it('does not render FulfillmentPanel when request_type is missing', () => {
    render(
      <UpcomingPanel
        matches={[makeMatch({ request_type: undefined, payload: undefined })]}
        currentUserId="helper-user"
        onComplete={jest.fn()}
      />
    );
    expect(screen.queryByTestId('fulfillment-panel')).not.toBeInTheDocument();
  });

  describe('feedback rating (private signal)', () => {
    beforeEach(() => {
      jest.useFakeTimers();
      mockSubmitFeedback.mockClear();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('shows rating prompt after Done confirmation delay', () => {
      render(
        <UpcomingPanel
          matches={[makeMatch()]}
          currentUserId="helper-user"
          activeCommunityId="community-1"
          onComplete={jest.fn()}
        />
      );
      fireEvent.click(screen.getByText(/✓ Done/i));
      act(() => jest.advanceTimersByTime(1200));
      expect(screen.getByTestId('rating-prompt')).toBeInTheDocument();
    });

    it('renders 5 star buttons in rating prompt', () => {
      render(
        <UpcomingPanel
          matches={[makeMatch()]}
          currentUserId="helper-user"
          activeCommunityId="community-1"
          onComplete={jest.fn()}
        />
      );
      fireEvent.click(screen.getByText(/✓ Done/i));
      act(() => jest.advanceTimersByTime(1200));
      expect(screen.getByTestId('star-1')).toBeInTheDocument();
      expect(screen.getByTestId('star-5')).toBeInTheDocument();
    });

    it('calls submitFeedback with correct args when a star is clicked (helper rating requester)', async () => {
      render(
        <UpcomingPanel
          matches={[makeMatch({ id: 'match-99', responder_id: 'helper-user', requester_id: 'requester-user' })]}
          currentUserId="helper-user"
          activeCommunityId="community-1"
          onComplete={jest.fn()}
        />
      );
      fireEvent.click(screen.getByText(/✓ Done/i));
      act(() => jest.advanceTimersByTime(1200));
      fireEvent.click(screen.getByTestId('star-4'));
      expect(mockSubmitFeedback).toHaveBeenCalledWith({
        match_id: 'match-99',
        to_user_id: 'requester-user',
        community_id: 'community-1',
        rating: 4,
      });
    });

    it('calls submitFeedback rating the responder when current user is the requester', async () => {
      render(
        <UpcomingPanel
          matches={[makeMatch({ id: 'match-99', responder_id: 'helper-user', requester_id: 'requester-user' })]}
          currentUserId="requester-user"
          activeCommunityId="community-1"
          onComplete={jest.fn()}
        />
      );
      fireEvent.click(screen.getByText(/✓ Done/i));
      act(() => jest.advanceTimersByTime(1200));
      fireEvent.click(screen.getByTestId('star-5'));
      expect(mockSubmitFeedback).toHaveBeenCalledWith({
        match_id: 'match-99',
        to_user_id: 'helper-user',
        community_id: 'community-1',
        rating: 5,
      });
    });

    it('hides rating prompt after Skip is clicked', () => {
      render(
        <UpcomingPanel
          matches={[makeMatch()]}
          currentUserId="helper-user"
          activeCommunityId="community-1"
          onComplete={jest.fn()}
        />
      );
      fireEvent.click(screen.getByText(/✓ Done/i));
      act(() => jest.advanceTimersByTime(1200));
      expect(screen.getByTestId('rating-prompt')).toBeInTheDocument();
      fireEvent.click(screen.getByTestId('skip-rating'));
      expect(screen.queryByTestId('rating-prompt')).not.toBeInTheDocument();
    });

    it('does not call submitFeedback when Skip is clicked', () => {
      render(
        <UpcomingPanel
          matches={[makeMatch()]}
          currentUserId="helper-user"
          activeCommunityId="community-1"
          onComplete={jest.fn()}
        />
      );
      fireEvent.click(screen.getByText(/✓ Done/i));
      act(() => jest.advanceTimersByTime(1200));
      fireEvent.click(screen.getByTestId('skip-rating'));
      expect(mockSubmitFeedback).not.toHaveBeenCalled();
    });

    it('hides rating prompt after a star is clicked', async () => {
      render(
        <UpcomingPanel
          matches={[makeMatch()]}
          currentUserId="helper-user"
          activeCommunityId="community-1"
          onComplete={jest.fn()}
        />
      );
      fireEvent.click(screen.getByText(/✓ Done/i));
      act(() => jest.advanceTimersByTime(1200));
      await act(async () => {
        fireEvent.click(screen.getByTestId('star-3'));
      });
      expect(screen.queryByTestId('rating-prompt')).not.toBeInTheDocument();
    });
  });
});
